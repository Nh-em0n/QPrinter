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
5. Fonts are embedded with `subset: true`. All theme presets use **Poppins**;
   **Lato** remains the fallback base family. Code and table headers use
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

Choose **Theme template** in the settings drawer. **Navy Deck** is the default.
All nine presets are exact Mint Deck clones — same Poppins face, 10 pt size,
1.68/11 spacing and relaxed margins — with their own palette. Only the Poppins
face is embedded.

| Preset | URL value | Primary |
| --- | --- | --- |
| Mint Deck | `mint` | Teal `#0f766e` |
| Navy Deck | `navydeck` | Dark navy `#0b2545` |
| Olive Deck | `olivedeck` | Olive `#6a5e44` |
| Pink Deck | `pinkdeck` | Pink `#be185d` |
| Violet Deck | `violetdeck` | Violet `#6d28d9` |
| Indigo Deck | `indigodeck` | Indigo `#4338ca` |
| Teal Deck | `tealdeck` | Teal `#115e59` |
| Light Gray Deck | `lightgraydeck` | Gray `#6b7280` |
| Light Black Deck | `lightblackdeck` | Charcoal `#27272a` |

Mint and Navy keep neutral headings; the other seven presets colour H1–H3 and
the blockquote bar with their palette colour. Links are always GitHub-style
light blue (`#58a6ff`). All presets use the same clean table style: a dark
header in the theme's primary colour with white text, very subtly striped white
body rows, a slightly stronger light-gray outer border, and subtle lighter
rules between rows.

## URL payload and options

The HTML document can be supplied in the address bar instead of typed into the
editor. Put the UTF-8 base64 in the fragment (preferred, so the payload is not
sent to a server):

```
index.html#<base64>
index.html#html=<base64>
index.html?html=<base64>          # older fallback
```

Build one from the console with
`QPrinterCodec.utf8ToBase64('<h1>Hello</h1>')`. On load (or hash navigation)
the decoded markup is placed in the **HTML** tab editor; the URL tab still
fetches a web page URL as before.

Query options configure the PDF at the same time:

```
index.html?theme=olivedeck&filename=report&page_size=A4&page_number=false&toc=true&toc_index=false&footer=Confidential&watermark=DRAFT#<base64>
```

| Parameter | Aliases | Effect |
| --- | --- | --- |
| `filename` | `name` | Download filename (without `.pdf`) |
| `theme` | — | Any theme URL value from the table above |
| `page_size` | `pagesize`, `size` | `A4` or `Letter` |
| `page_number` | `page_numbers`, `pagenumber`, `pagenumbers` | Show page numbers |
| `toc` | `auto_toc`, `autotoc`, `table_of_contents` | Insert a table of contents |
| `toc_index` | `tocindex`, `index_toc`, `indextoc`, `toc_numbers`, `tocnumber` | Number TOC entries and show page indices (default `true`) |
| `footer` | `footer_text`, `footertext` | Footer text on every page |
| `watermark` | — | Faint diagonal watermark |

Booleans accept `true`/`1`/`yes`/`on` and `false`/`0`/`no`/`off`/empty.

## Files

- `index.html` — Primer-style layout, CDN scripts, classic `<script src="app.js">`
- `app.js` — UI state, markdown/HTML sanitation, options, and PDF generation via `pdfFromHtml`
- `pdfFromHtml.js` — standalone class: HTML → research-paper PDF (also exposes `window.pdfFromHtml`)
- `styles.css` — GitHub-inspired buttons, underline tabs, panels, forms and split-pane sizing

## Controls

- **Markdown / HTML / URL** tabs switch input format (each keeps its own draft).
  URL mode accepts a web address, fetches the page and builds the PDF from it.
  Blocked cross-origin requests fall back to a reader service; the original
  URL is never sent anywhere except the site itself and that reader. A base64
  HTML payload in the address bar instead fills the **HTML** tab directly.
- **Sample** and **Clear** above the editor.
- **Settings** (preview header) opens a left offcanvas with **Theme template**, **Page size**, **Filename**, **Page numbers**, **Insert table of contents**, **Index table of contents**, **Footer text** and **Watermark**.
  - **Insert table of contents** adds a linked contents block after the first title/heading (or the first element when there is no heading). Entries come from the document headings. **Index table of contents** (on by default) adds hierarchical `1.`, `1.1.` numbers and page indices, and lets a long contents list flow onto extra pages; turn it off for plain entries.
  - **Code blocks** are flat, borderless panels drawn one point smaller than body text with compact padding. Inline code uses pink text with no background.
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
