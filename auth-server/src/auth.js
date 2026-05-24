import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import pg from "pg";

const { Pool } = pg;

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  plugins: [jwt()],
  trustedOrigins: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    process.env.FRONTEND_URL || "https://praxis-x.vercel.app"
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
});
