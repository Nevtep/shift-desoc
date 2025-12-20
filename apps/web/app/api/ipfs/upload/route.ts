import { NextResponse } from "next/server";

import { getEnv, uploadJsonToPinata } from "@shift/shared";

export async function POST(request: Request) {
  const env = getEnv();
  const jwt = env.PINATA_JWT ?? process.env.PINATA_JWT;

  if (!jwt) {
    return NextResponse.json({ error: "PINATA_JWT is not configured" }, { status: 500 });
  }

  let payload: unknown;
  try {
    const body = (await request.json()) as { payload?: unknown };
    payload = body?.payload ?? body;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (payload === undefined || payload === null) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  try {
    const cid = await uploadJsonToPinata({ jwt, payload });
    return NextResponse.json({ cid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
