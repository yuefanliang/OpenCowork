#!/usr/bin/env python3
"""Search for specific keywords/clauses in a legal PDF document."""

import sys
import os
import re

def main():
    if len(sys.argv) < 3:
        print("Usage: python search_clauses.py <pdf_path> <keyword> [keyword2 ...]")
        print("Example: python search_clauses.py contract.pdf termination confidential")
        sys.exit(1)

    pdf_path = sys.argv[1]
    keywords = sys.argv[2:]

    if not os.path.isfile(pdf_path):
        print(f"Error: file not found: {pdf_path}")
        sys.exit(1)

    try:
        import fitz
    except ImportError:
        print("Error: pymupdf not installed. Run: pip install pymupdf")
        sys.exit(1)

    doc = fitz.open(pdf_path)
    pattern = re.compile("|".join(re.escape(k) for k in keywords), re.IGNORECASE)
    total_matches = 0

    for page_num, page in enumerate(doc, 1):
        text = page.get_text()
        for line_num, line in enumerate(text.split("\n"), 1):
            if pattern.search(line):
                stripped = line.strip()
                if stripped:
                    print(f"[Page {page_num}, L{line_num}] {stripped}")
                    total_matches += 1

    doc.close()

    if total_matches == 0:
        print(f"No matches found for: {', '.join(keywords)}")
    else:
        print(f"\nTotal: {total_matches} match(es) for: {', '.join(keywords)}")


if __name__ == "__main__":
    main()
