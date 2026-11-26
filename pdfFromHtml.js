/*!
 * pdfFromHtml — vanilla JS class
 * ---------------------------------------------------------------------------
 * Turns an HTML string OR a real DOM element (its .outerHTML) into a PDF that
 * is styled like a research paper: Lato body text, flush-left headings,
 * an abstract panel, page numbers and a soft light-gray palette. Text stays
 * real/selectable (powered by pdf-lib).
 *
 * Requires: pdf-lib on window.PDFLib (already used by this project).
 *
 * Usage
 *   const pdf = new pdfFromHtml({
 *     name: 'research-paper',
 *     title: 'A Study of ...',
 *     author: 'A. Researcher',
 *     colors: { surface: '#f2f2f2', accent: '#4a4a4a' }
 *   });
 *
 *   await pdf.convert(document.getElementById('paper')); // or an HTML string
 *   pdf.download();                 // saves research-paper.pdf
 *   const bytes = await pdf.toBytes();
 *   const blob  = await pdf.toBlob();
 *
 * Script tag:  <script src="pdfFromHtml.js"></script> (before app.js)
 * Global:      window.pdfFromHtml
 */
var pdfFromHtml = (function (global) {
  'use strict';

  var PAGE_SIZES = {
    A4: [595.28, 841.89],
    Letter: [612, 792],
    A5: [419.53, 595.28]
};

  // LaTeX-style commands that can be written with a single Unicode glyph.
  var MATH_SYMBOLS = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
    zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
    lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ',
    varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'φ',
    varphi: 'ϕ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
    Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
    times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', ast: '∗', star: '⋆',
    circ: '∘', bullet: '∙', oplus: '⊕', otimes: '⊗', wedge: '∧', vee: '∨',
    cap: '∩', cup: '∪', setminus: '∖', in: '∈', notin: '∉', ni: '∋',
    subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇', emptyset: '∅',
    varnothing: '∅', forall: '∀', exists: '∃', nexists: '∄', neg: '¬',
    lnot: '¬', therefore: '∴', because: '∵', perp: '⊥', angle: '∠',
    triangle: '△', degree: '°', prime: '′',
    le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈',
    sim: '∼', simeq: '≃', equiv: '≡', propto: '∝', ll: '≪', gg: '≫',
    to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔',
    Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', mapsto: '↦',
    uparrow: '↑', downarrow: '↓', updownarrow: '↕',
    infty: '∞', partial: '∂', nabla: '∇', sum: '∑', prod: '∏', coprod: '∐',
    int: '∫', iint: '∬', iiint: '∭', oint: '∮', sqrt: '√', surd: '√',
    aleph: 'ℵ', hbar: 'ℏ', ell: 'ℓ', wp: '℘', Re: 'ℜ', Im: 'ℑ',
    top: '⊤', bot: '⊥', vdash: '⊢', models: '⊨', parallel: '∥',
    nparallel: '∦', smile: '⌣', frown: '⌢',
    ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱'
  };

  // Commands that only change styling, not the text content.
  var MATH_STYLE_CMDS = {
    mathbb: true, mathcal: true, mathfrak: true, mathrm: true, mathbf: true,
    mathit: true, mathsf: true, mathtt: true, operatorname: true, text: true,
    textrm: true, textbf: true, textit: true, left: true, right: true,
    displaystyle: true, textstyle: true, scriptstyle: true, limits: true,
    nolimits: true, quad: true, qquad: true, ',': true, ';': true,
    ':': true, '!': true
  };

  // Used only when the math font cannot be downloaded.
  var MATH_ASCII = {
    '∑': 'sum', '∏': 'prod', '∐': 'coprod', '∫': 'int', '∬': 'iint',
    '∭': 'iiint', '∮': 'oint', '√': 'sqrt', '≤': '<=', '≥': '>=',
    '≠': '!=', '≈': '~=', '≡': '==', '≃': '~=', '∼': '~', '∝': 'prop',
    '≪': '<<', '≫': '>>', '∞': 'inf', '→': '->', '←': '<-', '↔': '<->',
    '⇒': '=>', '⇐': '<=', '⇔': '<=>', '↦': '|->', '↑': 'up', '↓': 'down',
    '∈': 'in', '∉': 'not in', '∋': 'ni', '⊂': 'sub', '⊃': 'sup',
    '⊆': '<=', '⊇': '>=', '∅': 'empty', '∀': 'for all', '∃': 'exists',
    '∂': 'd', '∇': 'grad', '∧': 'and', '∨': 'or', '∩': 'inter', '∪': 'union',
    '⊕': '(+) ', '⊗': '(x)', '∴': 'therefore', '∵': 'because',
    '⊥': 'perp', '∠': 'angle', '⋯': '...', '…': '...', '⋮': ':',
    '⋱': '..', '±': '+/-', '∓': '-/+', '×': 'x', '÷': '/', '°': ' deg'
  };

  // Neutral white / light-gray palette. Every value can be overridden.
  var DEFAULTS = {
    name: 'document',        // download file name (without .pdf)
    title: '',               // overrides the first <h1> in the document
    author: '',              // overrides a .author / .byline paragraph
    pageSize: 'A4',
    landscape: false,
    margin: { top: 62, right: 54, bottom: 62, left: 54 }, // points
    fontSize: 10.5,
    lineHeight: 1.62,
    paragraphGap: 9,
    pageNumbers: true,
    autoToc: false,          // insert a linked contents block near the top
    tocIndex: true,          // number TOC rows and show their page indices
    footerText: '',          // small text at the bottom-left of every page
    watermark: '',           // faint diagonal text across every page
    runningHead: true,       // small title at the top of every page
    numberHeadings: false,   // set true to prefix headings with 1., 1.1., etc.
    justify: true,           // research-paper justified body copy
    fontFamily: 'sans',      // sans | serif | geometric | classic
    // Optional: { latin, latinBold, serif, serifBold, bn, bnBold, hi, hiBold,
    // math, mathItalic } URLs or ArrayBuffers. When omitted, pdf-lib's
    // built-in standard fonts are used.
    fonts: null,
    colors: {
      background: '#ffffff',
      surface: '#f7f8fa',
      surfaceAlt: '#eef0f3',
      text: '#1f2328',
      heading: '#1f2328',
      headingEmphasis: '#1f2328',
      muted: '#656d76',
      accent: '#4b5563',
      quoteBar: '#4b5563',
      border: '#d8dce2',
      link: '#58a6ff',
      quoteText: '#3a4048',
      codeBg: '#f3f6f9',
      codeBorder: '#d8dee4',
      codeFg: '#2b3440',
      inlineCodeFg: '#db2777',
      mark: '#e4e7eb',
      tableHeaderBg: '#14334f',
      tableHeaderText: '#ffffff',
      tableRowBg: '#ffffff',
      tableStripeBg: '#fafbfc',
      tableBorder: '#c6cacf',
      tableRowBorder: '#e3e7ec'
    }
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function merge(target, source) {
    Object.keys(source || {}).forEach(function (key) {
      var val = source[key];
      if (val && typeof val === 'object' && !Array.isArray(val) &&
          target[key] && typeof target[key] === 'object') {
        merge(target[key], val);
      } else {
        target[key] = val;
      }
    });
    return target;
  }

  // Used when a heading has no explicit id: "Section 1" -> "section-1".
  function slugify(text) {
    var s = String(text == null ? '' : text).trim().toLowerCase();
    try {
      s = s.normalize('NFKD').replace(/[^\p{L}\p{N}\s-]/gu, '');
    } catch (e) {
      s = s.replace(/[^\w\s-]/g, '');
    }
    return s.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  // =========================================================================
  // PUBLIC CLASS
  // =========================================================================
  class pdfFromHtml {
    constructor(options) {
      this.o = merge(clone(DEFAULTS), options || {});
      if (options && options.colors) {
        this.o.colors = Object.assign({}, DEFAULTS.colors, options.colors);
      }
      if (options && options.margin) {
        this.o.margin = Object.assign({}, DEFAULTS.margin, options.margin);
      }

      this._source = null;
      this._bytes = null;
      this._pdf = null;
      this._renderer = null;
      this._fonts = null;
      this._imageCache = new Map();
      this._detectedTitle = '';
      this._detectedAuthor = '';
      this.fontWarning = '';
    }

    /* ---------- public API ------------------------------------------------ */

    /** Number of pages in the last generated document. */
    get pageCount() {
      return this._renderer ? this._renderer.pages.length : 0;
    }

    /** Set the source: an HTML string or a DOM Element (or NodeList). */
    setSource(input) {
      this._source = input;
      this._bytes = null;
      return this;
    }

    /** Parse + render. Options passed here override constructor options. */
    async convert(input, options) {
      if (options) {
        merge(this.o, options);
        if (options.colors) this.o.colors = Object.assign({}, this.o.colors, options.colors);
        if (options.margin) this.o.margin = Object.assign({}, this.o.margin, options.margin);
        this._bytes = null;
      }
      if (input !== undefined) this.setSource(input);
      if (this._source === null || this._source === undefined) {
        throw new Error('pdfFromHtml: no HTML source was provided.');
      }
      await this._build();
      return this;
    }

    /** Static shorthand: await pdfFromHtml.from(htmlOrElement, options) */
    static from(input, options) {
      return new pdfFromHtml(options).convert(input);
    }

    async toBytes() {
      if (!this._bytes) await this._build();
      return this._bytes;
    }

    async toBlob() {
      var bytes = await this.toBytes();
      return new Blob([bytes], { type: 'application/pdf' });
    }

    toDataUri() {
      var self = this;
      return this.toBlob().then(function (blob) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve(reader.result); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      });
    }

    /** Save the PDF to disk. Optional filename overrides options.name. */
    async download(filename) {
      var name = (filename || this.o.name || 'document').replace(/\.pdf$/i, '') + '.pdf';
      var url = URL.createObjectURL(await this.toBlob());
      var a = global.document.createElement('a');
      a.href = url;
      a.download = name;
      global.document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return this;
    }

    /* ---------- infrastructure -------------------------------------------- */

    _lib() {
      var L = global.PDFLib;
      if (!L || !L.PDFDocument || !L.rgb) {
        throw new Error('pdfFromHtml: pdf-lib is required (window.PDFLib).');
      }
      return L;
    }

    color(value) {
      if (Array.isArray(value)) return this._lib().rgb(value[0], value[1], value[2]);
      var h = String(value || '#000000').replace('#', '');
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      var rgb = this._lib().rgb;
      return rgb(
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255
      );
    }

    fontFor(style) {
      style = style || {};
      var f = this._fonts;
      // A script-specific face (e.g. Bengali) must take precedence so pdf-lib
      // never tries to encode those glyphs with a Latin-only fallback.
      if (style.script === 'bn' && f.bn) {
        return (style.bold && f.bnBold) ? f.bnBold : f.bn;
      }
      if (style.script === 'hi' && f.hi) {
        return (style.bold && f.hiBold) ? f.hiBold : f.hi;
      }
      if (style.mathText && f.mathText) {
        return (style.bold && f.mathTextBold) ? f.mathTextBold : f.mathText;
      }
      if (style.mathItalic && f.mathItalic) return f.mathItalic;
      if ((style.script === 'math' || style.math) && f.math) return f.math;
      if (style.script === 'emoji' && f.emoji) return f.emoji;
      // Code and table headers use the active base family — no monospace face
      // is embedded. The base lookup below handles bold/italic variations.
      // Theme presets can choose any embedded base family. Keys follow the
      // pattern <family>[Bold][Italic], e.g. geometricBoldItalic.
      var base = this.o.fontFamily || 'sans';
      var key = base + (style.bold ? 'Bold' : '') + (style.italic ? 'Italic' : '');
      if (f[key]) return f[key];
      if (f[base]) return f[base];
      return style.bold
        ? (style.italic ? f.serifBoldItalic : f.serifBold)
        : (style.italic ? f.serifItalic : f.serif);
    }

    async _loadFonts(pdf) {
      var F = this._lib().StandardFonts;
      this.fontWarning = '';
      this._fonts = {
        serif: await pdf.embedFont(F.TimesRoman),
        serifBold: await pdf.embedFont(F.TimesRomanBold),
        serifItalic: await pdf.embedFont(F.TimesRomanItalic),
        serifBoldItalic: await pdf.embedFont(F.TimesRomanBoldItalic),
        sans: await pdf.embedFont(F.Helvetica),
        sansBold: await pdf.embedFont(F.HelveticaBold),
        sansItalic: await pdf.embedFont(F.HelveticaOblique),
        sansBoldItalic: await pdf.embedFont(F.HelveticaBoldOblique)
      };

      var urls = this.o.fonts;
      if (!urls) return;

      try {
        if (global.fontkit && pdf.registerFontkit) pdf.registerFontkit(global.fontkit);
        var keys = Object.keys(urls);
        var bytes = await Promise.all(keys.map(async function (key) {
          var src = urls[key];
          if (src instanceof ArrayBuffer || ArrayBuffer.isView(src)) return src;
          var res = await fetch(src);
          if (!res.ok) throw new Error('font download failed: ' + key);
          return res.arrayBuffer();
        }));
        for (var i = 0; i < keys.length; i++) {
          this._fonts[keys[i]] = await pdf.embedFont(bytes[i], { subset: true });
        }
        if (this._fonts.bn && !global.fontkit) {
          this.fontWarning = ' (Bengali needs fontkit)';
        }
      } catch (err) {
        this.fontWarning = ' (standard fonts fallback)';
        console.warn('pdfFromHtml: custom font loading failed; using standard fonts.', err);
      }
    }

    // Replace characters the chosen font cannot encode so a missing glyph can
    // never abort generation (e.g. Bengali when custom fonts fail to download).
    safeText(font, text) {
      var str = String(text == null ? '' : text);
      try {
        font.encodeText(str);
        return str;
      } catch (err) {
        return Array.from(str).map(function (ch) {
          try { font.encodeText(ch); return ch; }
          catch (e) { return '?'; }
        }).join('');
      }
    }

    // fontkit can throw while shaping certain Indic sequences. Measuring and
    // drawing fall back to glyph-by-glyph so one bad sequence cannot abort the
    // whole PDF.
    measureSafe(font, text, size) {
      var str = String(text == null ? '' : text);
      try {
        return font.widthOfTextAtSize(str, size);
      } catch (err) {
        var total = 0;
        Array.from(str).forEach(function (ch) {
          try { total += font.widthOfTextAtSize(ch, size); }
          catch (e) { total += font.widthOfTextAtSize('?', size); }
        });
        return total;
      }
    }

    drawTextSafe(page, text, opts) {
      var str = String(text == null ? '' : text);
      try {
        page.drawText(str, opts);
        return;
      } catch (err) {
        var x = opts.x;
        Array.from(str).forEach(function (ch) {
          var c = ch;
          try {
            page.drawText(c, Object.assign({}, opts, { x: x }));
          } catch (e) {
            c = '?';
            try { page.drawText(c, Object.assign({}, opts, { x: x })); } catch (e2) { /* skip */ }
          }
          try { x += opts.font.widthOfTextAtSize(c, opts.size); } catch (e3) { /* skip */ }
        });
      }
    }

    _scriptRuns(text) {
      var runs = [];
      var chars = (global.Intl && global.Intl.Segmenter)
        ? Array.from(new global.Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), function (s) { return s.segment; })
        : Array.from(text);

      // Emoji need their own font: the Latin/math faces have no glyphs for
      // them, so safeText() would otherwise replace every emoji with '?'.
      var emojiRe = null;
      try { emojiRe = new RegExp('\\p{Extended_Pictographic}', 'u'); } catch (e) { emojiRe = null; }
      var isEmoji = function (ch) {
        var cp = ch.codePointAt(0);
        if (emojiRe && emojiRe.test(ch)) return true;
        if (cp >= 0x1F000 && cp <= 0x1FAFF) return true;   // pictographs, flags, modifiers
        if (cp >= 0x2600 && cp <= 0x27BF) return true;     // symbols / dingbats
        return /[\uFE0F\u20E3]/.test(ch);                  // variation selector / keycap
      };

      // U+0964/U+0965 (danda) are shared by Bengali and Devanagari, and
      // ZWJ/ZWNJ belong to whichever Indic script surrounds them. Classify
      // those ambiguous marks from their neighbours.
      var kinds = chars.map(function (ch) {
        var cp = ch.codePointAt(0);
        if (isEmoji(ch)) return 'emoji';
        if (cp >= 0x0980 && cp <= 0x09FF) return 'bn';
        if (cp >= 0x0900 && cp <= 0x097F) {
          return (cp === 0x0964 || cp === 0x0965) ? null : 'hi';
        }
        if (cp === 0x200C || cp === 0x200D) return null;
        // Math operators and arrows live outside the Latin faces we bundle.
        if ((cp >= 0x2100 && cp <= 0x214F) ||
            (cp >= 0x2190 && cp <= 0x21FF) ||
            (cp >= 0x2200 && cp <= 0x22FF) ||
            (cp >= 0x2300 && cp <= 0x23FF) ||
            (cp >= 0x27C0 && cp <= 0x27EF) ||
            (cp >= 0x2A00 && cp <= 0x2AFF)) return 'math';
        return 'latin';
      });
      kinds.forEach(function (kind, i) {
        if (kind) return;
        var j = i - 1;
        while (j >= 0 && !kinds[j]) j--;
        if (j >= 0) { kinds[i] = kinds[j]; return; }
        j = i + 1;
        while (j < kinds.length && !kinds[j]) j++;
        kinds[i] = j < kinds.length ? kinds[j] : 'latin';
      });

      var cur = '';
      var curScript = null;
      chars.forEach(function (ch, i) {
        if (cur && kinds[i] !== curScript) {
          runs.push({ text: cur, script: curScript, bn: curScript === 'bn' });
          cur = '';
        }
        cur += ch;
        curScript = kinds[i];
      });
      if (cur) runs.push({ text: cur, script: curScript, bn: curScript === 'bn' });
      return runs;
    }

    async _embedImage(src) {
      if (!src) throw new Error('missing image src');
      if (this._imageCache.has(src)) return this._imageCache.get(src);

      var bytes, mime = '';
      if (/^data:/i.test(src)) {
        var m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/i.exec(src);
        if (!m) throw new Error('invalid data URL');
        mime = m[1] || 'application/octet-stream';
        if (m[2]) {
          var binary = atob(m[3].replace(/\s/g, ''));
          bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        } else {
          bytes = new global.TextEncoder().encode(decodeURIComponent(m[3].replace(/\+/g, ' ')));
        }
      } else {
        var base = global.location ? global.location.href : undefined;
        var url = new global.URL(src, base).href;
        var res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        bytes = new Uint8Array(await res.arrayBuffer());
        mime = res.headers.get('content-type') || '';
      }

      var img;
      if (/png/i.test(mime)) img = await this._pdf.embedPng(bytes);
      else if (/jpe?g/i.test(mime)) img = await this._pdf.embedJpg(bytes);
      else {
        var blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
        var bmp = await createImageBitmap(blob);
        var c = global.document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0);
        var png = await new Promise(function (resolve, reject) {
          c.toBlob(function (b) {
            if (!b) return reject(new Error('canvas export failed'));
            b.arrayBuffer().then(function (ab) { resolve(new Uint8Array(ab)); }).catch(reject);
          }, 'image/png');
        });
        img = await this._pdf.embedPng(png);
      }
      this._imageCache.set(src, img);
      return img;
    }

    /* ---------- HTML -> block model --------------------------------------- */

    _sourceToHtml(input) {
      if (typeof input === 'string') return input;
      if (input && input.nodeType) return input.outerHTML || input.innerHTML || '';
      if (input && typeof input.length === 'number' && input.length) {
        return Array.prototype.map.call(input, function (n) {
          return n.outerHTML || n.innerHTML || n.textContent || '';
        }).join('\n');
      }
      if (input && typeof input.innerHTML === 'string') return input.innerHTML;
      throw new TypeError('pdfFromHtml: expected an HTML string or a DOM element.');
    }

    _plain(inlines) {
      return (inlines || []).map(function (i) { return i.text || ''; }).join('').trim();
    }

    // ---- inline math -------------------------------------------------------

    // Split a text node into normal text and math expressions. Supported
    // delimiters: $…$, $$…$$, \(…\) and \[…\] (the latter two are what many
    // Markdown/KaTeX providers emit).
    _textWithMath(text, st) {
      var raw = String(text == null ? '' : text);
      if (!raw) return [];
      var re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\r\n]+?)\$/g;
      var out = [];
      var last = 0;
      var m;
      while ((m = re.exec(raw))) {
        var display = m[1] != null || m[2] != null;
        var expr = m[1] != null ? m[1]
          : (m[2] != null ? m[2]
          : (m[3] != null ? m[3] : m[4]));
        // Only the ambiguous single-dollar form needs a sanity check so
        // ordinary currency like "$5 and $10" is not swallowed.
        if (!display && m[4] != null && !this._looksLikeMath(expr)) continue;
        if (m.index > last) out.push(Object.assign({}, st, { text: raw.slice(last, m.index) }));
        if (display) out.push(Object.assign({}, st, { text: expr, mathDisplay: expr }));
        else out = out.concat(this._mathInlines(expr, st, false));
        last = re.lastIndex;
      }
      if (last < raw.length) out.push(Object.assign({}, st, { text: raw.slice(last) }));
      return out;
    }

    _looksLikeMath(expr) {
      return /[\\^_{}=+*\/<>≤≥≠∑√∫∈∞→⇒]/.test(expr) || /[α-ωΑ-Ω]/.test(expr);
    }

    // Convert LaTeX-ish math into styled inline segments. Superscripts and
    // subscripts get their own flags so drawLines can raise/lower and shrink
    // them; math symbols are routed to the math font when it is available.
    _mathInlines(src, style, display) {
      var self = this;
      var str = String(src == null ? '' : src);
      var base = Object.assign({}, style || {}, { math: true });
      if (base.mathDisplay) delete base.mathDisplay;
      var tokens = [];
      var i = 0;
      var hasMathFont = !!(this._fonts && this._fonts.math);

      function sym(ch) {
        if (!hasMathFont && Object.prototype.hasOwnProperty.call(MATH_ASCII, ch)) {
          return MATH_ASCII[ch];
        }
        return ch;
      }
      function push(text, extra, glue) {
        if (!text) return;
        tokens.push(Object.assign({}, base, extra || {}, {
          text: text, glueBefore: !!glue
        }));
      }
      function addSeq(seq, glueFirst) {
        seq.forEach(function (t, idx) {
          if (t.br) { tokens.push(t); return; }
          if (glueFirst && idx === 0) t.glueBefore = true;
          tokens.push(t);
        });
      }
      function glueFirst(seq) {
        if (seq.length && !seq[0].br) seq[0].glueBefore = true;
        return seq;
      }
      function readGroup(pos) {
        if (str[pos] !== '{') {
          if (str[pos] === '\\') {
            var cm = /^\\[a-zA-Z]+/.exec(str.slice(pos));
            if (cm) return { text: cm[0], next: pos + cm[0].length };
          }
          return { text: str[pos] || '', next: pos + 1 };
        }
        var depth = 0;
        for (var j = pos; j < str.length; j++) {
          if (str[j] === '{') depth++;
          else if (str[j] === '}') {
            depth--;
            if (!depth) return { text: str.slice(pos + 1, j), next: j + 1 };
          }
        }
        return { text: str.slice(pos + 1), next: str.length };
      }

      while (i < str.length) {
        var ch = str[i];
        if (/\s/.test(ch)) { i++; continue; } // gaps are added by drawLines
        if (ch === '{') {
          var grp = readGroup(i);
          addSeq(self._mathInlines(grp.text, base, false), tokens.length > 0);
          i = grp.next;
          continue;
        }
        if (ch === '}') { i++; continue; }
        if (ch === '^' || ch === '_') {
          var sg = readGroup(i + 1);
          var shifted = self._mathInlines(sg.text, base, false);
          shifted.forEach(function (t) {
            if (t.br) return;
            // Keep an inner sub/sup intact when a group nests them.
            if (!t.sub && !t.sup) {
              t.sup = ch === '^';
              t.sub = ch === '_';
            }
            t.glueBefore = true;
          });
          addSeq(shifted, true);
          i = sg.next;
          continue;
        }
        if (ch === '\\') {
          var cmdMatch = /^\\[a-zA-Z]+/.exec(str.slice(i));
          if (cmdMatch) {
            var cmd = cmdMatch[0].slice(1);
            i += cmdMatch[0].length;
            if (/^(frac|dfrac|tfrac|cfrac)$/.test(cmd)) {
              var num = readGroup(i);
              var den = readGroup(num.next);
              addSeq(self._mathInlines(num.text, base, false), false);
              push(sym('/'), {}, true);
              addSeq(glueFirst(self._mathInlines(den.text, base, false)), true);
              i = den.next;
              continue;
            }
            if (cmd === 'sqrt') {
              var root = readGroup(i);
              push(sym('√'), {}, tokens.length > 0);
              push('(', {}, true);
              addSeq(glueFirst(self._mathInlines(root.text, base, false)), true);
              push(')', {}, true);
              i = root.next;
              continue;
            }
            if (/^(text|textrm|mathbf|mathit|mathrm|operatorname|mathsf|mathtt)$/.test(cmd)) {
              var txtGroup = readGroup(i);
              var plain = txtGroup.text.replace(/\\(.)/g, '$1');
              var textStyle = cmd === 'mathit'
                ? { mathItalic: true }
                : { mathText: true, bold: cmd === 'mathbf' };
              push(plain, textStyle, false);
              i = txtGroup.next;
              continue;
            }
            if (/^(begin|end)$/.test(cmd)) {
              var env = readGroup(i);
              i = env.next;
              continue;
            }
            if (MATH_STYLE_CMDS[cmd]) continue;
            var symbol = MATH_SYMBOLS[cmd];
            if (symbol) {
              // Greek letters are variables, so they use the math-italic face.
              push(sym(symbol), /[\u0370-\u03FF]/.test(symbol) ? { mathItalic: true } : {}, false);
            } else {
              // Unknown commands (including \sin, \log, ...) stay upright.
              push(cmd, { mathText: true }, false);
            }
            continue;
          }
          var esc = str[i + 1];
          if (!esc) { i++; continue; }
          if (esc === '\\') { tokens.push({ br: true }); i += 2; continue; }
          if (MATH_STYLE_CMDS[esc]) { i += 2; continue; }
          push(sym(esc), {}, false);
          i += 2;
          continue;
        }
        if (ch === '&') { i++; continue; } // matrix column separator
        var letters = /^[A-Za-z]+/.exec(str.slice(i));
        if (letters) {
          push(letters[0], { mathItalic: true }, false);
          i += letters[0].length;
          continue;
        }
        var digits = /^[0-9]+/.exec(str.slice(i));
        if (digits) {
          push(digits[0], { mathText: true }, false);
          i += digits[0].length;
          continue;
        }
        push(sym(ch), /[\u0370-\u03FF]/.test(ch) ? { mathItalic: true } : {}, false);
        i++;
      }
      if (display) tokens.forEach(function (t) { t.display = true; });
      return tokens;
    }

    // MathML support for `<math>` elements pasted from other editors.
    _mathNodeInlines(node, style) {
      var self = this;
      if (!node) return [];
      if (node.nodeType === 3) return this._textWithMath(node.nodeValue, style);
      if (node.nodeType !== 1) return [];
      var tag = node.tagName.toLowerCase().replace(/^math:/, '');
      var st = Object.assign({}, style || {});
      var kids = Array.prototype.filter.call(node.childNodes, function (n) {
        return n.nodeType === 1 || n.nodeType === 3;
      });
      function kid(n) { return self._mathNodeInlines(n, st); }
      function mark(seq, type) {
        seq.forEach(function (t) {
          if (t.br) return;
          if (!t.sub && !t.sup) {
            if (type === 'sub') { t.sub = true; t.sup = false; }
            else if (type === 'sup') { t.sup = true; t.sub = false; }
          }
          t.glueBefore = true;
        });
        return seq;
      }
      function gl(seq) {
        if (seq.length && !seq[0].br) seq[0].glueBefore = true;
        return seq;
      }

      if (/^(mi|mn|mo|mtext|ms)$/.test(tag)) {
        var txt = (node.textContent || '').replace(/[\u2062\u2063]/g, '');
        var leaf = tag === 'mi'
          ? { mathItalic: true }
          : (/^(mn|mtext|ms)$/.test(tag) ? { mathText: true } : {});
        return txt ? [Object.assign({}, st, leaf, { text: txt })] : [];
      }
      if (tag === 'mspace') return [];
      if (/^(msub|msup|msubsup|munder|mover|munderover)$/.test(tag)) {
        var bases = [], subs = [], sups = [];
        kids.forEach(function (k, idx) {
          if (idx === 0) bases = kid(k);
          else if (tag === 'msubsup' || tag === 'munderover') {
            if (idx === 1) subs = kid(k); else sups = kid(k);
          } else if (tag === 'msup' || tag === 'mover') sups = kid(k);
          else subs = kid(k);
        });
        return bases.concat(mark(subs, 'sub'), mark(sups, 'sup'));
      }
      if (tag === 'mfrac') {
        var num = kids[0] ? kid(kids[0]) : [];
        var den = kids[1] ? kid(kids[1]) : [];
        return num.concat([
          Object.assign({}, st, { text: '/', glueBefore: true })
        ], gl(den));
      }
      if (tag === 'msqrt') {
        var out = [Object.assign({}, st, {
          text: this._fonts && this._fonts.math ? '√' : 'sqrt'
        })];
        out.push(Object.assign({}, st, { text: '(', glueBefore: true }));
        kids.forEach(function (k) { out = out.concat(gl(kid(k))); });
        out.push(Object.assign({}, st, { text: ')', glueBefore: true }));
        return out;
      }
      if (tag === 'mroot') {
        var result = [];
        kids.forEach(function (k, idx) {
          if (idx === 1) {
            result.push(Object.assign({}, st, { text: '^(1/', glueBefore: true }));
            result = result.concat(kid(k));
            result.push(Object.assign({}, st, { text: ')', glueBefore: true }));
          } else result = result.concat(kid(k));
        });
        return result;
      }
      var all = [];
      kids.forEach(function (k) { all = all.concat(kid(k)); });
      return all;
    }

    _splitMathBlocks(blocks) {
      var out = [];
      blocks.forEach(function (b) {
        if (!b.inlines || !b.inlines.some(function (i) { return i.mathDisplay; })) {
          out.push(b);
          return;
        }
        var cur = [];
        b.inlines.forEach(function (inline) {
          if (inline.mathDisplay) {
            if (cur.length) out.push(Object.assign({}, b, { inlines: cur }));
            cur = [];
            out.push({
              type: 'math',
              inlines: this._mathInlines(inline.mathDisplay, inline, false)
            });
          } else cur.push(inline);
        }, this);
        if (cur.length) out.push(Object.assign({}, b, { inlines: cur }));
      }, this);
      return out;
    }

    _alignOf(node) {
      var s = (node.getAttribute('align') || '') + ' ' + (node.getAttribute('style') || '');
      if (/center/i.test(s)) return 'center';
      if (/right/i.test(s)) return 'right';
      if (/justify/i.test(s)) return 'justify';
      return 'left';
    }

    _inlines(node, inherited) {
      var st = inherited || {};
      if (node.nodeType === 3) return this._textWithMath(node.nodeValue, st);
      if (node.nodeType !== 1) return [];

      var tag = node.tagName.toLowerCase();
      if (tag === 'math' || /^(mi|mn|mo|mtext|ms|msub|msup|msubsup|mfrac|msqrt|mroot|mrow|munder|mover|munderover)$/.test(tag)) {
        return this._mathNodeInlines(node, st);
      }
      var s = Object.assign({}, st);
      if (tag === 'strong' || tag === 'b') s.bold = true;
      if (tag === 'em' || tag === 'i' || tag === 'cite') s.italic = true;
      if (tag === 'code' || tag === 'kbd' || tag === 'samp') s.code = true;
      if (tag === 'mark') s.mark = true;
      if (tag === 's' || tag === 'del' || tag === 'strike') s.strike = true;
      if (tag === 'sub') { s.sub = true; s.sup = false; }
      if (tag === 'sup') { s.sup = true; s.sub = false; }
      if (tag === 'a') s.link = node.getAttribute('href') || '';
      if (tag === 'br') return [{ br: true }];
      if (tag === 'input' && node.getAttribute('type') === 'checkbox') {
        return [{ text: node.hasAttribute('checked') ? '[x] ' : '[ ] ' }];
      }
      if (tag === 'img') {
        return [Object.assign({}, s, { text: '[Figure: ' + (node.getAttribute('alt') || 'image') + ']', italic: true })];
      }

      var out = [];
      Array.prototype.forEach.call(node.childNodes, function (child) {
        out = out.concat(this._inlines(child, s));
      }, this);
      return out;
    }

    _children(node) {
      var out = [];
      Array.prototype.forEach.call(node.childNodes, function (child) {
        out = out.concat(this._nodeToBlocks(child));
      }, this);
      return out;
    }

    _imageBlock(node, align) {
      var attr = function (n) { return node.getAttribute(n) || ''; };
      return {
        type: 'image',
        src: attr('src'),
        alt: attr('alt'),
        align: align || 'center',
        width: parseInt(attr('width'), 10) || 0,
        height: parseInt(attr('height'), 10) || 0
      };
    }

    // Propagate an element's id to every block it produces, then the renderer
    // can register it as a TOC destination.
    _nodeToBlocks(node) {
      var blocks = this._nodeToBlocksInner(node);
      if (node.nodeType === 1) {
        var id = node.getAttribute('id');
        if (id) blocks.forEach(function (b) { if (!b.id) b.id = id; });
      }
      return blocks;
    }

    _nodeToBlocksInner(node) {
      if (node.nodeType === 3) {
        var text = node.nodeValue.replace(/\s+/g, ' ').trim();
        return text ? [{ type: 'paragraph', inlines: [{ text: text }], align: 'left', class: '' }] : [];
      }
      if (node.nodeType !== 1) return [];

      var tag = node.tagName.toLowerCase();
      var cls = node.getAttribute('class') || '';
      var align = this._alignOf(node);

      if (/page-?break|new-?page/i.test(cls)) return [{ type: 'pagebreak' }];

      // Named zero-height anchors such as <a id="section1"></a>, including
      // the <p><a id="..."></a></p> form emitted by Markdown.
      var named = tag === 'a' ? node : node.querySelector('a[id]');
      if (named && named.getAttribute('id') && !node.textContent.replace(/\s/g, '')) {
        return [{ type: 'anchor', id: named.getAttribute('id') }];
      }

      if (/^h[1-6]$/.test(tag)) {
        return [{ type: 'heading', level: Number(tag[1]), inlines: this._inlines(node), align: align, class: cls }];
      }

      if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
        var imgs = node.querySelectorAll('img');
        var hasText = node.textContent.replace(/\s/g, '').length > 0;
        if (imgs.length === 1 && !hasText) return [this._imageBlock(imgs[0], align)];
        var complex = node.querySelector('p,div,ul,ol,table,pre,blockquote,h1,h2,h3,h4,h5,h6');
        if (!complex) {
          return [{ type: 'paragraph', inlines: this._inlines(node), align: align, class: cls }];
        }
        return this._children(node);
      }

      if (tag === 'blockquote') {
        // An author/citation given inside a quote gets its own second line.
        var attrSel = 'cite, footer, .author, .byline, .attribution';
        var attrNode = node.querySelector(attrSel);
        var attribution = attrNode ? this._inlines(attrNode) : null;
        var holder = node;
        if (attrNode) {
          holder = node.cloneNode(true);
          var toRemove = holder.querySelector(attrSel);
          if (toRemove && toRemove.parentNode) toRemove.parentNode.removeChild(toRemove);
        }
        var quoteBlocks = this._children(holder);
        // Markdown style: "— Author" on its own line after the quoted text.
        if (!attribution && quoteBlocks.length > 1) {
          var last = quoteBlocks[quoteBlocks.length - 1];
          if (last.type === 'paragraph' && /^[—–-]{1,2}\s*\S/.test(this._plain(last.inlines))) {
            attribution = last.inlines;
            quoteBlocks = quoteBlocks.slice(0, -1);
          }
        }
        return [{
          type: 'quote', blocks: quoteBlocks,
          attribution: attribution, align: align
        }];
      }

      if (tag === 'pre') {
        var code = node.querySelector('code') || node;
        return [{ type: 'code', text: code.textContent.replace(/\s+$/, '') }];
      }

      if (tag === 'ul' || tag === 'ol') {
        var self = this;
        var items = [];
        Array.prototype.forEach.call(node.children, function (li) {
          if (li.tagName.toLowerCase() !== 'li') return;
          var blocks = [];
          var bits = [];
          var checked = null;
          function flushBits() {
            if (!bits.length) return;
            blocks.push({ type: 'paragraph', inlines: bits, align: 'left', class: '' });
            bits = [];
          }
          Array.prototype.forEach.call(li.childNodes, function (ch) {
            var tagName = ch.nodeType === 1 ? ch.tagName.toLowerCase() : '';
            if (/^(ul|ol|pre|blockquote|table|p|div|section|article|main|h[1-6])$/.test(tagName)) {
              // Block children must not be flattened into the item's inline text.
              // This is what makes a <pre><code> block stay a real code block.
              flushBits();
              blocks = blocks.concat(self._nodeToBlocks(ch));
            } else if (tagName === 'img') {
              flushBits();
              blocks.push(self._imageBlock(ch, 'left'));
            } else if (tagName === 'input') {
              checked = ch.hasAttribute('checked');
              bits = bits.concat(self._inlines(ch));
            } else {
              bits = bits.concat(self._inlines(ch));
            }
          });
          flushBits();
          if (!blocks.length) blocks.push({ type: 'paragraph', inlines: [{ text: '' }], align: 'left', class: '' });
          items.push({ blocks: blocks, checked: checked });
        });
        return [{
          type: 'list',
          ordered: tag === 'ol',
          start: parseInt(node.getAttribute('start') || '1', 10) || 1,
          items: items
        }];
      }

      if (tag === 'table') {
        var header = [];
        var rows = [];
        Array.prototype.forEach.call(node.querySelectorAll('tr'), function (tr, index) {
          var cells = Array.prototype.filter.call(tr.children, function (c) {
            return /^(th|td)$/i.test(c.tagName);
          });
          var row = cells.map(function (c) { return this._inlines(c); }, this);
          if (index === 0 && cells.length && cells[0].tagName.toLowerCase() === 'th') {
            header = header.concat(row);
          } else {
            rows.push(row);
          }
        }, this);
        return [{ type: 'table', header: header, rows: rows }];
      }

      if (tag === 'hr') return [{ type: 'hr' }];
      if (tag === 'img') return [this._imageBlock(node, align)];
      if (tag === 'math') {
        var inlines = this._mathNodeInlines(node, { math: true });
        var display = (node.getAttribute('display') || '') === 'block';
        return [display
          ? { type: 'math', inlines: inlines }
          : { type: 'paragraph', inlines: inlines, align: align, class: cls }];
      }

      return this._children(node);
    }

    _postProcess(blocks) {
      blocks = this._splitMathBlocks(blocks);
      var out = [];
      var i;
      for (i = 0; i < blocks.length; i++) {
        var b = blocks[i];

        // first <h1> becomes the paper title
        if (b.type === 'heading' && b.level === 1 && !this._detectedTitle) {
          this._detectedTitle = this._plain(b.inlines);
          var titleInlines = this.o.title
            ? [{ text: this.o.title, bold: true }]
            : b.inlines;
          out.push({ type: 'title', inlines: titleInlines, align: b.align || 'center', id: b.id });
          continue;
        }

        // .author / .byline paragraph becomes the author line
        if (b.type === 'paragraph' && /author|byline/i.test(b.class || '')) {
          this._detectedAuthor = this._plain(b.inlines);
          out.push({ type: 'author', inlines: b.inlines, align: 'center', id: b.id });
          continue;
        }

        // "Abstract" heading + following paragraphs -> one gray panel
        if (b.type === 'heading' && /abstract/i.test(this._plain(b.inlines))) {
          var inlines = [];
          var anchorId = b.id;
          i++;
          while (i < blocks.length && blocks[i].type !== 'heading') {
            inlines = inlines.concat(blocks[i].inlines || [], [{ text: ' ' }]);
            i++;
          }
          i--;
          out.push({ type: 'abstract', inlines: inlines, id: anchorId });
          continue;
        }

        out.push(b);
      }

      // Auto table of contents. Heading ids are normalised here so the links
      // and the anchors rendered later always agree, even for duplicate titles.
      if (this.o.autoToc) {
        var entries = [];
        var seen = {};
        // Numbering mirrors heading(): level 2 is 1., level 3 is 1.1., and so
        // on. Resetting deeper counters keeps sibling sections in sequence.
        var headingNums = [0, 0, 0, 0, 0, 0];
        var indexed = this.o.tocIndex !== false;
        out.forEach(function (b) {
          if (b.type !== 'heading') return;
          var id = b.id || slugify(this._plain(b.inlines));
          if (!id) return;
          if (seen[id]) {
            var n = 2;
            while (seen[id + '-' + n]) n++;
            id = id + '-' + n;
          }
          seen[id] = true;
          b.id = id;
          var lv = Math.min(Math.max(Number(b.level) || 2, 2), 6);
          headingNums[lv]++;
          for (var k = lv + 1; k < 6; k++) headingNums[k] = 0;
          var num = '';
          for (var j = 2; j <= lv; j++) {
            if (headingNums[j]) num += headingNums[j] + '.';
          }
          entries.push({ id: id, text: this._plain(b.inlines), level: lv, num: indexed ? num : '' });
        }, this);
        if (entries.length) {
          var at = -1;
          for (var k = 0; k < out.length; k++) {
            if (out[k].type === 'title' || out[k].type === 'heading') { at = k; break; }
          }
          out.splice(at + 1, 0, { type: 'toc', entries: entries });
        }
      }

      return out;
    }

    _parse(input) {
      this._detectedTitle = '';
      this._detectedAuthor = '';
      var html = this._sourceToHtml(input);
      var doc = new DOMParser().parseFromString(
        '<!doctype html><html><body>' + html + '</body></html>', 'text/html'
      );
      var blocks = [];
      Array.prototype.forEach.call(doc.body.childNodes, function (n) {
        blocks = blocks.concat(this._nodeToBlocks(n));
      }, this);
      return this._postProcess(blocks);
    }

    /* ---------- build ------------------------------------------------------ */

    async _build() {
      var lib = this._lib();
      var pdf = await lib.PDFDocument.create();
      this._pdf = pdf;
      this._imageCache = new Map();

      var size = PAGE_SIZES[this.o.pageSize] || PAGE_SIZES.A4;
      var w = size[0], h = size[1];
      if (this.o.landscape) { w = size[1]; h = size[0]; }

      await this._loadFonts(pdf);

      var blocks = this._parse(this._source);
      var renderer = new PaperRenderer(this, pdf, w, h);
      this._renderer = renderer;
      await renderer.render(blocks);
      renderer.finishToc();
      renderer.finish();

      var metaTitle = this.o.title || this._detectedTitle || 'Document';
      pdf.setTitle(String(metaTitle));
      pdf.setAuthor(String(this.o.author || this._detectedAuthor || ''));
      pdf.setSubject('Generated by pdfFromHtml');
      pdf.setCreator('pdfFromHtml');
      pdf.setProducer('pdfFromHtml');

      this._bytes = await pdf.save({ useObjectStreams: true });
    }
  }

  // =========================================================================
  // INTERNAL RENDERER (research-paper layout)
  // =========================================================================
  class PaperRenderer {
    constructor(host, pdf, pageW, pageH) {
      this.host = host;
      this.o = host.o;
      this.C = host.o.colors;
      this.pdf = pdf;
      this.w = pageW;
      this.h = pageH;
      this.m = host.o.margin;
      this.pages = [];
      this.page = null;
      this.y = 0;
      this.links = [];
      this.anchors = {};
      this.headingNums = [0, 0, 0, 0, 0, 0];
      this.figureNo = 0;
      this.measureOnly = false;
      this.newPage();
    }

    get contentW() { return this.w - this.m.left - this.m.right; }
    get maxY() { return this.h - this.m.bottom; }
    pdfY(top) { return this.h - top; }

    // Record where a TOC target lands. The compact alias lets "#section1"
    // find a heading slugged as "section-1".
    markAnchor(id, top) {
      if (!id) return;
      var key = String(id).trim();
      if (!key || this.anchors[key]) return;
      var pos = { page: this.page, y: this.pdfY(top == null ? this.y : top) };
      var lower = key.toLowerCase();
      var compact = key.replace(/-/g, '');
      var lowerCompact = lower.replace(/-/g, '');
      [key, lower, compact, lowerCompact].forEach(function (alias) {
        if (alias && !this.anchors[alias]) this.anchors[alias] = pos;
      }, this);
    }

    findAnchor(url) {
      var id = String(url || '').replace(/^#/, '').split('?')[0];
      try { id = decodeURIComponent(id); } catch (e) { /* keep raw id */ }
      return this.anchors[id] || this.anchors[id.toLowerCase()] || null;
    }

    slugForBlock(b) {
      return b.id || slugify(this.host._plain(b.inlines));
    }

    col(key) { return this.host.color(this.C[key] || key); }
    font(style) { return this.host.fontFor(style); }
    measure(text, style, size) {
      var font = this.font(style);
      return this.host.measureSafe(font, this.host.safeText(font, text), size);
    }
    spaceW(size) { return this.measure(' ', null, size || this.o.fontSize); }

    // Draw a short single-line string (running head, author line) with each
    // script in its own font, so a Bengali title is not forced into Helvetica.
    mixedRuns(text, fontStyle) {
      return this.host._scriptRuns(String(text)).map(function (run) {
        var style = Object.assign({}, fontStyle, { script: run.script || (run.bn ? 'bn' : 'latin') });
        var font = this.font(style);
        return { font: font, text: this.host.safeText(font, run.text) };
      }, this);
    }

    drawMixed(text, baselineTop, size, fontStyle, colorValue, opts) {
      opts = opts || {};
      var runs = this.mixedRuns(text, fontStyle);
      var widths = runs.map(function (r) { return this.host.measureSafe(r.font, r.text, size); }, this);
      var total = widths.reduce(function (a, b) { return a + b; }, 0);
      var x = opts.align === 'center' ? (this.w - total) / 2 : (opts.x != null ? opts.x : this.m.left);
      if (!this.measureOnly) {
        runs.forEach(function (r, i) {
          if (!r.text) return;
          this.host.drawTextSafe(this.page, r.text, {
            x: x, y: this.pdfY(baselineTop), size: size,
            font: r.font, color: colorValue
          });
          x += widths[i];
        }, this);
      }
      return total;
    }

    newPage() {
      if (this.measureOnly) { this.y = 0; return; }
      this.page = this.pdf.addPage([this.w, this.h]);
      this.pages.push(this.page);
      this.y = this.m.top;

      // light-gray paper
      if (this.C.background) {
        this.page.drawRectangle({
          x: 0, y: 0, width: this.w, height: this.h, color: this.col('background')
        });
      }

      // running head
      if (this.o.runningHead) {
        var head = this.o.title || this.host._detectedTitle || this.o.name || '';
        if (head) {
          this.drawMixed(String(head).toUpperCase(), this.m.top - 24, 8,
            { bold: false }, this.col('muted'), { x: this.m.left });
        }
        this.y = this.m.top + 4;
      }
    }

    ensure(height) {
      if (this.y + height > this.maxY + 0.01) this.newPage();
    }

    rect(x, top, width, height, colorValue) {
      if (this.measureOnly || !colorValue) return;
      this.page.drawRectangle({
        x: x,
        y: this.pdfY(top + height),
        width: width,
        height: height,
        color: this.host.color(colorValue)
      });
    }

    // Filled panel with a thin border; callers can override the border colour.
    card(x, top, width, height, fill, borderColor) {
      if (this.measureOnly) return;
      this.rect(x, top, width, height, fill);
      if (borderColor || this.C.border) {
        this.page.drawRectangle({
          x: x,
          y: this.pdfY(top + height),
          width: width,
          height: height,
          borderColor: this.col(borderColor || 'border'),
          borderWidth: 0.6
        });
      }
    }

    line(x1, top1, x2, top2, colorValue, thickness) {
      if (this.measureOnly) return;
      this.page.drawLine({
        start: { x: x1, y: this.pdfY(top1) },
        end: { x: x2, y: this.pdfY(top2) },
        thickness: thickness || 0.6,
        color: this.host.color(colorValue)
      });
    }

    // ---- text wrapping & drawing -----------------------------------------
    wrap(inlines, maxWidth, baseSize) {
      var lines = [[]];
      var lineW = 0;
      var spaceW = this.spaceW(baseSize);
      var self = this;

      // `glued` means "no space before this segment" (used when one word is
      // split into Latin + Bengali font runs).
      function place(text, style, size, glued) {
        if (!text) return;
        var w = self.measure(text, style, size);
        if (w > maxWidth) {
          var cur = '';
          Array.from(text).forEach(function (ch) {
            if (cur && self.measure(cur + ch, style, size) > maxWidth) {
              place(cur, style, size, glued);
              cur = ch;
            } else {
              cur += ch;
            }
          });
          if (cur) place(cur, style, size, glued);
          return;
        }
        var current = lines[lines.length - 1];
        var step = (current.length && !glued) ? spaceW : 0;
        if (current.length && lineW + step + w > maxWidth) {
          lines.push([]);
          current = lines[lines.length - 1];
          lineW = 0;
          step = 0;
        }
        lineW += step;
        current.push({ text: text, s: style, size: size, baseSize: baseSize, w: w, glueBefore: !!glued });
        lineW += w;
      }

      (inlines || []).forEach(function (inline) {
        if (inline.br) { lines.push([]); lineW = 0; return; }
        var isCode = !!(inline.code || inline.mono);
        var isShifted = !!(inline.sub || inline.sup);
        var size = isShifted ? baseSize * 0.72 : (isCode ? baseSize * 0.94 : baseSize);
        var text = String(inline.text == null ? '' : inline.text);

        // Code blocks are fixed-width: keep every literal space (and expand
        // tabs) as part of the text itself. The generic path below collapses
        // whitespace to a single layout gap, which loses shell indentation and
        // makes copied PDF text read "read-rsp" instead of "read -rsp".
        if (inline.codeBlock) {
          text = text.replace(/\t/g, '    ');
          var tokens = text.match(/\s+|\S+/g) || [];
          tokens.forEach(function (token) {
            if (/^\s+$/.test(token)) {
              place(token, inline, size, true);
              return;
            }
            self.host._scriptRuns(token).forEach(function (run, index) {
              var style = Object.assign({}, inline, { script: run.script || (run.bn ? 'bn' : 'latin') });
              place(run.text, style, size, true);
            });
          });
          return;
        }

        // inline code keeps their leading indentation
        if (isCode) {
          var lead = (text.match(/^[ \t]*/) || [''])[0].replace(/\t/g, '    ');
          if (lead) place(lead, inline, size, false);
          text = text.replace(/^[ \t]*/, '');
          if (!text) { lines.push([]); lineW = 0; return; }
        }

        var firstWord = true;
        text.trim().split(/\s+/).forEach(function (word) {
          if (!word) return;
          // keep each script in its own font run
          self.host._scriptRuns(word).forEach(function (run, index) {
            var style = Object.assign({}, inline, { script: run.script || (run.bn ? 'bn' : 'latin') });
            var glued = index > 0 || (firstWord && !!inline.glueBefore);
            place(run.text, style, size, glued);
          });
          firstWord = false;
        });
      });

      return lines.filter(function (l) { return l.length; });
    }

    colorFor(style) {
      style = style || {};
      if (style.number) return this.col('accent');
      if (style.link) return this.col('link');
      if (style.codeBlock) return this.col('codeFg');
      if (style.code) return this.col('inlineCodeFg');
      if (style.mark) return this.col('heading');
      if (style.strike) return this.col('muted');
      return this.col('text');
    }

    drawLines(lines, x, top, maxWidth, opts) {
      opts = opts || {};
      var align = opts.align || 'left';
      var override = opts.color || null;
      var fontSize = opts.fontSize || this.o.fontSize;
      var lineHeight = opts.lineHeight || fontSize * this.o.lineHeight;
      var spaceW = this.spaceW(fontSize);
      var italicAll = opts.italic;
      var cursorY = top;

      lines.forEach(function (line, index) {
        var wordsW = line.reduce(function (a, b) { return a + b.w; }, 0);
        var gapCount = line.reduce(function (n, seg) {
          return n + (seg.glueBefore ? 0 : 1);
        }, 0) - 1;
        if (gapCount < 0) gapCount = 0;
        var total = wordsW + spaceW * gapCount;
        var gap = spaceW;
        var startX = x;

        if (align === 'center') startX = x + (maxWidth - total) / 2;
        else if (align === 'right') startX = x + (maxWidth - total);
        else if (align === 'justify' && index < lines.length - 1 && gapCount > 0) {
          gap = (maxWidth - wordsW) / gapCount;
        }

        var cx = startX;
        line.forEach(function (seg, segIndex) {
          if (segIndex > 0 && !seg.glueBefore) cx += gap;
          var s = Object.assign({}, seg.s || {});
          if (italicAll) s.italic = true;
          if (!this.measureOnly) {
            // inline decorations
            if (s.mark) {
              this.rect(cx - 1.5, cursorY + seg.size * 0.08, seg.w + 3, seg.size * 1.1, this.C.mark);
            }
            var font = this.font(s);
            var base = seg.baseSize || fontSize;
            var baseline = cursorY + base;
            if (s.sup) baseline -= base * 0.30;
            else if (s.sub) baseline += base * 0.14;
            this.host.drawTextSafe(this.page, this.host.safeText(font, seg.text), {
              x: cx,
              y: this.pdfY(baseline),
              size: seg.size,
              font: font,
              color: override || this.colorFor(s)
            });
            if (s.link) {
              var underY = cursorY + seg.size + 1.5;
              this.line(cx, underY, cx + seg.w, underY, this.C.link, 0.6);
              this.links.push({
                page: this.page,
                url: s.link,
                rect: [cx, this.pdfY(underY + 1), cx + seg.w, this.pdfY(cursorY)]
              });
            }
            if (s.strike) {
              this.line(cx, cursorY + seg.size * 0.5, cx + seg.w, cursorY + seg.size * 0.5, this.C.muted, 0.6);
            }
          }
          cx += seg.w;
        }, this);

        cursorY += lineHeight;
      }, this);

      return cursorY;
    }

    // ---- block dispatcher -------------------------------------------------
    async render(blocks) {
      for (var i = 0; i < blocks.length; i++) await this.block(blocks[i], blocks[i + 1]);
    }

    // Rough height of the next block, used to keep headings with what follows.
    blockPreviewHeight(b) {
      if (!b || b.type === 'pagebreak') return 0;
      var fs = this.o.fontSize;
      var lines = (inlines, width, size) => this.wrap(inlines || [], width, size || fs);
      switch (b.type) {
        case 'title': {
          var t = lines(b.inlines, this.contentW - 40, 18);
          return t.length * 18 * 1.3 + 92;
        }
        case 'heading': {
          var lv = Math.min(Math.max(b.level || 2, 2), 6);
          var hs = { 2: 13, 3: 11.5, 4: 10.5, 5: 10, 6: 10 }[lv];
          var hl = lines(b.inlines, this.contentW, hs);
          return (lv === 2 ? 16 : 10) + hl.length * hs * 1.35 + (lv === 2 ? 8 : 5);
        }
        case 'table':
          return this.tableHeight(b).total;
        case 'abstract': {
          var al = lines(b.inlines, this.contentW - 40, fs);
          return 16 + 14 + 10 + al.length * fs * 1.5 + 30;
        }
        case 'math': {
          var ml = lines(b.inlines, this.contentW, fs * 1.05);
          return ml.length * fs * 1.05 * 1.7 + 10;
        }
        case 'quote': {
          var ql = lines(b.inlines, this.contentW - 36, fs);
          var qh = ql.length * fs * 1.5 + 22;
          var attrib = b.attribution || b.author
            ? lines([{ text: String(b.attribution || b.author) }], this.contentW - 36, fs * 0.9)
            : [];
          return qh + attrib.length * fs * 0.9 * 1.5 + 16;
        }
        case 'code': {
          var cl = String(b.text || '').split(/\r?\n/).length;
          return cl * fs * 1.35 + 32;
        }
        case 'list': {
          var total = 0;
          (b.items || []).forEach((item) => {
            var first = (item.blocks && item.blocks[0]) || { inlines: [{ text: '' }] };
            total += lines(first.inlines, this.contentW - 26, fs).length * fs * this.o.lineHeight + 5;
          }, this);
          return total;
        }
        case 'image':
          return 120;
        case 'paragraph':
          return lines(b.inlines, this.contentW, fs).length * fs * this.o.lineHeight + this.o.paragraphGap;
        default:
          return fs * this.o.lineHeight * 2;
      }
    }

    async block(b, next) {
      if (b.type === 'anchor') {
        this.markAnchor(b.id, this.y);
        return;
      }
      if (b.id && b.type !== 'heading' && b.type !== 'pagebreak') {
        this.markAnchor(b.id, this.y);
      }
      switch (b.type) {
        case 'title': return this.title(b);
        case 'author': return this.author(b);
        case 'heading': return this.heading(b, next);
        case 'toc': return this.toc(b);
        case 'abstract': return this.abstract(b);
        case 'paragraph': return this.paragraph(b);
        case 'quote': return this.quote(b);
        case 'code': return this.code(b);
        case 'list': return this.list(b);
        case 'table': return this.table(b);
        case 'hr': return this.hr();
        case 'image': return this.image(b);
        case 'math': return this.math(b);
        case 'pagebreak': this.newPage(); return;
      }
    }

    title(b) {
      var size = 18;
      var inlines = (b.inlines || []).map(function (i) { return Object.assign({}, i, { bold: true }); });
      var lines = this.wrap(inlines, this.contentW - 40, size);
      var bandH = lines.length * size * 1.3 + 20;
      this.ensure(bandH + 60);
      this.markAnchor(b.id || slugify(this.host._plain(b.inlines)), this.y);

      this.rect(this.m.left - 16, this.y, this.contentW + 32, bandH, this.C.surface);
      var top = this.drawLines(lines, this.m.left + 20, this.y + 10, this.contentW - 40, {
        align: 'center', color: this.col('headingEmphasis'), fontSize: size, lineHeight: size * 1.3
      });
      this.y += bandH + 12;

      if (this.o.author) {
        this.drawMixed(String(this.o.author), this.y + 10.5, 10.5,
          { italic: true }, this.col('muted'), { align: 'center' });
        this.y += 20;
      }

      this.y += 14;
    }

    author(b) {
      var size = 11;
      var inlines = (b.inlines || []).map(function (i) { return Object.assign({}, i, { italic: true }); });
      var lines = this.wrap(inlines, this.contentW, size);
      this.ensure(lines.length * size * 1.5 + 20);
      this.drawLines(lines, this.m.left, this.y, this.contentW, {
        align: 'center', color: this.col('muted'), fontSize: size, lineHeight: size * 1.5, italic: true
      });
      this.y += lines.length * size * 1.5 + 16;
    }

    toc(b) {
      var fs = Math.max(9.5, this.o.fontSize - 0.5);
      var lh = fs * this.o.lineHeight;
      var headSize = 12;
      var headLines = this.wrap([{ text: 'Contents', bold: true }], this.contentW, headSize);

      // When indexing is enabled, reserve a fixed gutter for section numbers
      // and space on the right for page indices, which are filled in after the
      // whole document is laid out. Otherwise use the full text width.
      var indexed = this.o.tocIndex !== false;
      var entries = b.entries || [];
      var numGutter = 0;
      entries.forEach(function (entry) {
        if (entry.num) numGutter = Math.max(numGutter, this.measure(entry.num, { bold: true }, fs));
      }, this);
      numGutter = numGutter ? numGutter + 12 : 0;
      var pageW = indexed ? this.measure('999', {}, fs) + 14 : 0;
      var textW = Math.max(24, this.contentW - numGutter - pageW);

      this.tocRows = [];
      var rows = entries.map(function (entry) {
        var indent = Math.min(Math.max(0, (Number(entry.level) - 2) * 9), textW / 2);
        var inlines = [{ text: entry.text, link: '#' + entry.id }];
        return {
          entry: entry,
          indent: indent,
          lines: this.wrap(inlines, textW - indent, fs)
        };
      }, this);
      var headH = headLines.length * headSize * 1.3;
      var headerH = headH + 5 + 10;
      // The heading and rule are repeated at the top of every TOC page.
      var drawHeader = function () {
        var top = this.y;
        this.drawLines(headLines, this.m.left, top, this.contentW, {
          fontSize: headSize, lineHeight: headSize * 1.3, color: this.col('heading')
        });
        top += headH + 5;
        this.line(this.m.left, top, this.m.left + this.contentW, top, this.C.border, 0.6);
        this.y = top + 10;
      };

      var started = false;
      rows.forEach(function (row) {
        var rowH = Math.max(row.lines.length * lh, fs * 1.3);
        // Check the whole row, not just the block as a whole: a long TOC must
        // flow onto new pages instead of being drawn past the bottom margin.
        if (this.y + (started ? 0 : headerH) + rowH > this.maxY) {
          this.newPage();
          started = false;
        }
        if (!started) {
          drawHeader.call(this);
          started = true;
        }

        var rowTop = this.y;
        if (indexed && row.entry.num) {
          var nw = this.measure(row.entry.num, { bold: true }, fs);
          this.drawMixed(row.entry.num, rowTop + fs, fs, { bold: true, number: true },
            this.col('accent'), { x: this.m.left + numGutter - nw - 6 });
        }
        this.drawLines(row.lines, this.m.left + numGutter + row.indent, rowTop,
          textW - row.indent, { fontSize: fs, lineHeight: lh });
        // The heading's page is not known until later blocks are laid out, so
        // remember where to draw the index in finishToc().
        if (indexed) {
          this.tocRows.push({ id: row.entry.id, page: this.page, top: rowTop + fs, size: fs });
        }
        this.y += rowH;
      }, this);
      if (started) this.y += 6;
    }

    // Draw page indices beside TOC rows once all heading anchors are known.
    finishToc() {
      if (this.o.tocIndex === false || !this.tocRows || !this.tocRows.length) return;
      var self = this;
      this.tocRows.forEach(function (row) {
        var target = self.findAnchor('#' + row.id);
        if (!target || !target.page) return;
        var index = self.pages.indexOf(target.page) + 1;
        if (!index) return;
        var text = String(index);
        var tw = self.measure(text, {}, row.size);
        self.host.drawTextSafe(row.page, text, {
          x: self.w - self.m.right - tw,
          y: self.pdfY(row.top),
          size: row.size,
          font: self.font({}),
          color: self.col('muted')
        });
      });
    }

    heading(b, next) {
      var lv = Math.min(Math.max(b.level || 2, 2), 6);
      this.headingNums[lv]++;
      for (var k = lv + 1; k < 6; k++) this.headingNums[k] = 0;

      var num = '';
      for (var j = 2; j <= lv; j++) {
        if (this.headingNums[j]) num += this.headingNums[j] + '.';
      }

      var sizes = { 2: 13, 3: 11.5, 4: 10.5, 5: 10, 6: 10 };
      var size = sizes[lv];
      var showNums = !!(this.o.numberHeadings && num);
      // Keep the numbers in a fixed gutter so every heading title starts on
      // the same vertical line, with no bars or staggered indentation.
      var gutter = showNums ? this.measure('1.1.1.1.', { bold: true }, 13) + 8 : 0;
      var inlines = (b.inlines || []).map(function (i) {
        return Object.assign({}, i, { bold: true });
      });
      var before = lv === 2 ? 16 : 10;
      var after = lv === 2 ? 8 : 5;
      var lines = this.wrap(inlines, this.contentW - gutter, size);
      var height = lines.length * size * 1.35;
      var own = before + height + after;

      // Keep a heading with the block that follows it. Tables are kept whole;
      // for other blocks, reserve at least three lines of body text.
      if (next && next.type !== 'pagebreak') {
        var pageTop = this.o.runningHead ? this.m.top + 4 : this.m.top;
        var room = Math.max(0, this.maxY - pageTop);
        var nextH = this.blockPreviewHeight(next);
        if (next.type !== 'table') {
          nextH = Math.min(nextH, this.o.fontSize * this.o.lineHeight * 3);
        }
        var keep = Math.min(nextH, Math.max(0, room - own));
        if (keep && this.y + own + keep > this.maxY) this.newPage();
      }

      this.ensure(own);
      var top = this.y + before;
      this.markAnchor(this.slugForBlock(b), top);
      if (showNums) {
        this.drawMixed(num, top + size, size, { bold: true, number: true },
          this.col('accent'), { x: this.m.left });
      }
      this.y = this.drawLines(lines, this.m.left + gutter, top, this.contentW - gutter, {
        align: 'left', fontSize: size, lineHeight: size * 1.35,
        color: lv <= 3 ? this.col('headingEmphasis') : undefined
      });
      this.y += after;
    }

    abstract(b) {
      var size = this.o.fontSize;
      var labelSize = 9;
      var labelLines = this.wrap([{ text: 'A B S T R A C T', bold: true }], this.contentW - 40, labelSize);
      var lines = this.wrap(b.inlines || [], this.contentW - 40, size);
      var lh = size * 1.5;
      var height = 16 + labelLines.length * 14 + 10 + lines.length * lh + 14;
      this.ensure(height);

      this.card(this.m.left, this.y, this.contentW, height, this.C.surface);
      this.rect(this.m.left, this.y, 3, height, this.C.accent);

      var top = this.drawLines(labelLines, this.m.left + 18, this.y + 16, this.contentW - 40, {
        align: 'left', color: this.col('accent'), fontSize: labelSize, lineHeight: 14
      });
      this.drawLines(lines, this.m.left + 18, top + 8, this.contentW - 40, {
        align: this.o.justify ? 'justify' : 'left', fontSize: size, lineHeight: lh
      });
      this.y += height + 16;
    }

    math(b) {
      var fs = this.o.fontSize * 1.05;
      var lines = this.wrap(b.inlines || [], this.contentW, fs);
      var lh = fs * 1.7;
      var height = lines.length * lh + 10;
      this.ensure(height);
      this.y += 4;
      var bottom = this.drawLines(lines, this.m.left, this.y, this.contentW, {
        align: 'center', fontSize: fs, lineHeight: lh
      });
      this.y = bottom + 6;
    }

    paragraph(b, indent, gap) {
      indent = indent || 0;
      var after = gap == null ? this.o.paragraphGap : gap;
      var fs = this.o.fontSize;
      var lines = this.wrap(b.inlines || [], this.contentW - indent, fs);
      var height = lines.length * fs * this.o.lineHeight + after;
      this.ensure(height);
      var align = b.align || (this.o.justify ? 'justify' : 'left');
      if (align === 'left' && this.o.justify && !b.align) align = 'justify';
      this.y = this.drawLines(lines, this.m.left + indent, this.y, this.contentW - indent, {
        align: align, fontSize: fs
      });
      this.y += after;
    }

    quote(b) {
      var inlines = [];
      (b.blocks || []).forEach(function (child) {
        if (child.inlines) inlines = inlines.concat(child.inlines, [{ text: ' ' }]);
      });
      var fs = this.o.fontSize - 0.5;
      var padX = 14;
      var padY = 9;
      var textW = this.contentW - padX * 2;
      var lines = this.wrap(inlines, textW, fs);
      var attrLines = b.attribution ? this.wrap(b.attribution, textW, fs) : [];
      var lh = fs * 1.5;
      var gap = attrLines.length ? 4 : 0;
      var height = lines.length * lh + gap + attrLines.length * lh + padY * 2;
      this.ensure(height + 8);

      // Panel and left rule are flush with the normal text margins; only the
      // text inside keeps a small padding so it does not touch the border.
      this.card(this.m.left, this.y, this.contentW, height, this.C.surface);
      this.rect(this.m.left, this.y, 3, height, this.C.quoteBar);
      var bottom = this.drawLines(lines, this.m.left + padX, this.y + padY, textW, {
        align: this.o.justify ? 'justify' : 'left',
        color: this.col('quoteText'), fontSize: fs, lineHeight: lh, italic: true
      });
      if (attrLines.length) {
        this.drawLines(attrLines, this.m.left + padX, bottom + gap, textW, {
          align: 'right', color: this.col('muted'), fontSize: fs, lineHeight: lh, italic: true
        });
      }
      this.y += height + 8;
    }

    code(b) {
      // Keep code blocks flat (background only, no border) and a bit smaller
      // than body copy. Padding and trailing spacing stay compact.
      var fs = Math.max(8.5, this.o.fontSize - 1);
      var lineH = fs * 1.45;
      var pad = 10;
      var flat = [];
      String(b.text || '').split('\n').forEach(function (line) {
        var wrapped = this.wrap([{ text: line || ' ', code: true, codeBlock: true }], this.contentW - pad * 2, fs);
        flat.push.apply(flat, wrapped.length ? wrapped : [[{ text: '', s: { code: true, codeBlock: true }, size: fs, w: 0 }]]);
      }, this);

      var chunk = [];
      var flush = function () {
        if (!chunk.length) return;
        var height = chunk.length * lineH + pad * 2;
        this.ensure(height);
        this.rect(this.m.left, this.y, this.contentW, height, this.C.codeBg);
        if (!this.measureOnly) {
          var top = this.y + pad;
          chunk.forEach(function (line) {
            var cx = this.m.left + pad;
            line.forEach(function (seg) {
              var font = this.font(seg.s);
              var text = this.host.safeText(font, seg.text);
              this.host.drawTextSafe(this.page, text, {
                x: cx,
                y: this.pdfY(top + seg.size),
                size: seg.size,
                font: font,
                color: this.col('codeFg')
              });
              cx += seg.w;
            }, this);
            top += lineH;
          }, this);
        }
        this.y += height;
        chunk = [];
      }.bind(this);

      flat.forEach(function (line) {
        if (chunk.length * lineH + pad * 2 + lineH > this.maxY) flush();
        chunk.push(line);
      }, this);
      flush();
      this.y += 10;
    }

    // Render a nested block inside a list item. Shifting the left margin lets
    // code blocks, nested lists and quotes keep their own block layouts.
    async blockWithIndent(child, indent) {
      if (!indent) return this.block(child);
      var left = this.m.left;
      this.m.left += indent;
      try {
        if (child.type === 'paragraph') return this.paragraph(child, 0, 4);
        return await this.block(child);
      } finally {
        this.m.left = left;
      }
    }

    async list(b) {
      var fs = this.o.fontSize;
      var textIndent = 26;
      // A nested list starts one extra step past its parent's text, so every
      // level is visibly deeper instead of sharing the parent's hanging indent.
      var nestedExtra = 18;
      var n = b.start || 1;

      for (var i = 0; i < (b.items || []).length; i++) {
        var item = b.items[i];
        var marker = b.ordered ? n++ + '.' : '•';
        if (item.checked === true) marker = '[x]';
        else if (item.checked === false) marker = '[ ]';

        var drawMarker = function () {
          if (this.measureOnly) return;
          var markerFont = this.font({ bold: true });
          this.host.drawTextSafe(this.page, this.host.safeText(markerFont, marker), {
            x: this.m.left,
            y: this.pdfY(this.y + fs),
            size: fs * 0.95,
            font: markerFont,
            color: this.col('accent')
          });
        }.bind(this);

        var blocks = item.blocks && item.blocks.length
          ? item.blocks
          : [{ type: 'paragraph', inlines: [{ text: '' }], align: 'left' }];

        for (var j = 0; j < blocks.length; j++) {
          var child = blocks[j];
          if (j === 0 && child.type === 'paragraph') {
            var lines = this.wrap(child.inlines || [], this.contentW - textIndent, fs);
            var height = lines.length * fs * this.o.lineHeight + 2;
            this.ensure(height);
            drawMarker();
            this.y = this.drawLines(lines, this.m.left + textIndent, this.y, this.contentW - textIndent, {
              align: this.o.justify ? 'justify' : 'left', fontSize: fs
            });
            this.y += 2;
          } else {
            if (j === 0) drawMarker();
            var childIndent = child.type === 'list' ? textIndent + nestedExtra : textIndent;
            await this.blockWithIndent(child, childIndent);
          }
        }
        this.y += 3;
      }
    }

    // Measurements shared by the table renderer and heading keep-with-next.
    tableHeight(b) {
      var fs = 9.5;
      var cols = Math.max(1, (b.header || (b.rows[0] || [])).length);
      var colW = this.contentW / cols;
      var padY = 5;
      var lineH = fs * 1.35;
      function prepared(row) {
        return (row || []).map(function (cell) {
          return this.wrap(cell, colW - 20, fs);
        }, this);
      }
      var header = prepared.call(this, b.header || []);
      var rows = (b.rows || []).map(function (row) { return prepared.call(this, row); }, this);
      var rowHeight = function (cells) {
        var maxLines = Math.max.apply(null, cells.map(function (c) { return c.length; }));
        return Math.max(lineH, maxLines * lineH) + padY * 2;
      };
      var headerH = header.length ? rowHeight(header) : 0;
      var rowsH = rows.reduce(function (a, r) { return a + rowHeight(r); }, 0);
      return { headerH: headerH, rowsH: rowsH, total: headerH + rowsH + 10 };
    }

    table(b) {
      var fs = 9.5;
      var cols = Math.max(1, (b.header || (b.rows[0] || [])).length);
      var colW = this.contentW / cols;
      var padX = 10;
      var padY = 5;
      var lineH = fs * 1.35;

      function prepare(row, isHeader) {
        return (row || []).map(function (cell) {
          return this.wrap(cell, colW - padX * 2, fs).map(function (line) {
            return line.map(function (seg) {
              if (!isHeader) return seg;
              return Object.assign({}, seg, {
                text: String(seg.text).toUpperCase(),
                s: Object.assign({}, seg.s, { bold: true })
              });
            });
          });
        }, this);
      }
      var header = prepare.call(this, b.header || [], true);
      var rows = (b.rows || []).map(function (row) { return prepare.call(this, row, false); }, this);
      var rowHeight = function (cells) {
        var maxLines = Math.max.apply(null, cells.map(function (c) { return c.length; }));
        return Math.max(lineH, maxLines * lineH) + padY * 2;
      };

      // Move the whole table to a fresh page when it does not fit here. A table
      // taller than a full page still has to split, with its header repeated.
      var fit = this.tableHeight(b);
      var pageTop = this.o.runningHead ? this.m.top + 4 : this.m.top;
      var pageRoom = Math.max(0, this.maxY - pageTop);
      var oversized = fit.total > pageRoom;
      if (!oversized && this.y + fit.total > this.maxY) this.newPage();

      // Dark theme-coloured header, very subtly striped white body rows, a
      // stronger outer border and lighter rules between rows.
      var outer = this.C.tableBorder || this.C.border;
      var rowBorder = this.C.tableRowBorder || outer;
      var left = this.m.left;
      var right = this.w - this.m.right;
      var drawOuterBottom = function () {
        this.line(left, this.y, right, this.y, outer, 0.9);
      }.bind(this);
      var drawRow = function (cells, height, bg, colorValue, topColor, topWidth,
                              bottomColor, bottomWidth) {
        this.ensure(height);
        var top = this.y;
        this.rect(left, top, this.contentW, height, bg);
        cells.forEach(function (cell, i) {
          var textTop = top + padY;
          cell.forEach(function (line) {
            this.drawLines([line], left + i * colW + padX, textTop, colW - padX * 2, {
              align: 'left', color: this.col(colorValue), fontSize: fs, lineHeight: lineH
            });
            textTop += lineH;
          }, this);
        }, this);
        // Row fills cover the previous row's rules, so redraw the top rule on
        // each row; the outer edges stay stronger than the internal separators.
        this.line(left, top, right, top, topColor || rowBorder, topWidth || 0.5);
        this.line(left, top, left, top + height, outer, 0.9);
        this.line(right, top, right, top + height, outer, 0.9);
        this.line(left, top + height, right, top + height,
          bottomColor || rowBorder, bottomWidth || 0.5);
        this.y += height;
      }.bind(this);

      var firstRow = true;
      var afterHeader = false;
      var bodyRowIndex = 0;
      if (header.length) {
        this.ensure(rowHeight(header));
        drawRow(header, rowHeight(header), this.C.tableHeaderBg, 'tableHeaderText',
          outer, 0.9, outer, 0.9);
        firstRow = false;
        afterHeader = true;
      }
      rows.forEach(function (row) {
        if (oversized && this.y + rowHeight(row) > this.maxY) {
          drawOuterBottom();
          this.newPage();
          if (header.length) {
            this.ensure(rowHeight(header));
            drawRow(header, rowHeight(header), this.C.tableHeaderBg, 'tableHeaderText',
              outer, 0.9, outer, 0.9);
            firstRow = false;
            afterHeader = true;
          } else {
            firstRow = true;
            afterHeader = false;
          }
        }
        var useOuterTop = firstRow || afterHeader;
        var rowBg = (bodyRowIndex++ % 2 === 1)
          ? (this.C.tableStripeBg || this.C.tableRowBg)
          : this.C.tableRowBg;
        drawRow(row, rowHeight(row), rowBg, 'text',
          useOuterTop ? outer : rowBorder, useOuterTop ? 0.9 : 0.5,
          rowBorder, 0.5);
        firstRow = false;
        afterHeader = false;
      }, this);
      if (header.length || rows.length) drawOuterBottom();
      this.y += 10;
    }

    hr() {
      this.ensure(40);
      var mid = this.y + 20;
      var edge = this.contentW * 0.3;
      this.line(this.m.left, mid, this.m.left + edge, mid, this.C.border, 0.6);
      this.line(this.m.left + edge, mid, this.w - this.m.right - edge, mid, this.C.accent, 1.1);
      this.line(this.w - this.m.right - edge, mid, this.w - this.m.right, mid, this.C.border, 0.6);
      this.y += 40;
    }

    async image(b) {
      var src = b.src || '';
      var img = null;
      if (src) {
        try {
          img = await this.host._embedImage(src);
        } catch (err) {
          console.warn('pdfFromHtml: image could not be embedded:', src, err);
        }
      }

      if (!img) {
        var label = '[Figure: ' + (b.alt || 'unavailable') + ']';
        var lines = this.wrap([{ text: label, s: { italic: true } }], this.contentW, this.o.fontSize);
        this.ensure(lines.length * this.o.fontSize * this.o.lineHeight + 12);
        this.drawLines(lines, this.m.left, this.y, this.contentW, {
          align: 'center', color: this.col('muted'), fontSize: this.o.fontSize, italic: true
        });
        this.y += lines.length * this.o.fontSize * this.o.lineHeight + 12;
        return;
      }

      this.figureNo++;
      var maxW = this.contentW;
      var maxH = this.maxY - this.y - 46;
      if (maxH < 40) { this.newPage(); maxH = this.maxY - this.y - 46; }

      var iw = img.width, ih = img.height;
      var ew = Number(b.width) || 0, eh = Number(b.height) || 0;
      if (ew && eh) { iw = ew; ih = eh; }
      else if (ew) { ih = ih * ew / iw; iw = ew; }
      else if (eh) { iw = iw * eh / ih; ih = eh; }
      var scale = Math.min(maxW / iw, maxH / ih, 1);
      iw *= scale; ih *= scale;

      this.ensure(ih + 34);
      var x = this.m.left;
      if (b.align === 'center') x += (maxW - iw) / 2;
      else if (b.align === 'right') x += maxW - iw;

      this.page.drawImage(img, { x: x, y: this.pdfY(this.y + ih), width: iw, height: ih });
      this.y += ih + 8;

      if (b.alt) {
        var caption = 'Figure ' + this.figureNo + '. ' + b.alt;
        // Start the caption at the image's left edge and keep it inside the
        // right margin instead of centering it on the page.
        var capW = this.w - this.m.right - x;
        var clines = this.wrap([{ text: caption, s: { italic: true } }], capW, 8.5);
        this.drawLines(clines, x, this.y, capW, {
          align: 'left', color: this.col('muted'), fontSize: 8.5, lineHeight: 12, italic: true
        });
        this.y += clines.length * 12;
      }
      this.y += 14;
    }

    finish() {
      var total = this.pages.length;
      var font = this.host._fonts.sans;
      var host = this.host;

      // faint diagonal watermark, centred on each page. mixedRuns() keeps
      // emoji/script spans in their own fonts instead of losing them to '?'.
      var mark = String(this.o.watermark || '').trim();
      if (mark) {
        var markRuns = this.mixedRuns(mark);
        var unitW = markRuns.reduce(function (n, r) {
          return n + host.measureSafe(r.font, r.text, 1);
        }, 0) || 1;
        var size = Math.max(12, Math.min(58, (this.w * 0.72) / unitW));
        var markW = markRuns.reduce(function (n, r) {
          return n + host.measureSafe(r.font, r.text, size);
        }, 0);
        var angle = -30;
        var rad = angle * Math.PI / 180;
        var rotation = this.host._lib().degrees(angle);
        var cos = Math.cos(rad);
        var sin = Math.sin(rad);
        // Compensate for pdf-lib rotating text around its baseline start.
        var x = this.w / 2 - ((markW / 2) * cos - (size / 2) * sin);
        var y = this.h / 2 - ((markW / 2) * sin + (size / 2) * cos);
        this.pages.forEach(function (page) {
          var u = 0;
          markRuns.forEach(function (r) {
            if (!r.text) return;
            this.host.drawTextSafe(page, r.text, {
              x: x + u * cos, y: y + u * sin, size: size, font: r.font,
              color: this.col('accent'), opacity: 0.09, rotate: rotation
            });
            u += this.host.measureSafe(r.font, r.text, size);
          }, this);
        }, this);
      }

      // footer text on the left, page numbers on the right
      var foot = String(this.o.footerText || '').trim();
      if (foot) {
        var footRuns = this.mixedRuns(foot);
        var avail = this.w - this.m.left - this.m.right - (this.o.pageNumbers ? 64 : 0);
        var rawW = footRuns.reduce(function (n, r) {
          return n + host.measureSafe(r.font, r.text, 8.5);
        }, 0);
        var footSize = (rawW > avail && rawW > 0) ? Math.max(6, 8.5 * avail / rawW) : 8.5;
        this.pages.forEach(function (page) {
          var fx = this.m.left;
          footRuns.forEach(function (r) {
            if (!r.text) return;
            this.host.drawTextSafe(page, r.text, {
              x: fx, y: this.m.bottom / 2 - 4, size: footSize,
              font: r.font, color: this.col('muted')
            });
            fx += this.host.measureSafe(r.font, r.text, footSize);
          }, this);
        }, this);
      }

      if (this.o.pageNumbers) {
        this.pages.forEach(function (page, i) {
          var text = String(i + 1) + ' / ' + total;
          text = this.host.safeText(font, text);
          var tw = this.host.measureSafe(font, text, 8.5);
          this.host.drawTextSafe(page, text, {
            x: this.w - this.m.right - tw,
            y: this.m.bottom / 2 - 4,
            size: 8.5,
            font: font,
            color: this.col('muted')
          });
        }, this);
      }

      // clickable links — #fragment links become in-document GoTo actions
      this.links.forEach(function (link) {
        try {
          var lib = this.host._lib();
          var target = /^#/.test(link.url) ? this.findAnchor(link.url) : null;
          var action;
          if (target && target.page.ref) {
            var xyz = lib.PDFName ? lib.PDFName.of('XYZ') : 'XYZ';
            action = {
              S: 'GoTo',
              D: [target.page.ref, xyz, null, target.y, null]
            };
          } else {
            action = { S: 'URI', URI: lib.PDFString.of(link.url) };
          }
          var annot = this.pdf.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: link.rect,
            Border: [0, 0, 0],
            A: action
          });
          link.page.node.addAnnot(annot);
        } catch (e) { /* annotations are optional */ }
      }, this);
    }
  }

  global.pdfFromHtml = pdfFromHtml;
  if (typeof module !== 'undefined' && module.exports) module.exports = pdfFromHtml;
  return pdfFromHtml;
})(typeof window !== 'undefined' ? window : globalThis);
