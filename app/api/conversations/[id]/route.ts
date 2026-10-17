import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { deleteConversation, getConversation } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const gate = await requireUser();
  if (gate.error) return gate.error;
  const { id } = await context.params;

  try {
    const conversation = await getConversation(gate.userId, id);
    if (!conversation) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }
    return NextResponse.json(conversation);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not reach the database." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  const gate = await requireUser();
  if (gate.error) return gate.error;
  const { id } = await context.params;

  try {
    const deleted = await deleteConversation(gate.userId, id);
    if (!deleted) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not reach the database." },
      { status: 500 },
    );
  }
}
