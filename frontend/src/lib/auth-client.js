import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:5173", // Vite proxies /api/auth/* → auth-server :3001
});

export const { useSession, signIn, signOut, signUp } = authClient;
