const fs = require("fs");

const file = "/var/www/emv/src/actions/admin/payment-requests.ts";
let content = fs.readFileSync(file, "utf8");

// Remove the broken import line
content = content.replace(/import \{ \[.*\] \} from ["']@\/lib\/payment-purpose["'];\n/g, "");

// Replace remaining PAYMENT_PURPOSE_CATEGORIES references
content = content.replace(/\["GOODS", "SERVICES", "DELIVERY", "RENT", "BONUSES", "OTHER", "SALARY"\]/g, '["GOODS", "SERVICES", "DELIVERY", "RENT", "BONUSES", "OTHER", "SALARY"]');

fs.writeFileSync(file, content);
console.log("Fixed");
