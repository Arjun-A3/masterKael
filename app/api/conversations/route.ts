import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { listConversations } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireUser();
  if (gate.error) return gate.error;

  try {
    const conversations = await listConversations(gate.userId);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not reach the database." },
      { status: 500 },
    );
  }
}
