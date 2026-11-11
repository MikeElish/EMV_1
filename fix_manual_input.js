const fs = require("fs");

const files = [
  "/var/www/emv/src/actions/admin/orders.ts",
  "/var/www/emv/src/actions/admin/supplier-orders.ts",
];

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  
  // Remove manual-input import
  content = content.replace(/import \{ ownerManualInputEnabled \} from ["']@\/lib\/manual-input["'];\n/g, "");
  
  // Replace ownerManualInputEnabled() with true
  content = content.replace(/ownerManualInputEnabled\(\)/g, "true");
  
  fs.writeFileSync(file, content);
  console.log("Fixed " + file);
}
