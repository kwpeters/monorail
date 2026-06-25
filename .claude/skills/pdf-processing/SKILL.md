---
name: pdf-processing
description: Extract text, images, or render pages from local PDF files using Poppler CLI tools.
---

To extract information from PDF files, you may use the Poppler utilities that are installed on this computer.  The path to these utilities is in the PATH environment variable, so you can run them in any shell.  Most of these command line utilities require specifying an output directory, so you may want to create a temporary directory for the output files.  You can use the `mktemp` command to create a temporary directory, and then remove it when you are done.

Some of the more useful of these utilties include the following:

- `pdftoppm`
  - converts PDF pages to raster images (.ppm, .png, .jpeg, etc.)
  - Example: `pdftoppm -png input.pdf output`

- `pdftocairo`
  - uses the more modern Cairo library that can produce higher quality output (but is slower)
  - Example: `pdftocairo -png input.pdf output`

- `pdftotext`
  - extracts text from PDFs

- `pdfimages`
  - extracts embedded images from a PDF

- `pdftohtml`
  - converts PDFs to HTML

All of these utilities support the `--help` option to print usage information.

You may try `pdftotext` first to extract text from a PDF, but in documents with complex layouts, drawings or complex tables the output can be garbled.  In that case, you may want to try rendering the pages to images with `pdftoppm` or `pdftocairo`, and then using the read tool to read the text from the resulting images.

Most of these utilities support targeting individual pages of the input PDF using the `-f` (first) and `-l` (last) options.  For example, to target only the first page `-f 1 -l 1`.

Use `-r 200` for DPI when rendering (default is 72 which can be too low for reliable text reading). Higher than 200 rarely helps and just produces larger files.

After extracting text, you can use the `cat` command to read the text output.  After rendering pages to images with `pdftoppm`/`pdftocairo`, use the Read tool to view them.
