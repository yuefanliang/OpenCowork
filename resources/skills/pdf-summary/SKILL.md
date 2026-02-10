---
name: pdf-summary
description: Summarize PDF documents by extracting text with Python (pymupdf) and generating structured summaries. Use when the user wants a summary, overview, or key points from a PDF file.
compatibility: Requires Python 3 and pymupdf (pip install pymupdf)
---

# PDF Summary

Extract text from PDF files and produce structured summaries.

## When to use this skill

- User asks to summarize a PDF document
- User wants key points or an executive overview of a PDF
- User needs a chapter-by-chapter breakdown of a long PDF

## Steps

1. Ensure `pymupdf` is installed. If not:
   ```bash
   pip install pymupdf
   ```

2. Extract text from the PDF using the bundled script:
   ```bash
   python ~/open-cowork/skills/pdf-summary/scripts/extract_text.py "INPUT_FILE_PATH"
   ```
   This outputs `INPUT_FILE_PATH.txt` with page-separated text. Optionally specify a custom output path as a second argument.

3. Read the extracted `.txt` file using the Read tool.

4. Produce a summary in this structure:
   - **Document**: title or filename
   - **Pages**: total count
   - **Executive Summary**: 2–3 sentence overview
   - **Key Points**: 5–10 bullet items
   - **Detailed Sections**: section-by-section breakdown (if requested)

## Edge cases

- **Scanned/image-only PDFs**: If extracted text is empty or garbled, inform the user that OCR is required and suggest `pip install pytesseract`.
- **Very large PDFs (100+ pages)**: Extract text first, then summarize in chunks rather than loading the entire text at once.
- **Password-protected PDFs**: `pymupdf` supports passwords — pass it via `fitz.open(path, password="xxx")`. Ask the user for the password if needed.

## Scripts

- [extract_text.py](scripts/extract_text.py) — Extract all pages as plain text
