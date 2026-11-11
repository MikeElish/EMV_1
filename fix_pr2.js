const fs = require("fs");

const file = "/var/www/emv/src/lib/payment-requests.ts";
let content = fs.readFileSync(file, "utf8");

// Fix broken data object
content = content.replace(
  /data: \{ \.\.\.\(existing\.amount !== amount \? \{ amount \} : \{\}\),\n    \}\);/,
  "data: { ...(existing.amount !== amount ? { amount } : {}) },"
);

fs.writeFileSync(file, content);
console.log("Fixed");
