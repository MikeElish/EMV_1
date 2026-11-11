const fs = require("fs");
const path = require("path");

const file = "/var/www/emv/src/lib/payment-requests.ts";
let content = fs.readFileSync(file, "utf8");

// Remove purposeCategory lines and references
content = content.replace(/,\s*purposeCategory:[^,\n]*/g, "");
content = content.replace(/purposeCategory:[^,\n]*/g, "");

fs.writeFileSync(file, content);
console.log("Fixed payment-requests.ts");
