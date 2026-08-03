import mongoose from "mongoose";

// 127.0.0.1 rather than localhost: on Windows with Node 18+, "localhost" can
// resolve to ::1 first and hang against a MongoDB bound to IPv4.
const DEFAULT_URI = "mongodb://127.0.0.1:27017/maintenance_reports";

export async function connectDB(
  uri = process.env.MONGODB_URI || DEFAULT_URI
) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`Connected to MongoDB (${uri})`);
  } catch (error) {
    console.error("\nCould not connect to MongoDB.");
    console.error(`  Tried: ${uri}`);
    console.error("  Start one with Docker:");
    console.error("    docker run -d --name mongo -p 27017:27017 mongo:7");
    console.error("  Or set MONGODB_URI to your own connection string.\n");
    process.exit(1);
  }
}
