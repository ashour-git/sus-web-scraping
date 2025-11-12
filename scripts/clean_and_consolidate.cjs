#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const WORKDIR = path.resolve(__dirname, '..');
const INPUT_CSV = path.join(WORKDIR, 'output', 'emissions_data_SIMPLE.csv');
const OUTPUT_CSV = path.join(WORKDIR, 'output', 'all_pdfs_emissions_clean.csv');
const VERIF_CSV = path.join(WORKDIR, 'output', 'verification_low_confidence.csv');
const DOWNLOADS_ROOT = path.join(WORKDIR, 'downloads');

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const rows = [];
  const header = parseLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const arr = parseLine(lines[i]);
    if (arr.length === 0) continue;
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = arr[j] !== undefined ? arr[j] : '';
    }
    rows.push(obj);
  }
  return rows;
}

function parseLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      res.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  res.push(cur);
  return res.map(s => s.trim());
}

function normalizeUnit(u) {
  if (!u) return '';
  const s = String(u).toLowerCase();
  if (s.includes('mt') || s.includes('mton') || s.includes('m t') || s.includes('mt co2e')) return 'MT CO2e';
  if (s.includes('co2e') && s.includes('kg')) return 'kg CO2e';
  if (s.includes('kg')) return 'kg CO2e';
  if (s.includes('ton') || s === 't' || s.includes('\u2013')) return 't CO2e';
  if (s.includes('co2e')) return 'MT CO2e';
  return u;
}

function normalizeScope(s) {
  if (!s) return 'Unknown';
  const t = String(s).toLowerCase();
  if (t.includes('scope 1') || t === '1') return 'Scope 1';
  if (t.includes('scope 2') || t === '2') return 'Scope 2';
  if (t.includes('scope 3') || t === '3') return 'Scope 3';
  if (t.includes('scope')) return 'Unknown';
  if (t.includes('total')) return 'Total';
  return s;
}

function parseValue(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/,/g, '').replace(/\s+/g, '');
  const m = s.match(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/);
  if (!m) return null;
  const num = Number(m[0]);
  if (isNaN(num)) return null;
  return num;
}

function isYear(n) {
  if (!n) return false;
  const num = Number(n);
  return Number.isInteger(num) && num >= 1900 && num <= 2100;
}

function titleCase(s) {
  if (!s) return s;
  return s.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function findFilePathByName(name) {
  try {
    const stack = [DOWNLOADS_ROOT];
    while (stack.length) {
      const dir = stack.pop();
      if (!fs.existsSync(dir)) continue;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.isFile()) {
          if (e.name === name) return p;
        }
      }
    }
  } catch (err) {
    return null;
  }
  return null;
}

function inferCountryFromPath(p) {
  if (!p) return '';
  const lp = p.toLowerCase();
  if (lp.includes('egypt')) return 'Egypt';
  return '';
}

function buildOutputRow(rec) {
  const company = titleCase(rec.company_name || '');
  let year = (rec.year || '').trim();
  let valueRaw = rec.value || '';
  let unit = normalizeUnit(rec.unit || '');
  let scope = normalizeScope(rec.scope || '');
  const parsedValue = parseValue(valueRaw);
  if ((!year || year === 'Unknown' || !isYear(year)) && parsedValue && isYear(parsedValue)) {
    year = String(parsedValue);
    valueRaw = '';
  }
  const value = parseValue(valueRaw);
  const sourceFileName = rec.source_file || '';
  const fullPath = findFilePathByName(sourceFileName);
  const country = inferCountryFromPath(fullPath);
  const out = {
    Company: company || sourceFileName.replace(/\..+$/, ''),
    Year: isYear(year) ? year : '',
    Scope: scope || 'Unknown',
    Emissions: value === null ? '' : String(value),
    'GHG Unit': unit || '',
    Country: country || '',
    'Data Source': fullPath || sourceFileName || ''
  };
  const lowConfidence = (!out.Emissions || out.Emissions === '' || out['GHG Unit'] === '' || out.Scope === 'Unknown' || out.Company === '' );
  return { out, lowConfidence };
}

function writeCSV(pathname, rows) {
  const hdr = ['Company','Year','Scope','Emissions','GHG Unit','Country','Data Source'];
  const lines = [hdr.join(',')];
  for (const r of rows) {
    const vals = hdr.map(h => {
      const v = r[h] === undefined ? '' : String(r[h]);
      if (v.includes(',') || v.includes('\n') || v.includes('"')) return '"' + v.replace(/"/g, '""') + '"';
      return v;
    });
    lines.push(vals.join(','));
  }
  fs.writeFileSync(pathname, lines.join('\n'), 'utf8');
}

function main() {
  if (!fs.existsSync(INPUT_CSV)) {
    console.error('Input CSV not found:', INPUT_CSV);
    process.exit(1);
  }
  const txt = fs.readFileSync(INPUT_CSV, 'utf8');
  const rows = parseCSV(txt);
  const outRows = [];
  const lowRows = [];
  for (const r of rows) {
    const { out, lowConfidence } = buildOutputRow(r);
    outRows.push(out);
    if (lowConfidence) lowRows.push(Object.assign({}, out, { _raw_source: r.source_file || '' }));
  }
  if (!fs.existsSync(path.join(WORKDIR, 'output'))) fs.mkdirSync(path.join(WORKDIR, 'output'), { recursive: true });
  writeCSV(OUTPUT_CSV, outRows);
  writeCSV(VERIF_CSV, lowRows);
  console.log('Cleaned rows:', outRows.length);
  console.log('Low-confidence rows:', lowRows.length);
  console.log('Clean CSV:', OUTPUT_CSV);
  console.log('Verification CSV:', VERIF_CSV);
}

main();
