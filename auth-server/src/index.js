import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — must come before Better Auth handler
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Better Auth handles all /api/auth/* routes
// IMPORTANT: Do NOT use express.json() before this — it consumes the request stream
app.all("/api/auth/*", toNodeHandler(auth));

// Body parsing for any custom routes (after auth handler)
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
  res.json({ message: "Praxis Auth Server is running", status: "ok" });
});

app.listen(PORT, () => {
  console.log(`✓ Auth server running on http://localhost:${PORT}`);
  console.log(`  Auth endpoints: http://localhost:${PORT}/api/auth/*`);
});
