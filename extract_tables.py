#!/usr/bin/env python3
"""
Improved table extractor using pdfplumber
- Detects year columns and scope columns and pivots to records
- Infers units from headers/footers/row text
- Emits multiple records per table: {year, scope, value, unit}

Usage:
  python extract_tables.py /path/to/file.pdf
"""
import json
import re
import sys

try:
    import pdfplumber
except Exception as e:
    print(json.dumps({"error": "missing_pdfplumber", "message": str(e)}))
    sys.exit(0)

YEAR_RE = re.compile(r"\b(20\d{2}|19\d{2})\b")
UNIT_TOK = re.compile(r"(tco2e|mtco2e|co2e|co₂e|co2-e|co2\s*eq|tonnes?|tons?|metric\s*tons?|kt|kg)", re.I)
SCOPE_CELL = re.compile(r"\b(scope\s*1|scope\s*2|scope\s*3|total|direct\s+emissions|indirect\s+emissions|other\s+emissions)\b", re.I)


def normalize_number(s: str):
    if not s:
        return None
    t = s.strip()
    t = t.replace('\u2212', '-')  # unicode minus
    t = t.replace('−', '-')
    t = t.replace('–', '-')
    # remove spaces and non-breaking spaces
    t = re.sub(r"[\s\xa0]+", "", t)
    # handle european format 1.234,56
    if re.match(r"^\d{1,3}(\.\d{3})+,\d+$", t):
        t = t.replace('.', '').replace(',', '.')
    else:
        t = t.replace(',', '')
    # drop trailing symbols
    t = re.sub(r"[()%]$", "", t)
    try:
        val = float(t)
        if not (val > 0):
            return None
        # drop scientific notation-like values by length heuristic
        if 'e' in s.lower():
            return None
        return val
    except Exception:
        return None


def detect_unit(*texts):
    joined = ' '.join([x or '' for x in texts]).lower()
    m = UNIT_TOK.search(joined)
    if not m:
        return 'MT CO2e'
    tok = m.group(1).lower()
    if tok == 'kt':
        return 'kt'
    if tok == 'kg':
        return 'kg'
    # default treat all as metric tons CO2e label
    return 'MT CO2e'


def scale_value_by_unit(val, unit):
    if unit == 'kt':
        return val * 1000, 'MT CO2e'
    if unit == 'kg':
        return val / 1000, 'MT CO2e'
    return val, 'MT CO2e'


def parse_table(table, page_text):
    records = []
    if not table or len(table) < 2:
        return records

    # Clean rows: ensure list of strings
    rows = []
    for row in table:
        rows.append([(c if isinstance(c, str) else ('' if c is None else str(c))) for c in row])

    # Header analysis: map columns to years and/or scopes
    col_year = {}
    header_units = detect_unit(' '.join(rows[0]), ' '.join(rows[1]) if len(rows) > 1 else '')

    # Identify year columns from any header rows (first 3 rows)
    header_span = min(3, len(rows))
    for r in range(header_span):
        for idx, cell in enumerate(rows[r]):
            ym = YEAR_RE.search(cell)
            if ym:
                try:
                    col_year[idx] = int(ym.group(1))
                except Exception:
                    pass

    # Identify scope in header columns (transposed tables): map col -> scope
    col_scope = {}
    for idx, cell in enumerate(rows[0]):
        m = SCOPE_CELL.search(cell or '')
        if m:
            s = m.group(1).lower()
            if 'scope 1' in s or 'direct' in s:
                col_scope[idx] = 'Scope 1'
            elif 'scope 2' in s or 'indirect' in s:
                col_scope[idx] = 'Scope 2'
            elif 'scope 3' in s or 'other' in s:
                col_scope[idx] = 'Scope 3'
            elif 'total' in s:
                col_scope[idx] = 'Total'

    # Identify a year column index if rows contain a 'Year' or year-like first column
    year_col_idx = None
    for idx, cell in enumerate(rows[0]):
        if re.search(r"\byear\b", cell or '', re.I):
            year_col_idx = idx
            break
    if year_col_idx is None:
        # Try to infer: first column values look like years?
        try:
            for idx in range(len(rows[0])):
                col_vals = [rows[r][idx] for r in range(1, min(len(rows), 6))]
                if any(YEAR_RE.search(v or '') for v in col_vals):
                    year_col_idx = idx
                    break
        except Exception:
            year_col_idx = None

    # Strategy A: Year in columns, Scope in rows
    for r in range(1, len(rows)):
        row = rows[r]
        row_text = ' '.join(row)
        unit_row = detect_unit(row_text, ' '.join(rows[0]))
        # find scope label in row
        scope = None
        for c in row:
            m = SCOPE_CELL.search(c or '')
            if m:
                s = m.group(1).lower()
                if 'scope 1' in s or 'direct' in s:
                    scope = 'Scope 1'
                elif 'scope 2' in s or 'indirect' in s:
                    scope = 'Scope 2'
                elif 'scope 3' in s or 'other' in s:
                    scope = 'Scope 3'
                elif 'total' in s:
                    scope = 'Total'
                break
        if scope and col_year:
            for idx, y in col_year.items():
                if idx >= len(row):
                    continue
                v = normalize_number(row[idx])
                if v is None:
                    continue
                unit = detect_unit(rows[0][idx] if idx < len(rows[0]) else '', row[idx], header_units, page_text, row_text)
                val_scaled, unit_final = scale_value_by_unit(v, unit)
                if 2000 <= y <= 2027 and val_scaled > 0 and val_scaled < 5e8:
                    records.append({
                        'year': y,
                        'scope': scope,
                        'value': val_scaled,
                        'unit': unit_final,
                        'raw': row_text
                    })

    # Strategy B: Scope in columns, Year in rows
    if col_scope:
        for r in range(1, len(rows)):
            row = rows[r]
            # determine year for this row
            y = None
            if year_col_idx is not None and year_col_idx < len(row):
                ym = YEAR_RE.search(row[year_col_idx] or '')
                if ym:
                    try:
                        y = int(ym.group(1))
                    except Exception:
                        y = None
            if y is None:
                # try any cell for year
                for c in row:
                    ym = YEAR_RE.search(c or '')
                    if ym:
                        y = int(ym.group(1))
                        break
            if y is None:
                continue
            row_text = ' '.join(row)
            unit_row = detect_unit(row_text, ' '.join(rows[0]))
            for idx, scope in col_scope.items():
                if idx >= len(row):
                    continue
                v = normalize_number(row[idx])
                if v is None:
                    continue
                unit = detect_unit(rows[0][idx] if idx < len(rows[0]) else '', row[idx], header_units, page_text, row_text)
                val_scaled, unit_final = scale_value_by_unit(v, unit)
                if 2000 <= y <= 2027 and val_scaled > 0 and val_scaled < 5e8:
                    records.append({
                        'year': y,
                        'scope': scope,
                        'value': val_scaled,
                        'unit': unit_final,
                        'raw': row_text
                    })

    return records


def main(pdf_path):
    out = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = ''
                try:
                    page_text = page.extract_text() or ''
                except Exception:
                    page_text = ''
                try:
                    tables = page.extract_tables() or []
                except Exception:
                    tables = []
                for t in tables:
                    try:
                        recs = parse_table(t, page_text)
                        if recs:
                            out.extend(recs)
                    except Exception:
                        continue
    except Exception as e:
        print(json.dumps({"error": "open_failed", "message": str(e)}))
        return

    print(json.dumps(out))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no_input"}))
    else:
        main(sys.argv[1])
