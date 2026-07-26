import express from "express";
import reportRoutes from "./routes/reports.js";

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

app.use(reportRoutes);

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});