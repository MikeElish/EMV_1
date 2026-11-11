const fs = require("fs");

const file = "/var/www/emv/src/components/admin/PaymentRequestsTable.tsx";
let content = fs.readFileSync(file, "utf8");

// Replace validators/payment-requests import
content = content.replace(
  /import \{ PAYMENT_REQUEST_STATUSES, type PaymentRequestInput \} from ["']@\/lib\/validators\/payment-requests["'];\n/g,
  `const PAYMENT_REQUEST_STATUSES = ["Требуется оплата", "Оплачено", "Отменено"] as const;
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
`
);

// Replace payment-purpose import
content = content.replace(
  /import \{ PAYMENT_PURPOSE_CATEGORIES, PAYMENT_PURPOSE_LABELS \} from ["']@\/lib\/payment-purpose["'];\n/g,
  `const PAYMENT_PURPOSE_CATEGORIES = ["GOODS", "SERVICES", "DELIVERY", "RENT", "BONUSES", "OTHER", "SALARY"];
const PAYMENT_PURPOSE_LABELS: Record<string, string> = {
  GOODS: "Товары",
  SERVICES: "Услуги",
  DELIVERY: "Доставка",
  RENT: "Аренда",
  BONUSES: "Бонусы",
  OTHER: "Прочее",
  SALARY: "Зарплата",
};
`
);

fs.writeFileSync(file, content);
console.log("Fixed");
