#!/usr/bin/env python3
"""Extract text from a PDF file, outputting page-separated plain text."""

import sys
import os

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_text.py <pdf_path> [output_path]")
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

    output_path = sys.argv[2] if len(sys.argv) > 2 else pdf_path + ".txt"

    doc = fitz.open(pdf_path)
    lines = []
    for page_num, page in enumerate(doc, 1):
        text = page.get_text()
        lines.append(f"\n--- Page {page_num} ---\n{text}")
    doc.close()

    full_text = "".join(lines)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(full_text)

    print(f"Extracted {doc.page_count} pages -> {output_path}")


if __name__ == "__main__":
    main()
