import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";

export function ok(data, init) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export async function withUser(handler) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED", 401);
  return handler(user);
}

export async function readBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
