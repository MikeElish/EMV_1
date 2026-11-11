const fs = require("fs");
const path = require("path");

const file = '/var/www/emv/src/app/(dashboard)/finance/payment-requests/page.tsx';
let content = fs.readFileSync(file, "utf8");

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

fs.writeFileSync(file, content);
console.log("Fixed");
