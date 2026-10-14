const { themeCheckRun } = require('@shopify/theme-check-node');
const path = require('path').resolve(process.argv[2] || require('path').join(__dirname, '../..'));
(async () => {
  const { offenses, theme } = await themeCheckRun(path, undefined, (m) => {});
  const bySev = { 0: 'error', 1: 'warning', 2: 'info' };
  const rows = offenses.map(o => ({ sev: bySev[o.severity], check: o.check, file: o.uri.replace('file://' + path + '/', ''), line: o.start.line + 1, msg: o.message }));
  rows.sort((a, b) => a.sev.localeCompare(b.sev) || a.file.localeCompare(b.file) || a.line - b.line);
  for (const r of rows) console.log(`${r.sev.padEnd(7)} ${r.check.padEnd(28)} ${r.file}:${r.line}  ${r.msg}`);
  const counts = rows.reduce((a, r) => (a[r.sev] = (a[r.sev] || 0) + 1, a), {});
  console.log('\nFiles checked:', theme.length, ' Offenses:', JSON.stringify(counts));
})().catch(e => { console.error(e); process.exit(2); });
