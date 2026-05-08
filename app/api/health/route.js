import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, service: "billbharat", time: new Date().toISOString() });
}
