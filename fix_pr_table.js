const fs = require("fs");

const file = "/var/www/emv/src/components/admin/PaymentRequestsTable.tsx";
let content = fs.readFileSync(file, "utf8");

// Remove validators import
content = content.replace(
  /import \{ PAYMENT_REQUEST_STATUSES, type PaymentRequestInput \} from ["']@\/lib\/validators\/payment-requests["'];\n/g,
  ""
);

// Add local constants after the last import
const constants = `
const PAYMENT_REQUEST_STATUSES = ["Требуется оплата", "Оплачено", "Отменено"];
type PaymentRequestInput = {
  amount: number;
  purpose: string;
  companyId?: string;
  orderId?: string;
  extraCostId?: string;
  purchaseId?: string;
  fund?: string;
  managerId?: string;
  inn?: string;
};
`;

// Insert after last import
const lastImportIndex = content.lastIndexOf("import ");
const lastImportEnd = content.indexOf(";\n", lastImportIndex) + 2;
content = content.slice(0, lastImportEnd) + constants + content.slice(lastImportEnd);

fs.writeFileSync(file, content);
console.log("Fixed PaymentRequestsTable.tsx");
