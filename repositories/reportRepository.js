import fs from "fs";

const filePath = "./reports.json";

export function readReports() {
  const data = fs.readFileSync(filePath, "utf8");
  return JSON.parse(data);
}

export function saveReports(reports) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(reports, null, 2)
  );
}