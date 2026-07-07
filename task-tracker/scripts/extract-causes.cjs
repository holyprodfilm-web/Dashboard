const XLSX = require('xlsx');
const path = require('path');

const FILE = path.resolve(__dirname, '../../attached_assets/Оплаты_по_объектам_2025_года_(6)_1783410089422.xlsx');
const wb = XLSX.readFile(FILE);
const sheetName = wb.SheetNames.includes('Оплата объектов') ? 'Оплата объектов' : wb.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

// columns: H=7, K=10, R=17, W=22
const cols = { H: 7, K: 10, R: 17, W: 22 };
const result = {};

for (const [key, idx] of Object.entries(cols)) {
  const seen = new Set();
  for (let i = 1; i < rows.length; i++) {
    const val = rows[i][idx];
    if (val && typeof val === 'string' && val.trim()) seen.add(val.trim());
  }
  result[key] = [...seen].sort((a, b) => a.localeCompare(b, 'ru'));
}

console.log(JSON.stringify(result, null, 2));
