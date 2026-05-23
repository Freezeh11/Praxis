import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL || (typeof window !== 'undefined' ? window.location.origin : "http://localhost:5173"), // Works locally and via Vercel proxy
});

export const { useSession, signIn, signOut, signUp } = authClient;
