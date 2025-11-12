#!/usr/bin/env python3
"""
Professional PDF Emissions Extractor (Python)

- Input: Root directory containing PDFs (recursively scanned)
- Output: CSV with schema:
    Company Name,Year,Emission Scope,Emissions,GHG Unit,Country,Data Source

Extraction strategy per PDF:
  1) Text extraction via pdfplumber
  2) Regex-based extraction on full text (Scope 1/2/3/Total + values + units)
  3) Table extraction via pdfplumber.extract_tables() with header pivoting (years/scopes)
  4) Optional OCR fallback if text is too short and pytesseract is available

Quality and cleaning:
  - Year must be between 2005 and 2026
  - Scope ∈ {Scope 1, Scope 2, Scope 3, Total}
  - Emissions > 0, not scientific notation, not year-like (1900..2100), < 5e8 tCO2e
  - Units normalized to MT CO2e (kt → ×1000; kg → ÷1000)
  - Company Name derived from metadata/title/legal entity heuristics; fallback to cleaned filename
  - Country inferred from folder name (Egypt when path includes 'egypt')
  - Data Source = PDF filename
  - Deduplicate per (Company Name, Year, Emission Scope) keeping the highest valid Emissions

Usage:
  python extract_emissions.py "D:\\sus-web-scraping\\downloads\\Egypt Sustainability Reports" "output\\egypt_emissions_extracted_py.csv"
"""

import os
import re
import sys
import csv
from typing import List, Dict, Optional, Tuple

try:
    import pdfplumber
except Exception as e:
    print("ERROR: pdfplumber is required. Install with: py -3 -m pip install pdfplumber")
    sys.exit(1)

try:
    import pytesseract  # optional
    OCR_AVAILABLE = True
except Exception:
    OCR_AVAILABLE = False

try:
    import pypdfium2 as pdfium  # robust rasterizer for OCR
    PDFIUM_AVAILABLE = True
except Exception:
    PDFIUM_AVAILABLE = False

import logging
for name in ("pdfminer", "pdfminer.layout", "pdfminer.pdfinterpreter", "pdfminer.converter"):
    logging.getLogger(name).setLevel(logging.ERROR)

# -----------------------
# Normalization utilities
# -----------------------
UNIT_TOKEN = re.compile(r"(tco2e|mtco2e|co2e|co₂e|co2\-e|co2\s*eq|tonnes?|tons?|metric\s*tons?|kt|kg)", re.I)
YEAR_RE = re.compile(r"\b(20\d{2}|19\d{2})\b")
SCOPE_RE = re.compile(r"\b(scope\s*1|scope\s*2|scope\s*3|total)\b", re.I)
LEGAL_ENTITY_TOKENS = re.compile(r"\b(Inc\.?|Incorporated|LLC\.?|Corporation|Corp\.?|PLC\.?|P\.L\.C\.?|PJSC|PJS?C\.?|S\.A\.?E\.?|S\.A\.?|AG|GmbH|NV|N\.V\.?|B\.V\.?|Group|Holdings?|Bank|Company|Co\.?|Limited|Ltd\.?|S\.p\.A\.?|Srl|A\/S|AB|SE|KGaA|N\.?V\.?)\b")

VALID_SCOPES = {"scope 1": "Scope 1", "scope 2": "Scope 2", "scope 3": "Scope 3", "total": "Total"}


def detect_unit(text: str) -> str:
    if not text:
        return "Unknown"
    m = UNIT_TOKEN.search(text)
    if not m:
        return "Unknown"
    tok = m.group(1).lower()
    if tok == "kt":
        return "kt"
    if tok == "kg":
        return "kg"
    # treat all remaining as metric tons of CO2e label
    return "MT CO2e"


def scale_value_by_unit(value: float, unit: str) -> Tuple[float, str]:
    if unit == "kt":
        return value * 1000.0, "MT CO2e"
    if unit == "kg":
        return value / 1000.0, "MT CO2e"
    return value, "MT CO2e"


def parse_number(token: str) -> Optional[float]:
    if not token:
        return None
    s = token.strip()
    if re.search(r"e[+\-]?\d+", s, re.I):
        return None  # reject scientific notation noise
    # normalize european formats
    s2 = s.replace("\u2212", "-").replace("−", "-")
    if re.match(r"^\d{1,3}(\.\d{3})+,\d+$", s2):
        s2 = s2.replace(".", "").replace(",", ".")
    else:
        s2 = s2.replace(",", "")
    try:
        v = float(s2)
        return v if v > 0 else None
    except Exception:
        return None


def normalize_scope(text: str) -> Optional[str]:
    if not text:
        return None
    m = SCOPE_RE.search(text)
    if not m:
        return None
    return VALID_SCOPES.get(m.group(1).lower())


# -----------------------
# Company inference
# -----------------------

def title_case_keep_acronyms(s: str) -> str:
    parts = re.split(r"\s+", s.strip())
    out = []
    for w in parts:
        if not w:
            continue
        if len(w) <= 3 and w.isalpha():
            out.append(w.upper())
        else:
            out.append(w[0].upper() + w[1:])
    return " ".join(out)


def clean_filename_for_company(filename: str) -> str:
    base = os.path.splitext(filename)[0]
    s = re.sub(r"[_\-]+", " ", base)
    s = re.sub(r"\b(annual|integrated|impact|sustainability|esg|summary|report|reports|full|english|final|jaarverslag|jaar|en|de|nl|fr|arabic|compressed|lr|v\d)\b", "", s, flags=re.I)
    s = re.sub(r"\b(20\d{2}|19\d{2})\b", "", s)
    s = re.sub(r"\s{2,}", " ", s).strip()
    return title_case_keep_acronyms(s) or "Unknown"


def infer_company_from_text(text: str) -> Optional[str]:
    # try legal entity line near the start
    first = (text or "")[:16000]
    # Prefer a line with a legal entity token
    for line in first.splitlines():
        l = line.strip()
        if not l or len(l) > 80:
            continue
        if LEGAL_ENTITY_TOKENS.search(l):
            if not re.search(r"(report|sustainability|annual|integrated|impact|summary|contents|table of contents)", l, re.I):
                return re.sub(r"\s{2,}", " ", l)
    # Next, a title-like uppercase line without numbers
    for line in first.splitlines():
        l = line.strip()
        if not l or len(l) > 80:
            continue
        if not re.search(r"\d", l) and re.search(r"[A-Z]{3,}", l):
            if not re.search(r"(report|sustainability|annual|integrated|impact|summary|contents)", l, re.I):
                return re.sub(r"\s{2,}", " ", l)
    return None


def infer_company(pdf: pdfplumber.PDF, text: str, filename: str) -> str:
    try:
        meta = getattr(pdf, "metadata", None) or {}
        title = (meta.get("Title") or "").strip()
        if title and not re.search(r"(report|sustainability|annual|integrated|impact|summary)", title, re.I):
            return title
    except Exception:
        pass
    from_text = infer_company_from_text(text)
    if from_text:
        return from_text
    return clean_filename_for_company(filename)


# -----------------------
# Extraction primitives
# -----------------------
TEXT_PATTERNS = [
    # Scope: value unit (with nearby year inferred later)
    re.compile(r"(scope\s*[123])\s*[:\-]?\s*([\d.,]+)\s*([a-zA-Z²0-9 /\-]{0,16}(?:tco2e|mtco2e|co2e|co₂e|co2\-e|co2\s*eq|tonnes?|tons?|metric\s*tons?|kt|kg))", re.I),
    # Total emissions
    re.compile(r"(total\s+(?:ghg\s+)?emissions?)\s*[:\-]?\s*([\d.,]+)\s*([a-zA-Z²0-9 /\-]{0,16}(?:tco2e|mtco2e|co2e|co₂e|co2\-e|co2\s*eq|tonnes?|tons?|metric\s*tons?|kt|kg))", re.I),
    # Value unit scope
    re.compile(r"([\d.,]+)\s*([a-zA-Z²0-9 /\-]{0,16}(?:tco2e|mtco2e|co2e|co₂e|co2\-e|co2\s*eq|tonnes?|tons?|metric\s*tons?|kt|kg))\s*(scope\s*[123])", re.I),
]


def extract_text(pdf_path: str) -> str:
    out = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                try:
                    t = page.extract_text() or ""
                except Exception:
                    t = ""
                if t:
                    out.append(t)
    except Exception as e:
        print(f"[warn] text extract failed for {pdf_path}: {e}")
    return "\n".join(out)


def extract_tables(pdf_path: str) -> List[List[List[str]]]:
    tables_all = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                try:
                    tables = page.extract_tables() or []
                except Exception:
                    tables = []
                # Ensure text strings
                for t in tables:
                    norm = [[(c if isinstance(c, str) else ("" if c is None else str(c))) for c in row] for row in t]
                    if norm:
                        tables_all.append(norm)
    except Exception as e:
        print(f"[warn] table extract failed for {pdf_path}: {e}")
    return tables_all


def ocr_text(pdf_path: str) -> str:
    # Use pypdfium2 for reliable rasterization instead of pdfplumber.to_image
    if not (OCR_AVAILABLE and PDFIUM_AVAILABLE):
        return ""
    out_lines: List[str] = []
    try:
        doc = pdfium.PdfDocument(pdf_path)
        n = len(doc)
        # 300 DPI scaling relative to 72 DPI default
        scale = 300.0 / 72.0
        for i in range(n):
            try:
                page = doc[i]
                pil = page.render(scale=scale).to_pil()
                txt = pytesseract.image_to_string(pil, lang="eng")
                if txt:
                    out_lines.append(txt)
            except Exception:
                continue
    except Exception as e:
        print(f"[warn] OCR failed for {pdf_path}: {e}")
    return "\n".join(out_lines)


def infer_year_near(lines: List[str], idx: int) -> Optional[int]:
    # look within +/- 3 lines
    for d in range(0, 4):
        up = idx - d
        dn = idx + d
        if up >= 0:
            m = YEAR_RE.search(lines[up])
            if m:
                y = int(m.group(1))
                if 2005 <= y <= 2026:
                    return y
        if dn < len(lines):
            m = YEAR_RE.search(lines[dn])
            if m:
                y = int(m.group(1))
                if 2005 <= y <= 2026:
                    return y
    return None


def extract_from_text(full_text: str) -> List[Dict]:
    records = []
    lines = (full_text or "").splitlines()
    for i, raw in enumerate(lines):
        line = raw.strip()
        if not line:
            continue
        for pat in TEXT_PATTERNS:
            m = pat.search(line)
            if not m:
                continue
            groups = m.groups()
            # Normalize scope and value/unit positions depending on pattern
            scope = None
            value_token = None
            unit_token = None
            if pat is TEXT_PATTERNS[0]:  # scope : value unit
                scope = groups[0]
                value_token = groups[1]
                unit_token = groups[2]
            elif pat is TEXT_PATTERNS[1]:  # total : value unit
                scope = "Total"
                value_token = groups[1]
                unit_token = groups[2]
            elif pat is TEXT_PATTERNS[2]:  # value unit scope
                value_token = groups[0]
                unit_token = groups[1]
                scope = groups[2]
            scope_norm = normalize_scope(scope or "") or "Unknown"
            unit_guess = detect_unit(unit_token or line)
            v = parse_number(value_token or "")
            if v is None:
                continue
            year = infer_year_near(lines, i)
            records.append({
                "year": year,
                "scope": scope_norm,
                "value": v,
                "unit": unit_guess,
                "raw": raw
            })
            break
    return records


def extract_from_tables(tables: List[List[List[str]]]) -> List[Dict]:
    out: List[Dict] = []
    for t in tables:
        if not t or len(t) < 2:
            continue
        header = t[0]
        # map column index -> year if header contains year
        col_year = {}
        for idx, cell in enumerate(header):
            m = YEAR_RE.search(cell or "")
            if m:
                try:
                    y = int(m.group(1))
                    if 2005 <= y <= 2026:
                        col_year[idx] = y
                except Exception:
                    pass
        # map column index -> scope if header contains scope
        col_scope = {}
        for idx, cell in enumerate(header):
            s = normalize_scope(cell or "")
            if s:
                col_scope[idx] = s
        # row-by-row
        for r in range(1, len(t)):
            row = t[r]
            row_text = " ".join(row)
            # detect a scope label on the row
            row_scope = None
            for cell in row:
                s = normalize_scope(cell or "")
                if s:
                    row_scope = s
                    break
            # Strategy A: row has a scope; columns provide years
            if row_scope and col_year:
                for c_idx, y in col_year.items():
                    if c_idx >= len(row):
                        continue
                    v = parse_number(row[c_idx] or "")
                    if v is None:
                        continue
                    unit_guess = detect_unit(header[c_idx] if c_idx < len(header) else "") or detect_unit(row_text)
                    out.append({
                        "year": y,
                        "scope": row_scope,
                        "value": v,
                        "unit": unit_guess,
                        "raw": row_text
                    })
            # Strategy B: header has scopes; row contains year values
            elif col_scope:
                # find a year in the row
                y = None
                for cell in row:
                    m = YEAR_RE.search(cell or "")
                    if m:
                        y = int(m.group(1))
                        break
                if y and (2005 <= y <= 2026):
                    for c_idx, scope_lab in col_scope.items():
                        if c_idx >= len(row):
                            continue
                        v = parse_number(row[c_idx] or "")
                        if v is None:
                            continue
                        unit_guess = detect_unit(header[c_idx] if c_idx < len(header) else "") or detect_unit(row_text)
                        out.append({
                            "year": y,
                            "scope": scope_lab,
                            "value": v,
                            "unit": unit_guess,
                            "raw": row_text
                        })
    return out


# -----------------------
# Cleaning and CSV writing
# -----------------------

def infer_country_from_path(path_str: str) -> str:
    return "Egypt" if "egypt" in path_str.lower() else ""


def clean_and_dedupe(records: List[Dict], company: str, country: str, source_file: str) -> List[Dict]:
    cleaned: Dict[Tuple[str, int, str], Dict] = {}
    for r in records:
        year = r.get("year")
        scope = r.get("scope")
        val = r.get("value")
        unit = r.get("unit") or "Unknown"
        if year is None or not (2005 <= int(year) <= 2026):
            continue
        if scope not in {"Scope 1", "Scope 2", "Scope 3", "Total"}:
            continue
        if val is None or not (val > 0):
            continue
        # value sanity
        if isinstance(val, float) or isinstance(val, int):
            if (float(val)).is_integer() and 1900 <= int(val) <= 2100:
                continue
            if val > 5e8:
                continue
        # normalize unit
        val_scaled, unit_final = scale_value_by_unit(val, unit)
        key = (company, int(year), scope)
        existing = cleaned.get(key)
        if (existing is None) or (val_scaled > existing["Emissions"]):
            cleaned[key] = {
                "Company Name": company,
                "Year": int(year),
                "Emission Scope": scope,
                "Emissions": float(val_scaled),
                "GHG Unit": unit_final,
                "Country": country,
                "Data Source": source_file,
            }
    return list(cleaned.values())


def write_csv(rows: List[Dict], out_path: str) -> None:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    headers = ["Company Name", "Year", "Emission Scope", "Emissions", "GHG Unit", "Country", "Data Source"]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for r in rows:
            w.writerow({h: r.get(h, "") for h in headers})


# -----------------------
# Main per-PDF processing
# -----------------------

def process_pdf(pdf_path: str) -> List[Dict]:
    filename = os.path.basename(pdf_path)
    source_file = filename  # Data Source must be PDF name
    country = infer_country_from_path(pdf_path)

    text = extract_text(pdf_path)
    # OCR fallback only if text is very short
    if len(text) < 200 and OCR_AVAILABLE:
        ocr = ocr_text(pdf_path)
        if ocr:
            text = (text + "\n" + ocr).strip()

    tables = extract_tables(pdf_path)

    text_recs = extract_from_text(text)
    table_recs = extract_from_tables(tables)

    # Company inference uses pdfplumber to access metadata
    company = "Unknown"
    try:
        with pdfplumber.open(pdf_path) as pdf:
            company = infer_company(pdf, text, filename)
    except Exception:
        company = infer_company_from_text(text) or clean_filename_for_company(filename)

    all_raw = text_recs + table_recs
    return clean_and_dedupe(all_raw, company, country, source_file)


def scan_pdfs(root_dir: str) -> List[str]:
    pdfs = []
    for r, _, files in os.walk(root_dir):
        for fn in files:
            if fn.lower().endswith(".pdf"):
                pdfs.append(os.path.join(r, fn))
    return sorted(pdfs)


def main():
    if len(sys.argv) != 3:
        print("Usage: python extract_emissions.py <pdf_directory> <output_csv>")
        sys.exit(1)
    root = sys.argv[1]
    out_csv = sys.argv[2]
    pdfs = scan_pdfs(root)
    print(f"Found {len(pdfs)} PDFs under: {root}")

    all_rows: List[Dict] = []
    for i, p in enumerate(pdfs, 1):
        print(f"[{i}/{len(pdfs)}] Processing {os.path.basename(p)}")
        try:
            rows = process_pdf(p)
        except Exception as e:
            print(f"  [warn] failed {p}: {e}")
            rows = []
        if rows:
            all_rows.extend(rows)
            print(f"  + {len(rows)} clean records")
        else:
            print("  + 0 records")

    write_csv(all_rows, out_csv)
    print(f"\nSaved {len(all_rows)} records to {out_csv}")


if __name__ == "__main__":
    main()
