const fs = require("fs");

const file = "/var/www/emv/src/actions/admin/payment-requests.ts";
let content = fs.readFileSync(file, "utf8");

// Remove payment-purpose import
content = content.replace(/import \{ PAYMENT_PURPOSE_CATEGORIES \} from ["']@\/lib\/payment-purpose["'];\n/g, "");

// Replace PAYMENT_PURPOSE_CATEGORIES with inline value
content = content.replace(/PAYMENT_PURPOSE_CATEGORIES/g, '["GOODS", "SERVICES", "DELIVERY", "RENT", "BONUSES", "OTHER", "SALARY"]');

fs.writeFileSync(file, content);
console.log("Fixed");
