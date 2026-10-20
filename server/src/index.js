import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";

const port = Number(process.env.PORT ?? 4000);

async function start() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI must be set before starting FitBuddy.");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  app.listen(port, () => console.log(`FitBuddy API listening on http://localhost:${port}`));
}

start().catch((error) => {
  console.error("Unable to start FitBuddy API:", error.message);
  process.exitCode = 1;
});
