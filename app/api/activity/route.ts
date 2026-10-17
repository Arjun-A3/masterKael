import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { listActivity } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireUser();
  if (gate.error) return gate.error;

  const zone = new URL(request.url).searchParams.get("tz") ?? "UTC";

  try {
    const days = await listActivity(gate.userId, zone);
    return NextResponse.json({ days });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not reach the database." },
      { status: 500 },
    );
  }
}
