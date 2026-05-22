import pg from "pg";
import fs from "fs";
import path from "path";
import "dotenv/config";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log("Reading init.sql...");
    const sqlPath = path.resolve(process.cwd(), "../database/init.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("Executing SQL...");
    await pool.query(sql);
    console.log("✅ Game tables created successfully!");
  } catch (error) {
    console.error("❌ Error executing SQL:", error);
  } finally {
    await pool.end();
  }
}

run();
