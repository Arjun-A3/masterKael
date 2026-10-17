import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function requireUser(): Promise<
  | { userId: string; error: null }
  | { userId: null; error: NextResponse }
> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return {
        userId: null,
        error: NextResponse.json({ error: "Sign in first." }, { status: 401 }),
      };
    }
    return { userId, error: null };
  } catch (error) {
    console.error(error);
    return {
      userId: null,
      error: NextResponse.json(
        {
          error:
            "Auth is not configured. Set AUTH_SECRET, the Google OAuth client, and MONGODB_URI.",
        },
        { status: 500 },
      ),
    };
  }
}
