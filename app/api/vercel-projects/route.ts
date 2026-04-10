import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const token = process.env.VERCEL_TOKEN
    if (!token) return NextResponse.json({ projects: [] })

    const res = await fetch("https://api.vercel.com/v9/projects?limit=20", {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok) return NextResponse.json({ projects: [] })

    const data = await res.json()
    const projects = (data.projects || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      url: p.alias?.[0]?.domain ? `https://${p.alias[0].domain}` : `https://${p.name}.vercel.app`,
      framework: p.framework,
      updatedAt: p.updatedAt,
      latestDeployment: p.latestDeployments?.[0]?.readyState || "UNKNOWN",
    }))

    return NextResponse.json({ projects })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg, projects: [] })
  }
}
