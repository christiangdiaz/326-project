import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import reportRoutes from "./routes/reports.js";
import authRoutes from "./routes/auth.js";
import { attachUser } from "./middleware/attachUser.js";
import { connectDB } from "./config/db.js";

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-secret";

app.set("view engine", "ejs");
app.set(
  "views",
  path.join(import.meta.dirname, "views")
);

app.use(
  express.static(
    path.join(import.meta.dirname, "public")
  )
);

app.use(express.json());
app.use(
  express.urlencoded({ extended: false })
);

app.use(cookieParser(SESSION_SECRET));
app.use(attachUser);

app.use(authRoutes);
app.use(reportRoutes);

await connectDB();

app.listen(PORT, () => {
  console.log(
    `Server running at http://localhost:${PORT}`
  );
});