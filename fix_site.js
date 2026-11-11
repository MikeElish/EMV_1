const fs = require("fs");

const file = "/var/www/emv/src/app/admin/(dashboard)/settings/site/page.tsx";
let content = fs.readFileSync(file, "utf8");

// Remove ManualInputSettings import
content = content.replace(/import \{ ManualInputSettings \} from ["']@\/components\/admin\/ManualInputSettings["'];\n/g, "");

// Remove ManualInputSettings usage - find and remove the component usage
content = content.replace(/<ManualInputSettings[\s\S]*?\/>/g, "");

fs.writeFileSync(file, content);
console.log("Fixed site/page.tsx");
