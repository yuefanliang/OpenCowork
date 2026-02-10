#!/usr/bin/env python3
"""Extract the references/bibliography section from an academic PDF."""

import sys
import os
import re

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_references.py <pdf_path>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.isfile(pdf_path):
        print(f"Error: file not found: {pdf_path}")
        sys.exit(1)

    try:
        import fitz
    except ImportError:
        print("Error: pymupdf not installed. Run: pip install pymupdf")
        sys.exit(1)

    doc = fitz.open(pdf_path)
    refs_text = ""
    capture = False

    for page_num, page in enumerate(doc, 1):
        text = page.get_text()
        if not capture:
            if re.search(r'(?i)^\s*(references|bibliography)\s*$', text, re.MULTILINE):
                capture = True
                # Grab text starting from the "References" heading
                match = re.search(r'(?i)(references|bibliography)', text)
                if match:
                    refs_text += f"--- Page {page_num} ---\n"
                    refs_text += text[match.start():]
        else:
            refs_text += f"\n--- Page {page_num} ---\n{text}"

    doc.close()

    if not refs_text.strip():
        print("No 'References' or 'Bibliography' section found.")
        sys.exit(0)

    print(refs_text)


if __name__ == "__main__":
    main()
