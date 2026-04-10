import { NextResponse } from "next/server"

// Beijing coordinates
const LAT = 39.9042
const LNG = 116.4074

export async function GET() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current=temperature_2m,weather_code,wind_speed_10m&timezone=Asia%2FShanghai`
    const res = await fetch(url, { next: { revalidate: 1800 } })
    const data = await res.json()

    const code = data.current?.weather_code
    const temp = Math.round(data.current?.temperature_2m)

    const weatherEmoji = (c: number) => {
      if (c === 0) return "☀️"
      if (c <= 3) return "⛅"
      if (c <= 48) return "🌫"
      if (c <= 67) return "🌧"
      if (c <= 77) return "❄️"
      if (c <= 82) return "🌦"
      return "⛈"
    }

    const weatherDesc = (c: number) => {
      if (c === 0) return "Clear"
      if (c <= 3) return "Partly cloudy"
      if (c <= 48) return "Foggy"
      if (c <= 67) return "Rainy"
      if (c <= 77) return "Snowy"
      return "Stormy"
    }

    return NextResponse.json({
      temp,
      emoji: weatherEmoji(code),
      description: weatherDesc(code),
      city: "Beijing"
    })
  } catch {
    return NextResponse.json({ temp: "--", emoji: "🌤", description: "Beijing", city: "Beijing" })
  }
}
