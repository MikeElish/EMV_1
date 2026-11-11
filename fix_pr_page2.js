const fs = require("fs");
const path = require("path");

// Use find to get the actual path
const { execSync } = require("child_process");
const result = execSync('find /var/www/emv/src/app -name "page.tsx" -path "*payment-requests*" 2>/dev/null', { encoding: "utf8" }).trim();
console.log("Found:", result);

let content = fs.readFileSync(result, "utf8");

// Remove problematic imports
content = content.replace(/import \{ .*payment-purpose.* \} from ["'][^"']+["'];\n/g, "");
content = content.replace(/import \{ .*validators\/payment-requests.* \} from ["'][^"']+["'];\n/g, "");

// Remove manager, company, order, purchase, extraCost, bankTransaction, files includes
content = content.replace(/manager: \{ select: \{ name: true, login: true \} \},?\n?/g, "");
content = content.replace(/company: \{ select: \{ name: true \} \},?\n?/g, "");
content = content.replace(/order: \{ select: \{ orderNumber: true \} \},?\n?/g, "");
content = content.replace(/purchase: \{ select: \{ number: true \} \},?\n?/g, "");
content = content.replace(/extraCost: \{ select: \{ kind: true \} \},?\n?/g, "");
content = content.replace(/bankTransaction: \{ select: \{ date: true, amount: true \} \},?\n?/g, "");
content = content.replace(/files: \{ select: \{ kind: true, fileName: true, fileUrl: true \} \},?\n?/g, "");

fs.writeFileSync(result, content);
console.log("Fixed");
