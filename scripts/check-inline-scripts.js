const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const files = fs.readdirSync(root).filter(name => name.endsWith(".html"));
let errors = 0;
for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  const scripts = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let index = 0;
  while ((match = scripts.exec(html))) {
    if (/\bsrc\s*=/.test(match[1])) continue;
    index++;
    try { new Function(match[2]); }
    catch (error) {
      errors++;
      process.stderr.write(file + " inline script " + index + ": " + error.message + "\n");
    }
  }
}
if (errors) process.exit(1);
process.stdout.write("Inline JavaScript syntax OK in " + files.length + " HTML files.\n");
