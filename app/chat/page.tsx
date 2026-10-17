import type { Session } from "next-auth";
import { auth, signOut } from "@/auth";
import { ChatApp } from "@/components/chat-app";
import { redirect } from "next/navigation";

export default async function ChatPage() {
  let session: Session | null = null;
  try {
    session = await auth();
  } catch (error) {
    console.error(error);
  }
  if (!session?.user?.id) redirect("/");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <ChatApp
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      logout={logout}
    />
  );
}
