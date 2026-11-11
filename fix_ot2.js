const fs = require("fs");

const file = "/var/www/emv/src/components/admin/OrdersTable.tsx";
const lines = fs.readFileSync(file, "utf8").split("\n");

const newLines = [];
for (const line of lines) {
  if (line.includes('LineBonusCell')) continue;
  if (line.includes('<LineBonusCell')) continue;
  newLines.push(line);
}

fs.writeFileSync(file, newLines.join("\n"));
console.log("Fixed");
