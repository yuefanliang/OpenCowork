#!/usr/bin/env python3
"""Extract fillable form field names and values from a PDF."""

import sys
import os
import json

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_form_fields.py <pdf_path> [--json]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    json_mode = "--json" in sys.argv

    if not os.path.isfile(pdf_path):
        print(f"Error: file not found: {pdf_path}")
        sys.exit(1)

    try:
        import fitz
    except ImportError:
        print("Error: pymupdf not installed. Run: pip install pymupdf")
        sys.exit(1)

    doc = fitz.open(pdf_path)
    fields = []

    for page_num, page in enumerate(doc, 1):
        widgets = page.widgets()
        if widgets:
            for w in widgets:
                fields.append({
                    "page": page_num,
                    "field_name": w.field_name,
                    "field_type": w.field_type_string,
                    "field_value": w.field_value or "",
                })
    doc.close()

    if not fields:
        print("No form fields found in the PDF.")
        sys.exit(0)

    if json_mode:
        print(json.dumps(fields, indent=2, ensure_ascii=False))
    else:
        for f in fields:
            print(f"[Page {f['page']}] {f['field_name']} ({f['field_type']}): {f['field_value']}")

    print(f"\nTotal: {len(fields)} field(s) found.")


if __name__ == "__main__":
    main()
