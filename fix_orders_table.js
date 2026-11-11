const fs = require("fs");

const file = "/var/www/emv/src/components/admin/OrdersTable.tsx";
let content = fs.readFileSync(file, "utf8");

// Remove LineBonusCell import
content = content.replace(/import \{ LineBonusCell \} from ["']@\/components\/admin\/LineBonusCell["'];\n/g, "");

// Remove LineBonusCell usage
content = content.replace(/[\s]*{!item\.cancelled && <LineBonusCell itemId=\{item\.id\} bonus=\{item\.bonus\} \>\/>}\n/g, "");

fs.writeFileSync(file, content);
console.log("Fixed OrdersTable.tsx");
