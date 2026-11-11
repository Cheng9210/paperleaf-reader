# Paper translation in Paperleaf

The approved experiment extends the existing reader translation flow to export a complete Traditional Chinese PDF with original figures, Noto Sans TC body and distinct headings. A new paper must require explicit per-document consent before its text, or images of pages with insufficient extractable text, go to Gemini. OCR is applied when PDF.js has no usable text, including a sparse partial text layer. Translation progress remains resumable. The PDF should match the page artwork and reveal every translated block; clipped passages must be reported before download. The existing annotated-original download remains available.

The static GitHub Pages site and local Node server must both work. Keep API keys out of exported files. The translated PDF may use rendered text to retain visual fidelity, with its search/copy limitation clearly labeled until a font-embedded text layer is available.
