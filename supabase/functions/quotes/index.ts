const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface ChartResponse {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number }
      timestamp?: number[]
      indicators?: { quote?: Array<{ close?: Array<number | null> }> }
    }> | null
  }
}

const SYMBOL = /^[A-Z0-9.]{1,15}$/

function tradingDate(unix: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(unix * 1000))
}

async function fetchSpyWindow(period1: number, period2: number): Promise<Map<string, number>> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&period1=${period1}&period2=${period2}`
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  })
  if (!response.ok) throw new Error("spy")
  const body = (await response.json()) as ChartResponse
  const result = body.chart?.result?.[0]
  const timestamps = result?.timestamp ?? []
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  const byDate = new Map<string, number>()
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i]
    const close = closes[i]
    if (typeof ts !== "number" || typeof close !== "number" || !(close > 0)) continue
    byDate.set(tradingDate(ts), close)
  }
  return byDate
}

async function spyHistory(): Promise<Response> {
  const fail = () =>
    new Response(JSON.stringify({ error: "Sin histórico de SPY" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  try {
    const split = Math.floor(Date.UTC(2016, 0, 1) / 1000)
    const now = Math.floor(Date.now() / 1000) + 86400
    const windows = await Promise.all([
      fetchSpyWindow(Math.floor(Date.UTC(1993, 0, 1) / 1000), split),
      fetchSpyWindow(split, now),
    ])
    const byDate = new Map<string, number>()
    for (const window of windows) {
      for (const [date, close] of window) byDate.set(date, close)
    }
    if (byDate.size < 1000) return fail()
    const history = [...byDate.entries()]
      .map(([date, close]) => ({ date, close }))
      .sort((a, b) => a.date.localeCompare(b.date))
    return new Response(JSON.stringify({ history }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch {
    return fail()
  }
}

async function chartWindow(symbol: string, period1: number, period2: number): Promise<Map<string, number>> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${period1}&period2=${period2}`
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  })
  if (!response.ok) throw new Error("chart")
  const body = (await response.json()) as ChartResponse
  const result = body.chart?.result?.[0]
  const timestamps = result?.timestamp ?? []
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  const byDate = new Map<string, number>()
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i]
    const close = closes[i]
    if (typeof ts !== "number" || typeof close !== "number" || !(close > 0)) continue
    byDate.set(tradingDate(ts), close)
  }
  return byDate
}

async function priceSeries(requested: unknown[], start: string): Promise<Response> {
  const symbols = [
    ...new Set(
      requested
        .map((symbol) => String(symbol).trim().toUpperCase())
        .filter((symbol) => SYMBOL.test(symbol)),
    ),
  ].slice(0, 20)
  const period2 = Math.floor(Date.now() / 1000) + 86400
  const parsedStart = /^\d{4}-\d{2}-\d{2}$/.test(start)
    ? Math.floor(Date.parse(`${start}T00:00:00Z`) / 1000)
    : Math.floor(Date.UTC(2015, 0, 1) / 1000)
  const period1 = Number.isFinite(parsedStart) ? parsedStart : Math.floor(Date.UTC(2015, 0, 1) / 1000)
  const series: Record<string, { date: string; close: number }[]> = {}

  let cursor = 0
  async function worker() {
    while (cursor < symbols.length) {
      const symbol = symbols[cursor]
      cursor += 1
      try {
        const byDate = await chartWindow(symbol, period1, period2)
        series[symbol] = [...byDate.entries()]
          .map(([date, close]) => ({ date, close }))
          .sort((a, b) => a.date.localeCompare(b.date))
      } catch {
        series[symbol] = []
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, symbols.length) }, () => worker()))

  return new Response(JSON.stringify({ series }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let symbols: unknown[] = []
  let history = ""
  let series: unknown[] = []
  let start = ""
  try {
    const body = await req.json()
    if (Array.isArray(body?.symbols)) symbols = body.symbols
    if (typeof body?.history === "string") history = body.history
    if (Array.isArray(body?.series)) series = body.series
    if (typeof body?.start === "string") start = body.start
  } catch {
    symbols = []
  }

  if (history === "SPY") return await spyHistory()
  if (series.length > 0) return await priceSeries(series, start)

  const unique = [
    ...new Set(
      symbols
        .map((symbol) => String(symbol).trim().toUpperCase())
        .filter((symbol) => SYMBOL.test(symbol)),
    ),
  ].slice(0, 30)

  const prices: Record<string, number> = {}

  await Promise.all(
    unique.map(async (symbol) => {
      try {
        const url =
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0",
          },
        })
        if (!response.ok) return
        const body = (await response.json()) as ChartResponse
        const price = body.chart?.result?.[0]?.meta?.regularMarketPrice
        if (typeof price === "number" && Number.isFinite(price) && price > 0) {
          prices[symbol] = price
        }
      } catch {
        // El símbolo queda afuera y la app conserva el precio anterior.
      }
    }),
  )

  return new Response(JSON.stringify({ prices }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
