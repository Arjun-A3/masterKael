import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { getClientPromise } from "@/lib/mongodb";

const secret =
  process.env.AUTH_SECRET ||
  (process.env.NEXT_PHASE === "phase-production-build"
    ? "build-placeholder-not-used-at-runtime"
    : undefined);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret,
  adapter: MongoDBAdapter(getClientPromise, {
    databaseName: process.env.MONGODB_DB || undefined,
  }),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: { signIn: "/" },
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
