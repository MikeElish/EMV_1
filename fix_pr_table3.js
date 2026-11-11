const fs = require("fs");

const file = "/var/www/emv/src/components/admin/PaymentRequestsTable.tsx";
const lines = fs.readFileSync(file, "utf8").split("\n");

const newLines = [];
for (const line of lines) {
  if (line.includes('from "@/lib/validators/payment-requests"')) continue;
  if (line.includes('from "@/lib/payment-purpose"')) continue;
  if (line.includes('PAYMENT_REQUEST_STATUSES') && line.includes('const ')) continue;
  if (line.includes('type PaymentRequestInput')) continue;
  if (line.includes('PAYMENT_PURPOSE_CATEGORIES') && line.includes('const ')) continue;
  if (line.includes('PAYMENT_PURPOSE_LABELS') && line.includes('const ')) continue;
  if (line.match(/^\s*amount: number;/)) continue;
  if (line.match(/^\s*purpose: string;/)) continue;
  if (line.match(/^\s*companyId\?: string;/)) continue;
  if (line.match(/^\s*orderId\?: string;/)) continue;
  if (line.match(/^\s*extraCostId\?: string;/)) continue;
  if (line.match(/^\s*purchaseId\?: string;/)) continue;
  if (line.match(/^\s*fund\?: string;/)) continue;
  if (line.match(/^\s*managerId\?: string;/)) continue;
  if (line.match(/^\s*inn\?: string;/)) continue;
  newLines.push(line);
}

// Add local constants after fund-labels import
const constIndex = newLines.findIndex(l => l.includes('FUND_LABELS'));
if (constIndex >= 0) {
  newLines.splice(constIndex + 1, 0,
    "const PAYMENT_REQUEST_STATUSES = [\"Требуется оплата\", \"Оплачено\", \"Отменено\"] as const;",
    "const PAYMENT_PURPOSE_CATEGORIES = [\"GOODS\", \"SERVICES\", \"DELIVERY\", \"RENT\", \"BONUSES\", \"OTHER\", \"SALARY\"];",
    "const PAYMENT_PURPOSE_LABELS: Record<string, string> = { GOODS: \"Товары\", SERVICES: \"Услуги\", DELIVERY: \"Доставка\", RENT: \"Аренда\", BONUSES: \"Бонусы\", OTHER: \"Прочее\", SALARY: \"Зарплата\" };"
  );
}

fs.writeFileSync(file, newLines.join("\n"));
console.log("Fixed");
