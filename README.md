# QPrinter 

**MD / HTML / URL → PDF Studio**

A tiny browser-only tool: write **Markdown**, paste **HTML**, or enter a **web page URL**
on the left, see the **rendered PDF** on the right, and download it. Vanilla JS with a
GitHub-inspired UI.

## Run

Open `index.html` directly in a modern browser — no build step or local server
is required. The scripts are plain classic scripts, so `file://` works.

If you prefer a local server:

```bash
cd md-pdf-studio
python3 -m http.server 8080
# visit http://localhost:8080
```

An internet connection is needed on first load for the CDN libraries and the
optional embedded font files. If a CDN is blocked, the page shows an explicit
error instead of staying on the “Building PDF…” spinner.

## How it works

1. Markdown → `marked.parse()` → sanitized HTML. HTML mode is sanitized directly
   with DOMPurify. URL mode fetches the page, removes scripts/styles, resolves
   relative URLs, inlines images and sanitizes the HTML; if the site blocks
   cross-origin requests, a public reader service provides clean Markdown, which
   is converted to the same block pipeline.
   Responsive/lazy-loaded images (including `srcset` and `<noscript>` images) are
   promoted to `src`, fetched directly when possible, then retried through a
   public image proxy when the image host blocks CORS. The page title is added
   as a heading when the fetched markup has none.
   `<!-- page-break -->` becomes a `pdf-page-break` element.
2. `app.js` passes that HTML, plus all options (filename, page size, margins,
   font size, page numbers, color theme, font URLs), to the `pdfFromHtml` class
   loaded from `pdfFromHtml.js`:
   ```js
   const pdf = new pdfFromHtml({ name: 'document', colors: {...}, fonts: {...} });
   await pdf.convert(html);
   const blob = await pdf.toBlob();
   ```
3. `pdfFromHtml.js` parses the HTML into a block model (headings, paragraphs,
   lists, quotes, code, tables, images, page breaks, sub/sup, inline and
   display math) and lays it out with `pdf-lib` — real, selectable text and
   vector shapes, never a screenshot. Code blocks use a larger 11 pt base-font
   size inside a neutral light-gray card with a thin gray border. Literal spaces
   and indentation are preserved, so copied shell snippets stay readable, and
   nested lists inside list items keep their own indented block layout. Links
   such as `[Section](#section-1)` become in-document GoTo actions; headings get
   automatic slugs, and `{#id}` or `<a id="...">` targets are honoured.
4. Theme presets apply a complete document style at once: base font family,
   font size, primary colour, line/paragraph spacing and page margin. Surfaces
   stay clean white/light-gray, tinted by the chosen primary colour; headings
   are flush-left, tables have a dark theme-coloured header, subtly striped
   white rows, and page numbers appear in the footer. Presets own every style value, so there
   is no separate custom mode.
5. Fonts are embedded with `subset: true`. Base families include **Lato**,
   **Noto Serif**, **Poppins** and **Crimson Text**. Code and table headers use
   the active base family — no monospace face is loaded. **STIX Two Math** handles
   operators/symbols and **KaTeX** Main/Math-Italic handles upright digits/text
   and variables. Monochrome **Noto Emoji** renders emoji in body text, footer
   text and watermarks as real vector glyphs (colour emoji fonts are not
   supported by `pdf-lib`). Noto Serif Bengali
   and Noto Serif Devanagari handle Indic conjuncts via fontkit. Math
   can be written as `$...$`, `$$...$$`, `\(...\)` or `\[...\]` (LaTeX-like
   commands such as `\text{...}` are understood) or as MathML; `<sub>` and
   `<sup>` are rendered as raised/lowered smaller text. If font downloads fail,
   built-in standard fonts are used with ASCII math fallbacks.
6. The resulting `Blob` is shown in the iframe preview and used for the download.

## Theme presets

Choose **Theme template** in the preview footer. Mint Deck is the default and
the reference look; the other presets are modern variants with their own font
family, size, primary colour, spacing and margin. Only the selected base face is
embedded.

| Preset | Base font | Size | Primary | Spacing (line / paragraph) | Margin |
| --- | --- | --- | --- | --- | --- |
| Mint Deck | Poppins (geometric) | 10 pt | Teal `#0f766e` | 1.68 / 11 | Relaxed |
| Slate Deck | Lato (sans) | 10.5 pt | Slate `#334155` | 1.6 / 10 | Normal |
| Navy Report | Noto Serif (serif) | 9.8 pt | Navy `#1f4e79` | 1.55 / 8 | Narrow |
| Navy Blue | Lato (sans) | 10.4 pt | Deep navy `#0b2545` | 1.62 / 9 | Compact |
| Ink Paper | Crimson Text (classic serif) | 11.2 pt | Graphite `#3f3f46` | 1.7 / 12 | Wide |
| Crimson Red | Crimson Text (classic serif) | 10.1 pt | Crimson `#a4161a` | 1.66 / 10 | Normal |

Each preset fully defines its font size and margin; there are no separate size,
margin, or custom controls.

All presets use the same clean table style: a dark header in the theme's primary
colour with white text, very subtly striped white body rows, a slightly stronger light-gray
outer border, and subtle lighter rules between rows.

## Files

- `index.html` — Primer-style layout, CDN scripts, classic `<script src="app.js">`
- `app.js` — UI state, markdown/HTML sanitation, options, and PDF generation via `pdfFromHtml`
- `pdfFromHtml.js` — standalone class: HTML → research-paper PDF (also exposes `window.pdfFromHtml`)
- `styles.css` — GitHub-inspired buttons, underline tabs, panels, forms and split-pane sizing

## Controls

- **Markdown / HTML / URL** tabs switch input format (each keeps its own draft).
  URL mode accepts a web address, fetches the page and builds the PDF from it.
  Blocked cross-origin requests fall back to a reader service; the original
  URL is never sent anywhere except the site itself and that reader.
- **Sample** and **Clear** above the editor.
- **Settings** (preview header) opens a left offcanvas with **Theme template**, **Page size**, **Filename**, **Page numbers**, **Insert table of contents**, **Footer text** and **Watermark**.
  - **Insert table of contents** adds a linked contents block after the first title/heading (or the first element when there is no heading). Entries come from the document headings.
  - **Footer text** prints at the bottom-left of every page; **Watermark** draws faint 30° diagonal text across every page. Leave either blank to disable it.
  - Settings changes rebuild the PDF after a 3-second pause; the editor uses a shorter 400 ms preview delay.
- **Download PDF** saves the exact blob shown in the preview.

To change the PDF colors or add more options, edit the `THEMES` object in
`app.js` or the `DEFAULTS` object in `pdfFromHtml.js`.

Images: `![alt](url)` in Markdown and `<img src="…">` in HTML are downloaded and
embedded into the PDF. PNG/JPEG are embedded directly; WebP/GIF/SVG are
normalised to PNG through the browser. `data:` URLs work too. Remote images need
CORS permission (or a same-origin/relative URL); if the browser cannot load one,
a labelled placeholder is written instead of failing the whole document. For
local files, serve the project over `http://localhost` and put images beside it.
