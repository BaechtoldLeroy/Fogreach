// scripts/gen-manifest.js
// Liest alle *.json im Zielordner und schreibt eine manifest.json mit Basenamen.
// Aufruf: node scripts/gen-manifest.js roomTemplates
// Optionaler 2. Parameter: Zielpfad fuer manifest.json

const fs = require('fs');
const path = require('path');

async function main() {
  const dir = process.argv[2] || 'roomTemplates';
  const outPath = process.argv[3] || path.join(dir, 'manifest.json');

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`[gen-manifest] Verzeichnis nicht gefunden: ${dir}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const names = entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.json') && e.name !== 'manifest.json')
    .map(e => path.parse(e.name).name)
    .sort((a, b) => a.localeCompare(b, 'en'));

  const payload = {
    generatedAt: new Date().toISOString(),
    count: names.length,
    templates: names
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[gen-manifest] OK -> ${outPath}  (${names.length} Dateien)`);
}

main().catch(err => {
  console.error('[gen-manifest] Fehler:', err);
  process.exit(1);
});