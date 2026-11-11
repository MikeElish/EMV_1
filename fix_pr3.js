const fs = require("fs");

const file = "/var/www/emv/src/lib/payment-requests.ts";
const lines = fs.readFileSync(file, "utf8").split("\n");

// Fix line 66 (index 65)
lines[65] = "      data: { ...(existing.amount !== amount ? { amount } : {}) },";

fs.writeFileSync(file, lines.join("\n"));
console.log("Fixed line 66");
