/* MD / HTML -> PDF Studio
 * UI shell + markdown/HTML sanitation. All PDF layout and generation lives in
 * pdfFromHtml.js, loaded as a classic script before this file.
 */
(function () {
  'use strict';

  // UI margin presets -> PDF points. Each theme preset uses a different one.
  const MARGINS = {
    narrow:  { top: 36, right: 36, bottom: 36, left: 36 },
    compact: { top: 44, right: 44, bottom: 48, left: 44 },
    normal:  { top: 62, right: 57, bottom: 68, left: 57 },
    relaxed: { top: 68, right: 64, bottom: 72, left: 64 },
    wide:    { top: 72, right: 72, bottom: 72, left: 72 }
  };

  // Font sources. Math/Indic faces are always available; the base family is
  // chosen per theme. No monospace face is loaded — code uses the base font.
  const FONT_BASE = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/';
  const LATO = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lato/';
  const NOTO_SERIF = FONT_BASE + 'NotoSerif/';
  const POPPINS = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/';
  const KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/fonts/';
  const EMOJI = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notoemoji/';

  const COMMON_FONTS = {
    // Noto Sans Bengali triggers a fontkit GPOS crash on conjuncts such as
    // র্বা; Noto Serif Bengali shapes the same text correctly.
    bn: FONT_BASE + 'NotoSerifBengali/NotoSerifBengali-Regular.ttf',
    bnBold: FONT_BASE + 'NotoSerifBengali/NotoSerifBengali-SemiBold.ttf',
    hi: FONT_BASE + 'NotoSerifDevanagari/NotoSerifDevanagari-Regular.ttf',
    hiBold: FONT_BASE + 'NotoSerifDevanagari/NotoSerifDevanagari-Bold.ttf',
    // Math: STIX Two Math for operators/symbols, KaTeX faces for upright
    // digits/text and italic variables. All are real embedded vector fonts.
    math: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/stixtwomath/STIXTwoMath-Regular.ttf',
    mathText: KATEX + 'KaTeX_Main-Regular.ttf',
    mathTextBold: KATEX + 'KaTeX_Main-Bold.ttf',
    mathItalic: KATEX + 'KaTeX_Math-Italic.ttf',
    // Monochrome Noto Emoji: real vector glyphs that pdf-lib/fontkit can embed.
    emoji: EMOJI + 'NotoEmoji%5Bwght%5D.ttf'
  };

  // Base families available to theme presets.
  const BASE_FONTS = {
    sans: {
      sans: LATO + 'Lato-Regular.ttf',
      sansItalic: LATO + 'Lato-Italic.ttf',
      sansBold: LATO + 'Lato-Bold.ttf',
      sansBoldItalic: LATO + 'Lato-BoldItalic.ttf'
    },
    geometric: {
      geometric: POPPINS + 'Poppins-Regular.ttf',
      geometricItalic: POPPINS + 'Poppins-Italic.ttf',
      geometricBold: POPPINS + 'Poppins-Bold.ttf',
      geometricBoldItalic: POPPINS + 'Poppins-BoldItalic.ttf'
    }
  };

  // Every preset is an exact Mint Deck clone (same Poppins font, size, spacing
  // and margins) with its own palette. Presets with colouredHeadings also tint
  // H1-H3 and the blockquote bar with their palette colour.
  const THEMES = {
    mint: {
      label: 'Mint Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#0f766e', justify: false, runningHead: true
    },
    navydeck: {
      label: 'Navy Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#0b2545', justify: false, runningHead: true
    },
    olivedeck: {
      label: 'Olive Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#6a5e44', justify: false, runningHead: true, coloredHeadings: true
    },
    pinkdeck: {
      label: 'Pink Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#be185d', justify: false, runningHead: true, coloredHeadings: true
    },
    violetdeck: {
      label: 'Violet Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#6d28d9', justify: false, runningHead: true, coloredHeadings: true
    },
    indigodeck: {
      label: 'Indigo Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#4338ca', justify: false, runningHead: true, coloredHeadings: true
    },
    tealdeck: {
      label: 'Teal Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#115e59', justify: false, runningHead: true, coloredHeadings: true
    },
    lightgraydeck: {
      label: 'Light Gray Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#6b7280', justify: false, runningHead: true, coloredHeadings: true
    },
    lightblackdeck: {
      label: 'Light Black Deck', fontFamily: 'geometric', fontSize: 10,
      lineHeight: 1.68, paragraphGap: 11, margin: 'relaxed',
      primary: '#27272a', justify: false, runningHead: true, coloredHeadings: true
    }
  };

  function fontsForTheme(fontFamily) {
    return Object.assign({}, COMMON_FONTS, BASE_FONTS[fontFamily] || BASE_FONTS.sans);
  }

  function mix(a, b, t) {
    const ca = String(a).replace('#', '');
    const cb = String(b).replace('#', '');
    const part = (i) => Math.round(
      parseInt(ca.substr(i, 2), 16) * (1 - t) + parseInt(cb.substr(i, 2), 16) * t
    ).toString(16).padStart(2, '0');
    return '#' + part(0) + part(2) + part(4);
  }

  // Links are the same GitHub-style light blue in every theme; the font and all
  // other typography stay exactly as they are.
  const LINK_COLOR = '#58a6ff';

  // Tint the neutral white/light-gray surfaces with the theme's primary colour.
  // Tables use a darkened shade of the theme colour for the header and light borders on white rows.
  function themeColors(primary, themeKey) {
    const p = /^#[0-9a-f]{6}$/i.test(primary || '') ? primary : THEMES.mint.primary;
    // Presets marked colouredHeadings tint H1-H3 with their palette colour;
    // Mint and Navy keep the neutral heading colour. The quote bar always
    // follows the active theme colour.
    const colorHeadings = !!(THEMES[themeKey] && THEMES[themeKey].coloredHeadings);
    return {
      background: '#ffffff',
      surface: mix(p, '#ffffff', 0.94),
      surfaceAlt: mix(p, '#ffffff', 0.88),
      text: '#1f2328',
      heading: '#1f2328',
      headingEmphasis: colorHeadings ? p : '#1f2328',
      muted: '#656d76',
      accent: p,
      quoteBar: p,
      border: mix(p, '#ffffff', 0.78),
      link: LINK_COLOR,
      quoteText: '#3a4048',
      codeBg: '#f3f6f9',
      codeBorder: '#d8dee4',
      codeFg: '#2b3440',
      inlineCodeBg: mix(p, '#ffffff', 0.90),
      mark: mix(p, '#ffffff', 0.84),
      tableHeaderBg: mix(p, '#000000', 0.35),
      tableHeaderText: '#ffffff',
      tableRowBg: '#ffffff',
      tableStripeBg: mix(p, '#ffffff', 0.965),
      tableBorder: '#c6cacf',
      tableRowBorder: '#e3e7ec'
    };
  }

  const SAMPLE_MD = [
    '# Quarterly Report',
    '',
    '**Built in the browser.** The PDF on the right is real text — selectable, searchable, and small.',
    '',
    '## Highlights',
    '',
    '- Text is drawn with PDF text operators, not screenshots',
    '- Fonts are subset, so only the glyphs you use are embedded',
    '- বাংলা and English work side by side',
    '',
    '> Tip: switch to the **HTML** tab to paste your own markup.',
    '',
    '### Numbers',
    '',
    '| Item | Q1 | Q2 |',
    '| --- | ---: | ---: |',
    '| Revenue | 12,400 | 18,900 |',
    '| Costs | 7,100 | 9,300 |',
    '',
    '```js',
    'const sum = (a, b) => a + b;',
    'console.log(sum(2, 3));',
    '```',
    '',
    '[Example link](https://example.com)',
    '',
    '<!-- page-break -->',
    '## Page two',
    '',
    'Bengali conjuncts are shaped by fontkit: ক্ষ, জ্ঞ, শ্র — with a Bengali font subset embedded.'
  ].join('\n');

  const SAMPLE_HTML = [
    '<h1>HTML input</h1>',
    '<p>This pane accepts sanitized <strong>HTML</strong> directly. It is converted to the same block model as Markdown.</p>',
    '<h2>A list</h2>',
    '<ul><li>One</li><li>Two</li><li>Three</li></ul>',
    '<blockquote>Nothing is uploaded — generation happens locally.</blockquote>',
    '<pre><code>const answer = 42;</code></pre>',
    '<p style="text-align: right">Right aligned paragraph</p>'
  ].join('\n');

  const $ = (id) => document.getElementById(id);
  // localStorage can be unavailable for file:// pages in some browsers.
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } }
  };

  // ---------- state & DOM ----------
  const savedMode = store.get('mdpdf:mode');
  const state = {
    mode: ['html', 'markdown', 'url'].indexOf(savedMode) >= 0 ? savedMode : 'markdown',
    theme: 'mint',
    fontFamily: THEMES.mint.fontFamily,
    primary: THEMES.mint.primary,
    lineHeight: THEMES.mint.lineHeight,
    paragraphGap: THEMES.mint.paragraphGap,
    justify: THEMES.mint.justify,
    runningHead: THEMES.mint.runningHead,
    fontSize: THEMES.mint.fontSize,
    pageSize: 'A4',
    margin: THEMES.mint.margin,
    pageNumbers: true,
    autoToc: false,
    footerText: '',
    watermark: ''
  };

  const editor = $('editor');
  const frame = $('pdfFrame');
  const overlay = $('overlay');
  const statusEl = $('status');
  const countsEl = $('counts');
  const downloadBtn = $('downloadBtn');

  let currentUrl = null;
  let busy = false;
  let pending = false;

  // ---------- helpers ----------
  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.className = isError ? 'text-danger' : 'text-muted';
  }

  function showOverlay(show) {
    overlay.classList.toggle('hidden', !show);
  }

  // ---------- UTF-8-safe base64 URL payload ----------
  // Same codec as LPrinter: TextEncoder -> chunked btoa, and atob -> TextDecoder.
  function utf8ToBase64(str) {
    const utf8Bytes = new TextEncoder().encode(String(str));
    let binaryString = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
      const chunk = utf8Bytes.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binaryString);
  }

  function base64ToUtf8(str) {
    const binaryString = atob(str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  // Expose the codec so a URL can be built from the browser console:
  // QPrinterCodec.utf8ToBase64('<h1>Hi</h1>')
  window.QPrinterCodec = { utf8ToBase64: utf8ToBase64, base64ToUtf8: base64ToUtf8 };

  const URL_KEYS = ['html', 'data', 'content', 'b64', 'base64', 'htmlbase64'];
  const FRAGMENT_KEY_RE = /^\s*(?:html|data|content|b64|base64|htmlbase64)\s*=/i;

  function normalizeBase64(value) {
    let s = String(value || '').replace(/ /g, '+').replace(/[\r\n\t]+/g, '');
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return s;
  }

  function base64FromLocation() {
    const fragment = location.hash.replace(/^#/, '');
    if (fragment) {
      if (FRAGMENT_KEY_RE.test(fragment)) {
        const hashParams = new URLSearchParams(fragment);
        for (const [key, value] of hashParams.entries()) {
          if (URL_KEYS.indexOf(key.toLowerCase()) >= 0 && value) return value;
        }
      }
      if (/^[A-Za-z0-9+/\-_=\s]+$/.test(fragment)) return fragment;
    }
    const params = new URLSearchParams(location.search);
    for (const [key, value] of params.entries()) {
      if (URL_KEYS.indexOf(key.toLowerCase()) >= 0 && value) return value;
    }
    return '';
  }

  function paramValue(params, names) {
    for (const name of names) {
      if (params.has(name)) return params.get(name);
    }
    return null;
  }

  function parseBool(value, fallback) {
    if (value === null) return fallback;
    const v = value.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
    if (v === '0' || v === 'false' || v === 'no' || v === 'off' || v === '') return false;
    return fallback;
  }

  function applyUrlOptions() {
    const params = new URLSearchParams(location.search);

    const filename = paramValue(params, ['filename', 'name']);
    if (filename !== null && filename.trim()) $('filename').value = filename.trim();

    const theme = paramValue(params, ['theme']);
    if (theme && THEMES[theme.trim().toLowerCase()]) applyTheme(theme.trim().toLowerCase());

    const pageSize = paramValue(params, ['page_size', 'pagesize', 'size']);
    if (pageSize) {
      const v = pageSize.trim().toLowerCase();
      if (v === 'a4') $('pageSize').value = 'A4';
      else if (v === 'letter') $('pageSize').value = 'Letter';
    }

    $('pageNumbers').checked = parseBool(
      paramValue(params, ['page_number', 'page_numbers', 'pagenumber', 'pagenumbers']),
      $('pageNumbers').checked
    );
    $('autoToc').checked = parseBool(
      paramValue(params, ['toc', 'auto_toc', 'autotoc', 'table_of_contents']),
      $('autoToc').checked
    );

    const footer = paramValue(params, ['footer', 'footer_text', 'footertext']);
    if (footer !== null) $('footerText').value = footer;
    const watermark = paramValue(params, ['watermark']);
    if (watermark !== null) $('watermark').value = watermark;
  }

  function applyUrlSource() {
    const payload = base64FromLocation();
    if (!payload) return false;

    let html;
    try {
      html = base64ToUtf8(normalizeBase64(payload));
    } catch (err) {
      console.warn('Ignoring invalid URL HTML payload.', err);
      setStatus('Error: invalid HTML payload in URL', true);
      return false;
    }
    if (!html.trim()) return false;

    // Put the decoded markup in the HTML editor, not behind another fetch.
    store.set(sourceKey('html'), html);
    setMode('html');
    setStatus('Loaded HTML from URL · Ctrl+Enter to render');
    return true;
  }

  function applyUrlConfig() {
    applyUrlOptions();
    applyUrlSource();
  }

  // Apply a preset to the style state used by the renderer. Presets own the
  // font size and margin, so there is no separate custom mode.
  function applyTheme(id) {
    const theme = THEMES[id] || THEMES.mint;
    state.theme = THEMES[id] ? id : 'mint';
    state.fontFamily = theme.fontFamily;
    state.primary = theme.primary;
    state.lineHeight = theme.lineHeight;
    state.paragraphGap = theme.paragraphGap;
    state.justify = theme.justify;
    state.runningHead = theme.runningHead;
    state.fontSize = theme.fontSize;
    state.margin = theme.margin;
    $('theme').value = state.theme;
  }

  // If a CDN script failed, fail visibly instead of leaving the spinner up.
  var missing = [];
  if (typeof pdfFromHtml !== 'function') missing.push('pdfFromHtml.js');
  if (typeof PDFLib === 'undefined') missing.push('pdf-lib');
  if (typeof fontkit === 'undefined') missing.push('fontkit');
  if (typeof marked === 'undefined') missing.push('marked');
  if (typeof DOMPurify === 'undefined') missing.push('DOMPurify');
  if (missing.length) {
    showOverlay(false);
    downloadBtn.disabled = true;
    setStatus('Error: failed to load ' + missing.join(', ') + ' (check internet connection)', true);
    return;
  }

  // Markdown -> HTML (or sanitize raw HTML). Page-break markers become a
  // class the pdfFromHtml block parser recognises.
  function toHTML(source, mode) {
    if (mode === 'html') {
      return DOMPurify.sanitize(source, { ADD_ATTR: ['align', 'style', 'type', 'checked', 'disabled'] });
    }
    const withBreaks = source
      .replace(/<!--\s*(?:page-?break|new-?page)\s*-->/gi, '<div class="pdf-page-break"></div>\n\n')
      .replace(/^\\(?:new|clear)?page\s*$/gim, '<div class="pdf-page-break"></div>\n\n');
    // Markdown treats \[ \] \( \) as escaped punctuation and drops the
    // backslash. Also, `breaks: true` turns newlines inside display math into
    // <br> elements, which would split the expression across text nodes.
    const withMathBlocks = withBreaks
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => '\\[' + expr.replace(/\s+/g, ' ') + '\\]')
      .replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => '$$' + expr.replace(/\s+/g, ' ') + '$$');
    const withMathDelims = withMathBlocks.replace(/\\([\[\]()])/g, '\\\\$1');
    let raw = marked.parse(withMathDelims, { gfm: true, breaks: true });
    // Markdown-style heading anchors: "## Title {#target}" -> <h2 id="target">
    raw = raw.replace(/<h([1-6])>([\s\S]*?)\{([^{}]+)\}<\/h\1>/g, (m, level, content, attrs) => {
      const id = String(attrs).trim().match(/^#([\w-]+)$/);
      if (!id) return m;
      return '<h' + level + ' id="' + id[1] + '">' + content.replace(/\s+$/, '') + '</h' + level + '>';
    });
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['align', 'style'] });
  }

  // ---------- URL source ---------------------------------------------------
  const SOURCE_KEYS = {
    markdown: 'mdpdf:source',
    html: 'mdpdf:html-source',
    url: 'mdpdf:url-source'
  };

  function sourceKey(mode) { return SOURCE_KEYS[mode] || SOURCE_KEYS.markdown; }

  function defaultSource(mode) {
    if (mode === 'html') return SAMPLE_HTML;
    if (mode === 'url') return 'https://example.com';
    return SAMPLE_MD;
  }

  function updateEditorChrome(mode) {
    const labels = {
      markdown: 'Markdown source',
      html: 'HTML source',
      url: 'Web page URL'
    };
    const placeholders = {
      markdown: 'Start typing your document…',
      html: 'Paste HTML…',
      url: 'https://example.com/article'
    };
    editor.setAttribute('aria-label', labels[mode] || labels.markdown);
    editor.placeholder = placeholders[mode] || placeholders.markdown;
  }

  function normalizePageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) throw new Error('Enter a web page URL.');
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw;
    const parsed = new URL(candidate);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('Only http(s) URLs are supported.');
    return parsed.href;
  }

  async function fetchText(url, timeoutMs, headers) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
        headers: headers || {}
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.text();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('image read failed'));
      reader.readAsDataURL(blob);
    });
  }

  async function fetchImageBlob(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const blob = await response.blob();
      if (!blob.size) throw new Error('empty image');
      return blob;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function imageProxyUrls(url) {
    const target = String(url).replace(/^https?:\/\//i, '');
    return [
      'https://images.weserv.nl/?url=' + encodeURIComponent(target),
      'https://wsrv.nl/?url=' + encodeURIComponent(target)
    ];
  }

  function srcsetUrls(value) {
    return String(value || '').split(',').map((part) => {
      const bits = part.trim().split(/\s+/);
      const descriptor = bits[1] || '';
      const score = /^\d+w$/.test(descriptor) ? parseInt(descriptor, 10) : parseFloat(descriptor) || 1;
      return { url: bits[0], score: score };
    }).filter((item) => item.url).sort((a, b) => b.score - a.score).map((item) => item.url);
  }

  function bestImageUrl(img, baseUrl) {
    const urls = [];
    const parent = img.parentElement;
    if (parent && parent.tagName === 'PICTURE') {
      Array.from(parent.querySelectorAll('source[srcset]')).forEach((source) => {
        srcsetUrls(source.getAttribute('srcset')).forEach((u) => urls.push(u));
      });
    }
    srcsetUrls(img.getAttribute('srcset')).forEach((u) => urls.push(u));
    srcsetUrls(img.getAttribute('data-srcset')).forEach((u) => urls.push(u));
    ['data-src', 'data-lazy-src', 'data-original', 'data-url', 'src'].forEach((attr) => {
      const value = img.getAttribute(attr);
      if (value) urls.push(value);
    });

    for (const raw of urls) {
      if (!raw) continue;
      if (/^data:/i.test(raw)) return raw;
      try { return new URL(raw, baseUrl).href; } catch (e) { /* try the next candidate */ }
    }
    return '';
  }

  function imageBytesLookReal(blob) {
    if (/^image\//i.test(blob.type)) return true;
    return blob.slice(0, 12).arrayBuffer().then((buffer) => {
      const b = new Uint8Array(buffer);
      const head = String.fromCharCode.apply(null, b.subarray(0, 5));
      return (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ||
        (b[0] === 0xff && b[1] === 0xd8) ||
        (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) ||
        head === '<?xml' || head === '<svg ';
    }).catch(() => false);
  }

  // Inline images as data URLs. The renderer can embed those directly, so a
  // page whose image host disallows CORS at draw time still keeps its pictures.
  async function inlineImages(doc, baseUrl) {
    const images = Array.from(doc.querySelectorAll('img')).slice(0, 30);
    let cursor = 0;
    let total = 0;
    const maxBytes = 15 * 1024 * 1024;
    const lazyAttrs = ['data-src', 'data-lazy-src', 'data-original', 'data-url', 'srcset', 'data-srcset'];

    async function inlineOne(img) {
      const url = bestImageUrl(img, baseUrl);
      if (!url) return;
      if (/^data:/i.test(url)) {
        img.setAttribute('src', url);
        lazyAttrs.forEach((attr) => img.removeAttribute(attr));
        return;
      }

      let blob = null;
      try {
        blob = await fetchImageBlob(url, 10000);
      } catch (directErr) {
        for (const proxy of imageProxyUrls(url)) {
          try {
            const candidate = await fetchImageBlob(proxy, 12000);
            if (await imageBytesLookReal(candidate)) { blob = candidate; break; }
          } catch (proxyErr) { /* try the next proxy */ }
        }
      }
      if (!blob || !(await imageBytesLookReal(blob))) return;
      if (!blob.type) blob = blob.slice(0, blob.size, 'image/png');
      if (total + blob.size > maxBytes) return;
      total += blob.size;
      img.setAttribute('src', await blobToDataUrl(blob));
      lazyAttrs.forEach((attr) => img.removeAttribute(attr));
    }

    async function worker() {
      while (cursor < images.length) {
        const img = images[cursor++];
        try { await inlineOne(img); } catch (e) { /* keep the original URL */ }
      }
    }

    await Promise.all(Array.from({ length: Math.min(6, images.length) }, worker));
  }

  function textLength(el) {
    return (el.textContent || '').replace(/\s+/g, '').length;
  }

  // Images nested in a text paragraph are rendered as caption text by the PDF
  // block parser. Move them beside the paragraph so they become real figures.
  function hoistInlineImages(root) {
    function unwrap(img) {
      const parent = img.parentElement;
      return parent && parent.tagName === 'A' && !parent.textContent.replace(/\s/g, '') ? parent : img;
    }
    Array.from(root.querySelectorAll('p,div,figcaption')).forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (el.closest('table')) return;
      if (tag !== 'figcaption' && el.querySelector('p,div,table,ul,ol')) return;
      Array.from(el.querySelectorAll('img')).forEach((img) => {
        if (el.parentNode) el.parentNode.insertBefore(unwrap(img), el);
      });
    });
    // Table cells are parsed as inline text, so move their pictures out too.
    Array.from(root.querySelectorAll('table')).forEach((table) => {
      Array.from(table.querySelectorAll('img')).forEach((img) => {
        if (table.parentNode) table.parentNode.insertBefore(unwrap(img), table);
      });
    });
  }

  // Prefer the article/body region over site chrome. Without this, pages such
  // as Wikipedia produce dozens of pages of menus and language lists.
  function pickContentRoot(doc) {
    const selectors = [
      '#mw-content-text', 'article', '[role="main"]', 'main',
      '.entry-content', '.post-content', '.article-content', '.article-body',
      '.article', '#main', '#content', '.content'
    ];
    for (const selector of selectors) {
      const candidates = Array.from(doc.querySelectorAll(selector)).filter((el) => textLength(el) > 150);
      if (candidates.length) {
        return candidates.reduce((best, el) => textLength(el) > textLength(best) ? el : best);
      }
    }
    return doc.body;
  }

  const FETCHED_HTML_CONFIG = {
    ADD_ATTR: ['align', 'style', 'type', 'checked', 'disabled'],
    ADD_DATA_URI_TAGS: ['img']
  };

  // Turn a fetched page into the same sanitized HTML the HTML tab produces.
  // Relative image/link URLs are resolved against the page so images can load.
  async function prepareFetchedHtml(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = ((doc.querySelector('title') || {}).textContent || '').trim();

    const root = pickContentRoot(doc);

    // Some sites hide the real article image inside <noscript>. Parsing that
    // markup keeps the picture while the script/style removal below still runs.
    Array.from(root.querySelectorAll('noscript')).forEach((el) => {
      const fragment = doc.createDocumentFragment();
      const parsed = new DOMParser().parseFromString(el.innerHTML || el.textContent || '', 'text/html');
      while (parsed.body.firstChild) fragment.appendChild(parsed.body.firstChild);
      el.replaceWith(fragment);
    });
    root.querySelectorAll('script,style,iframe,object,embed,form,button,input,select,textarea,' +
      'nav,[role="navigation"],.nav,.navigation,.sidebar,.site-header,.site-footer,' +
      '.comments,.related,.advert,.ad,[aria-hidden="true"]').forEach((el) => el.remove());
    root.querySelectorAll('header,footer,aside').forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
    root.querySelectorAll('img').forEach((img) => {
      const w = parseInt(img.getAttribute('width'), 10) || 0;
      const h = parseInt(img.getAttribute('height'), 10) || 0;
      if (w && h && w <= 2 && h <= 2) { img.remove(); return; }
      const best = bestImageUrl(img, baseUrl);
      if (best) img.setAttribute('src', best);
      img.removeAttribute('srcset');
      img.removeAttribute('data-srcset');
    });
    hoistInlineImages(root);
    root.querySelectorAll('[src],[href]').forEach((el) => {
      ['src', 'href'].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (!value || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(value)) return;
        try { el.setAttribute(attr, new URL(value, baseUrl).href); } catch (e) { /* keep raw */ }
      });
    });

    const firstPass = DOMPurify.sanitize(root.innerHTML, FETCHED_HTML_CONFIG);
    const cleanDoc = new DOMParser().parseFromString(firstPass, 'text/html');
    if (title && !cleanDoc.querySelector('h1,h2')) {
      const heading = cleanDoc.createElement('h1');
      heading.textContent = title;
      cleanDoc.body.insertBefore(heading, cleanDoc.body.firstChild);
    }

    await inlineImages(cleanDoc, baseUrl);
    return {
      html: DOMPurify.sanitize(cleanDoc.body.innerHTML, FETCHED_HTML_CONFIG),
      title: title
    };
  }

  function parseReaderMarkdown(text) {
    const content = String(text || '');
    const titleMatch = /^Title:\s*(.*(?:\r?\n|$))/i.exec(content);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const markdown = content
      .replace(/^(?:Title|URL Source|Published Time):.*(?:\r?\n|$)/gim, '')
      .replace(/^Markdown Content:\s*(?:\r?\n)?/im, '')
      .trim();
    return { markdown: markdown, title: title };
  }

  function htmlHeading(text) {
    const holder = document.createElement('div');
    holder.textContent = String(text || '').trim();
    return holder.innerHTML;
  }

  // Public reader fallback for sites that block cross-origin fetches. The
  // readable Markdown drops site chrome while keeping article text, tables and
  // image URLs; those images are then inlined by prepareFetchedHtml().
  async function fetchUrlSource(value) {
    const url = normalizePageUrl(value);
    try {
      const html = await fetchText(url, 15000);
      const prepared = await prepareFetchedHtml(html, url);
      if (!prepared.html.replace(/\s/g, '')) throw new Error('empty document');
      return { html: prepared.html, title: prepared.title, via: 'html' };
    } catch (directErr) {
      const readerUrl = 'https://r.jina.ai/' + url;
      let readerText;
      try {
        readerText = await fetchText(readerUrl, 25000);
      } catch (readerErr) {
        throw new Error('Could not load page (' + directErr.message + '; reader: ' + readerErr.message + ')');
      }
      const reader = parseReaderMarkdown(readerText);
      if (!reader.markdown) throw new Error('Could not extract readable content from the page.');

      const prepared = await prepareFetchedHtml(toHTML(reader.markdown, 'markdown'), url);
      if (!prepared.html.replace(/\s/g, '')) throw new Error('Could not extract readable content from the page.');
      if (reader.title && !/<h1[\s>]/i.test(prepared.html)) {
        prepared.html = '<h1>' + htmlHeading(reader.title) + '</h1>' + prepared.html;
      }
      return { html: prepared.html, title: reader.title || prepared.title, via: 'reader' };
    }
  }

  async function htmlForMode() {
    if (state.mode === 'url') return fetchUrlSource(editor.value);
    return { html: toHTML(editor.value, state.mode), title: '', via: 'source' };
  }

  // ---------- PDF generation via pdfFromHtml ----------
  async function generate() {
    if (busy) {
      // Options changed while a PDF was being built: queue one more pass so
      // the preview always ends up matching the current controls.
      pending = true;
      return;
    }
    busy = true;
    showOverlay(true);

    try {
      const source = await htmlForMode();

      state.pageSize = $('pageSize').value;
      state.pageNumbers = $('pageNumbers').checked;
      state.autoToc = $('autoToc').checked;
      state.footerText = $('footerText').value.trim();
      state.watermark = $('watermark').value.trim();

      // Everything about the output is passed in as options — no layout code
      // remains in this file.
      const pdfOptions = {
        name: $('filename').value || 'document',
        pageSize: state.pageSize,
        margin: MARGINS[state.margin] || MARGINS.normal,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        paragraphGap: state.paragraphGap,
        justify: state.justify,
        runningHead: state.runningHead,
        fontFamily: state.fontFamily,
        pageNumbers: state.pageNumbers,
        autoToc: state.autoToc,
        footerText: state.footerText,
        watermark: state.watermark,
        colors: themeColors(state.primary, state.theme),
        fonts: fontsForTheme(state.fontFamily)
      };
      if (source.title) pdfOptions.title = source.title;
      const pdf = new pdfFromHtml(pdfOptions);

      await pdf.convert(source.html);
      const blob = await pdf.toBlob();

      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = URL.createObjectURL(blob);
      frame.src = currentUrl + '#view=FitH&toolbar=1';
      downloadBtn.disabled = false;

      const sizeKB = blob.size < 1024 * 1024
        ? (blob.size / 1024).toFixed(1) + ' KB'
        : (blob.size / 1024 / 1024).toFixed(2) + ' MB';
      setStatus(sizeKB + ' · ' + pdf.pageCount + ' page(s)' + pdf.fontWarning);

      store.set('mdpdf:options', JSON.stringify({
        theme: state.theme,
        fontFamily: state.fontFamily,
        primary: state.primary,
        lineHeight: state.lineHeight,
        paragraphGap: state.paragraphGap,
        justify: state.justify,
        runningHead: state.runningHead,
        fontSize: state.fontSize,
        pageSize: state.pageSize,
        margin: state.margin,
        pageNumbers: state.pageNumbers,
        autoToc: state.autoToc,
        footerText: state.footerText,
        watermark: state.watermark
      }));
    } catch (err) {
      console.error(err);
      setStatus('Error: ' + err.message, true);
    } finally {
      busy = false;
      showOverlay(false);
      if (pending) {
        pending = false;
        generate();
      }
    }
  }

  // Rendering is explicit: edits are staged locally and the preview is rebuilt
  // only on Ctrl+Enter (Cmd+Enter) or when the Refresh button is clicked.
  function markDirty() {
    setStatus('Ready to render · Ctrl+Enter', false);
  }

  function stageSource() {
    countsEl.textContent = (editor.value.trim() ? editor.value.trim().split(/\s+/).length : 0).toLocaleString() +
      ' words · ' + editor.value.length.toLocaleString() + ' characters';
    store.set(sourceKey(state.mode), editor.value);
    markDirty();
  }

  // ---------- UI wiring ----------
  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
      btn.setAttribute('aria-selected', String(btn.dataset.mode === mode));
    });
    store.set('mdpdf:mode', mode);
    const stored = store.get(sourceKey(mode));
    editor.value = stored !== null ? stored : defaultSource(mode);
    updateEditorChrome(mode);
    stageSource();
  }

  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.set(sourceKey(state.mode), editor.value);
      setMode(btn.dataset.mode);
    });
  });

  editor.addEventListener('input', stageSource);

  $('sampleBtn').addEventListener('click', () => {
    editor.value = defaultSource(state.mode);
    stageSource();
  });

  $('clearBtn').addEventListener('click', () => {
    if (window.confirm('Clear the editor?')) {
      editor.value = '';
      stageSource();
    }
  });

  $('refreshBtn').addEventListener('click', generate);

  // A new base64 fragment (or history navigation) replaces the HTML editor
  // contents and reapplies any PDF options carried in the query string.
  window.addEventListener('hashchange', applyUrlConfig);
  window.addEventListener('popstate', applyUrlConfig);

  // Manual render shortcut. Works while editing the source or changing any
  // setting, so there is no need to move focus back to the Refresh button.
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      generate();
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!currentUrl) return;
    const name = ($('filename').value || 'document').replace(/\.pdf$/i, '') + '.pdf';
    const a = document.createElement('a');
    a.href = currentUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  $('theme').addEventListener('change', () => {
    applyTheme($('theme').value);
    markDirty();
  });

  ['pageSize', 'pageNumbers', 'autoToc', 'filename', 'footerText', 'watermark'].forEach((id) => {
    $(id).addEventListener('input', markDirty);
    $(id).addEventListener('change', markDirty);
  });

  // restore
  let savedOptions = {};
  try {
    savedOptions = JSON.parse(store.get('mdpdf:options') || '{}') || {};
  } catch (err) {
    console.warn('Ignoring invalid saved options.', err);
  }
  applyTheme(THEMES[savedOptions.theme] ? savedOptions.theme : 'mint');
  if (savedOptions.pageSize) $('pageSize').value = savedOptions.pageSize;
  if (typeof savedOptions.pageNumbers === 'boolean') $('pageNumbers').checked = savedOptions.pageNumbers;
  if (typeof savedOptions.autoToc === 'boolean') $('autoToc').checked = savedOptions.autoToc;
  if (typeof savedOptions.footerText === 'string') $('footerText').value = savedOptions.footerText;
  if (typeof savedOptions.watermark === 'string') $('watermark').value = savedOptions.watermark;

  const restored = store.get(sourceKey(state.mode));
  editor.value = restored !== null ? restored : defaultSource(state.mode);
  updateEditorChrome(state.mode);
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === state.mode);
    btn.setAttribute('aria-selected', String(btn.dataset.mode === state.mode));
  });

  // A URL payload wins over the restored draft: decode it into the HTML editor.
  applyUrlConfig();

  countsEl.textContent = (editor.value.trim() ? editor.value.trim().split(/\s+/).length : 0).toLocaleString() +
    ' words · ' + editor.value.length.toLocaleString() + ' characters';

  generate();
})();
