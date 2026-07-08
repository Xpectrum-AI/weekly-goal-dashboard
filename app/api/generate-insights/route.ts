import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { week } = await req.json();
  const res = await fetch(process.env.XPECTRUM_BASE_URL!, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.XPECTRUM_INSIGHTS_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: { week }, response_mode: "streaming", user: "abc-123" }),
  });
  return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 500 });
}