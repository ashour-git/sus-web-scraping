"""
Sustainability Data Extractor

Professional tool for extracting ESG (Environmental, Social, Governance) metrics 
from corporate sustainability reports in PDF format.

Features:
- Multi-method PDF text extraction (pdfplumber, PyPDF2, OCR)
- Table detection and extraction
- Structured data output to CSV
- Comprehensive error handling and logging

Author: SustainGRC Team
Version: 1.0.0
"""

import io
import json
import logging
import re
import time
from datetime import datetime
from pathlib import Path

# API integration for intelligent data extraction
try:
    import google.generativeai as genai
    API_AVAILABLE = True
except ImportError:
    genai = None
    API_AVAILABLE = False
    logging.warning(
        "API library not available. Install with: pip install google-generativeai"
    )

import pandas as pd
import pdfplumber

# OCR libraries for image-based PDFs
try:
    import fitz  # PyMuPDF
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    logging.warning("OCR libraries not available. Install with: pip install pytesseract pillow pymupdf")

    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    logging.warning(
        "OCR libraries not available. Install with: pip install pytesseract pillow pymupdf"
    )




# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(f'extraction_log_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler(),
    ],
)


class SustainabilityDataExtractor:
    """
    Professional ESG data extraction from sustainability reports.
    
    Extracts environmental, social, governance, and financial metrics
    from PDF sustainability reports using multiple extraction methods.
    """
    
    def __init__(self, api_key: str):
        """
        Initialize the extractor.
        
        Args:
            api_key: API key for data extraction service
        """
        if not API_AVAILABLE:
            raise RuntimeError(
                "API library not available. Install with: pip install google-generativeai"
            )
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-2.5-flash")
        self.failed_files = []

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """
        Extract text from PDF using multiple methods.
        
        Uses pdfplumber for text and tables, PyPDF2 as fallback,
        and OCR for image-based PDFs.
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Extracted text content
        """
        text = ""
        tables_text = ""

        # Method 1: pdfplumber with table extraction
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    try:
                        # Extract regular text
                        page_text = page.extract_text()
                        if page_text:
                            text += f"\n--- Page {page_num + 1} ---\n"
                            text += page_text

                        # Extract tables
                        tables = page.extract_tables()
                        if tables:
                            for table_idx, table in enumerate(tables):
                                tables_text += (
                                    f"\n--- Table {table_idx + 1} on Page {page_num + 1} ---\n"
                                )
                                for row in table:
                                    if row:
                                        # Convert table row to readable text
                                        row_text = " | ".join(
                                            str(cell) if cell else "" for cell in row
                                        )
                                        tables_text += row_text + "\n"

                    except Exception as e:
                        logging.warning(f"Error on page {page_num + 1}: {e!s}")
                        continue

        except Exception as e:
            logging.error(f"pdfplumber failed for {pdf_path}: {e!s}")

            # Method 2: PyPDF2 as fallback
            try:
                import PyPDF2

                with open(pdf_path, "rb") as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    for page_num in range(len(pdf_reader.pages)):
                        page = pdf_reader.pages[page_num]
                        text += f"\n--- Page {page_num + 1} ---\n"
                        text += page.extract_text()
            except Exception as e2:
                logging.error(f"PyPDF2 also failed for {pdf_path}: {e2!s}")

        # Method 3: OCR for image-based PDFs
        if OCR_AVAILABLE and (not text or len(text.strip()) < 500):
            try:
                ocr_text = self._extract_text_with_ocr(pdf_path)
                if ocr_text:
                    text += f"\n--- OCR EXTRACTED TEXT ---\n{ocr_text}"
                    logging.info(f"OCR extracted {len(ocr_text)} characters from {pdf_path}")
            except Exception as e:
                logging.warning(f"OCR failed for {pdf_path}: {e!s}")

        # Combine text and tables
        if tables_text:
            text += f"\n--- EXTRACTED TABLES ---\n{tables_text}"

        return text

    def _extract_text_with_ocr(self, pdf_path: str) -> str:
        """
        Extract text using OCR from image-based PDF pages.
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            OCR-extracted text
        """
        if not OCR_AVAILABLE:
            return ""

        text = ""
        try:
            # Open PDF with PyMuPDF
            doc = fitz.open(pdf_path)

            for page_num in range(min(len(doc), 20)):  # Limit to first 20 pages for OCR
                page = doc.load_page(page_num)

                # Convert page to image
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x scaling for better OCR
                img = Image.open(io.BytesIO(pix.tobytes()))

                # Perform OCR
                page_text = pytesseract.image_to_string(img)
                if page_text.strip():
                    text += f"\n--- OCR Page {page_num + 1} ---\n{page_text}"

            doc.close()

        except Exception as e:
            logging.warning(f"OCR extraction failed: {e!s}")

        return text

    def extract_sustainability_data(
        self, text: str, filename: str, retry_count: int = 3
    ) -> list[dict]:
        """
        Extract structured ESG data from text using intelligent parsing.
        
        Args:
            text: Extracted text from PDF
            filename: Source filename for reference
            retry_count: Number of retry attempts
            
        Returns:
            List of dictionaries containing extracted ESG metrics
        """

        prompt = f"""
Analyze this sustainability report and extract ALL quantitative ESG data.

ENVIRONMENTAL METRICS:
- GHG emissions (Scope 1, 2, 3, Total)
- Energy consumption 
- Water usage
- Waste generation and recycling
- Carbon footprint
- Environmental incidents

SOCIAL METRICS:
- Employee count and workforce
- Diversity metrics
- Health and safety data
- Community investment
- Human rights indicators

GOVERNANCE METRICS:
- Board composition
- Executive compensation
- Ethics and compliance
- Stakeholder engagement

FINANCIAL METRICS:
- Sustainability investments
- Green finance
- Revenue from sustainable products

Output Format - JSON array:
[
  {{
    "Company Name": "organization name",
    "Year": "YYYY",
    "Category": "Environmental/Social/Governance/Financial",
    "Subcategory": "metric name",
    "Metric": "description",
    "Value": "numeric value only",
    "Unit": "measurement unit",
    "Scope": "scope if applicable",
    "Country": "country",
    "Data Source": "{filename}"
  }}
]

Rules:
- Extract multiple entries for different metrics
- Value field: numbers only (remove commas)
- Be comprehensive
- Return empty array if no data
- JSON only, no explanatory text

Text:
{text[:150000]}

JSON OUTPUT:
"""

        for attempt in range(retry_count):
            try:
                response = self.model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.1,
                    ),
                )

                response_text = response.text.strip()

                # Clean response
                response_text = re.sub(r"```json\s*", "", response_text)
                response_text = re.sub(r"```\s*", "", response_text)
                response_text = response_text.strip()

                # Try to find JSON array in the response
                json_match = re.search(r"\[.*\]", response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(0)

                data = json.loads(response_text)

                if isinstance(data, dict):
                    data = [data]

                # Validate and clean data
                cleaned_data = []
                for entry in data:
                    if isinstance(entry, dict):
                        # Clean value field
                        if entry.get("Value"):
                            value_str = (
                                str(entry["Value"]).replace(",", "").replace(" ", "")
                            )
                            # Extract just the number
                            numbers = re.findall(r"\d+\.?\d*", value_str)
                            if numbers:
                                entry["Value"] = numbers[0]

                        cleaned_data.append(entry)

                logging.info(f"Successfully extracted {len(cleaned_data)} records from {filename}")
                return cleaned_data

            except json.JSONDecodeError as e:
                logging.warning(
                    f"JSON parse error (attempt {attempt + 1}/{retry_count}) for {filename}: {e!s}"
                )
                if attempt < retry_count - 1:
                    time.sleep(2)
                    continue
                else:
                    logging.error(f"Final response text: {response_text[:500]}")
                    return []
            except Exception as e:
                logging.error(f"Error (attempt {attempt + 1}/{retry_count}) for {filename}: {e!s}")
                if attempt < retry_count - 1:
                    time.sleep(2)
                    continue
                else:
                    return []

        return []

    def process_pdf_folder(self, folder_path: str, output_csv: str = "emissions_data.csv"):
        """Process all PDFs with progress tracking"""

        folder = Path(folder_path)

        if not folder.exists():
            logging.error(f"Folder does not exist: {folder_path}")
            return None

        pdf_files = list(folder.glob("*.pdf"))

        if not pdf_files:
            logging.error(f"No PDF files found in {folder_path}")
            return None

        logging.info(f"Found {len(pdf_files)} PDF files to process")

        all_data = []
        successful_files = 0

        for idx, pdf_file in enumerate(pdf_files, 1):
            logging.info(f"\n{'='*70}")
            logging.info(f"[{idx}/{len(pdf_files)}] Processing: {pdf_file.name}")
            logging.info(f"{'='*70}")

            try:
                # Extract text
                text = self.extract_text_from_pdf(str(pdf_file))

                if not text or len(text) < 100:
                    logging.warning(f"Insufficient text extracted from {pdf_file.name}")
                    self.failed_files.append(pdf_file.name)
                    continue

                logging.info(f"✓ Extracted {len(text):,} characters")

                # Extract data
                extracted_data = self.extract_sustainability_data(text, pdf_file.name)

                if extracted_data:
                    logging.info(f"✓ Extracted {len(extracted_data)} emission records")
                    all_data.extend(extracted_data)
                    successful_files += 1
                else:
                    logging.warning(f"No emissions data found in {pdf_file.name}")
                    self.failed_files.append(pdf_file.name)

                # Rate limiting
                time.sleep(1.5)

            except Exception as e:
                logging.error(f"Failed to process {pdf_file.name}: {e!s}")
                self.failed_files.append(pdf_file.name)
                continue

        # Generate report
        self._generate_report(all_data, output_csv, successful_files, len(pdf_files))

        return pd.DataFrame(all_data) if all_data else None

    def _generate_report(self, all_data: list[dict], output_csv: str, successful: int, total: int):
        """Generate final report and save CSV"""

        if all_data:
            df = pd.DataFrame(all_data)

            # Ensure columns
            required_columns = [
                "Company Name",
                "Year",
                "Category",
                "Subcategory",
                "Metric",
                "Value",
                "Unit",
                "Scope",
                "Country",
                "Data Source",
            ]

            for col in required_columns:
                if col not in df.columns:
                    df[col] = "Not Available"

            df = df[required_columns]

            # Save CSV
            df.to_csv(output_csv, index=False, encoding="utf-8-sig")

            # Print summary
            print(f"\n{'='*70}")
            print("✅ EXTRACTION COMPLETE")
            print(f"{'='*70}")
            print(f"Output file: {output_csv}")
            print(f"Total records extracted: {len(df)}")
            print(f"Files processed successfully: {successful}/{total}")
            print(f"Failed files: {len(self.failed_files)}")

            if self.failed_files:
                print("\nFailed files:")
                for f in self.failed_files:
                    print(f"  - {f}")

            print("\n📊 DATA SUMMARY:")
            print(f"{'='*70}")
            print(f"Unique companies: {df['Company Name'].nunique()}")
            print(f"Years covered: {sorted(df['Year'].unique())}")
            print(f"Categories: {df['Category'].unique()}")
            print(f"Total metrics extracted: {len(df)}")

            print("\n📋 PREVIEW (first 10 records):")
            print(f"{'='*70}")
            print(df.head(10).to_string(index=False))

            # Statistics by category
            print("\n📈 RECORDS BY CATEGORY:")
            print(df["Category"].value_counts())

            # Statistics by subcategory
            print("\n📈 RECORDS BY SUBCATEGORY:")
            print(df["Subcategory"].value_counts().head(10))  # Top 10 subcategories

        else:
            logging.error("❌ No data was extracted from any PDF")
            print("No data extracted. Check the log file for details.")


def main():
    """Execute the sustainability data extraction pipeline."""
    
    import os
    from dotenv import load_dotenv
    
    # Load environment variables
    load_dotenv()
    
    # Configuration
    API_KEY = os.getenv("GEMINI_API_KEY")
    
    if not API_KEY:
        raise ValueError(
            "GEMINI_API_KEY not found in environment variables.\n"
            "Please create a .env file with: GEMINI_API_KEY=your_api_key_here"
        )
    
    PDF_FOLDER = r"D:\SustainGRC\emission_web_scraping\downloads\Egypt Sustainability Reports"
    OUTPUT_CSV = "egypt_sustainability_data.csv"

    print("=" * 70)
    print(" SUSTAINABILITY DATA EXTRACTOR")
    print("=" * 70)
    print(f"📁 PDF Folder: {PDF_FOLDER}")
    print(f"💾 Output CSV: {OUTPUT_CSV}")
    print(f"🔒 API Key: {'*' * 20}{API_KEY[-4:]}")  # Show last 4 chars only
    print("=" * 70)

    # Initialize and process
    extractor = SustainabilityDataExtractor(API_KEY)
    df = extractor.process_pdf_folder(PDF_FOLDER, OUTPUT_CSV)

    if df is not None:
        print("\n✅ Extraction complete! Check your CSV file.")
    else:
        print("\n⚠️  Extraction completed with issues. Check the log file.")


if __name__ == "__main__":
    main()
