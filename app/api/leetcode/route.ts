import { NextResponse } from "next/server";
import { searchLeetCode } from "@/lib/leetcode";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireUser();
  if (gate.error) return gate.error;

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ questions: [] });
  if (query.length > 80) {
    return NextResponse.json(
      { error: "Keep the search under 80 characters." },
      { status: 400 },
    );
  }

  try {
    const questions = await searchLeetCode(query);
    return NextResponse.json({ questions });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not reach LeetCode." },
      { status: 502 },
    );
  }
}
