import { NextResponse } from "next/server";

export async function POST() {
  const res = await fetch(process.env.XPECTRUM_BASE_URL!, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.XPECTRUM_SYNC_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: {}, response_mode: "streaming", user: "abc-123" }),
  });
  return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 500 });
}