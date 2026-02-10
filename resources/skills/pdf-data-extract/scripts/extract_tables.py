#!/usr/bin/env python3
"""Extract tables from a PDF file using tabula-py, output as Markdown or CSV."""

import sys
import os

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_tables.py <pdf_path> [--csv]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    csv_mode = "--csv" in sys.argv

    if not os.path.isfile(pdf_path):
        print(f"Error: file not found: {pdf_path}")
        sys.exit(1)

    try:
        import tabula
    except ImportError:
        print("Error: tabula-py not installed. Run: pip install tabula-py pandas")
        print("Note: tabula-py requires Java Runtime (JRE).")
        sys.exit(1)

    tables = tabula.read_pdf(pdf_path, pages="all", multiple_tables=True)

    if not tables:
        print("No tables found in the PDF.")
        sys.exit(0)

    for i, df in enumerate(tables):
        print(f"\n=== Table {i + 1} ({len(df)} rows) ===\n")
        if csv_mode:
            print(df.to_csv(index=False))
        else:
            print(df.to_markdown(index=False))

    print(f"\nTotal: {len(tables)} table(s) found.")


if __name__ == "__main__":
    main()
