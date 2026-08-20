import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { create } from "./repositories/reportRepository.js";
import { logger } from "./lib/logger.js";

await connectDB();

await mongoose.connection.collection("reports").deleteMany({});

await create({
  unit: "2C",
  description: "Leaky sink",
  status: "Open"
});

await create({
  unit: "4A",
  description: "Broken air conditioner",
  status: "In Progress"
});

await create({
  unit: "1B",
  description: "Bathroom light is not working",
  status: "Resolved"
});

logger.info("database seeded", { reports: 3 });

await mongoose.connection.close();