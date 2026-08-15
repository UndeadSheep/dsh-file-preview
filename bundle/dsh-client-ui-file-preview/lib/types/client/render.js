/**
 * Pure renderers shared by the preview and editor surfaces.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/render
 */
const DQ = '"';
const SQ = "'";
const TAB = '\t';
const LF = '\n';
const CR = '\r';
const BT = '`';
const BS = '\\';
export const DEFAULT_COLORS = {
    keyword: '#a626a4',
    string: '#50a14f',
    number: '#986801',
    comment: '#a0a1a7',
    tag: '#e45649',
    function: '#4078f2',
    type: '#c18401',
    variable: '#1a1a1a',
};
export function escapeHtml(value) {
    return value
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split(DQ).join('&quot;')
        .split(SQ).join('&#39;');
}
function isDigit(c) { return c >= '0' && c <= '9'; }
function isWordStart(c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$'; }
function isWordChar(c) { return isWordStart(c) || isDigit(c); }
const JS_KEYWORDS = ['var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'typeof', 'instanceof', 'this', 'class', 'extends', 'super', 'import', 'export', 'default', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield', 'null', 'undefined', 'true', 'false', 'of', 'in', 'delete', 'void', 'static', 'get', 'set'];
const JSON_KEYWORDS = ['true', 'false', 'null'];
const PY_KEYWORDS = ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'class', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'pass', 'break', 'continue', 'global', 'nonlocal', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is', 'del', 'yield', 'assert'];
const SH_KEYWORDS = ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'echo', 'export', 'local', 'return', 'exit', 'in', 'readonly', 'set', 'unset'];
const SQL_KEYWORDS = ['select', 'from', 'where', 'and', 'or', 'not', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table', 'drop', 'alter', 'join', 'left', 'right', 'inner', 'outer', 'on', 'group', 'by', 'order', 'having', 'limit', 'offset', 'distinct', 'as', 'null', 'primary', 'key', 'foreign', 'references'];
function keywordsFor(lang) {
    if (lang === 'js')
        return JS_KEYWORDS;
    if (lang === 'json')
        return JSON_KEYWORDS;
    if (lang === 'py')
        return PY_KEYWORDS;
    if (lang === 'sh')
        return SH_KEYWORDS;
    if (lang === 'sql')
        return SQL_KEYWORDS;
    return [];
}
export function langFor(path) {
    const lower = path.toLowerCase();
    if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs') || lower.endsWith('.jsx') || lower.endsWith('.ts') || lower.endsWith('.tsx'))
        return 'js';
    if (lower.endsWith('.json'))
        return 'json';
    if (lower.endsWith('.xml') || lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.svg') || lower.endsWith('.xhtml'))
        return 'xml';
    if (lower.endsWith('.py'))
        return 'py';
    if (lower.endsWith('.sh') || lower.endsWith('.bash') || lower.endsWith('.zsh'))
        return 'sh';
    if (lower.endsWith('.sql'))
        return 'sql';
    if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.less'))
        return 'css';
    if (lower.endsWith('.yml') || lower.endsWith('.yaml') || lower.endsWith('.toml') || lower.endsWith('.ini') || lower.endsWith('.cfg') || lower.endsWith('.conf'))
        return 'yaml';
    return null;
}
export function isMdPath(path) {
    const lower = path.toLowerCase();
    return lower.endsWith('.md') || lower.endsWith('.markdown');
}
export function highlight(code, lang, colors = {}) {
    const xml = lang === 'xml';
    const keywords = keywordsFor(lang);
    const palette = { ...DEFAULT_COLORS, ...colors };
    const out = [];
    let i = 0;
    const n = code.length;
    const push = (token, kind) => {
        if (kind === null || !palette[kind]) {
            out.push(escapeHtml(token));
            return;
        }
        const extra = kind === 'comment' ? ';font-style:italic' : '';
        out.push(`<span style="color:${palette[kind]}${extra}">${escapeHtml(token)}</span>`);
    };
    while (i < n) {
        const c = code.charAt(i);
        if (c === '/' && code.charAt(i + 1) === '/') {
            let j = i + 2;
            while (j < n && code.charAt(j) !== LF && code.charAt(j) !== CR)
                j++;
            push(code.slice(i, j), 'comment');
            i = j;
            continue;
        }
        if (c === '/' && code.charAt(i + 1) === '*') {
            let j = i + 2;
            while (j < n && !(code.charAt(j) === '*' && code.charAt(j + 1) === '/'))
                j++;
            if (j < n)
                j += 2;
            push(code.slice(i, j), 'comment');
            i = j;
            continue;
        }
        if (c === '#' && (lang === 'py' || lang === 'sh' || lang === 'yaml')) {
            let j = i + 1;
            while (j < n && code.charAt(j) !== LF && code.charAt(j) !== CR)
                j++;
            push(code.slice(i, j), 'comment');
            i = j;
            continue;
        }
        if (xml && c === '<' && code.slice(i, i + 4) === '<!--') {
            let j = i + 4;
            while (j < n && code.slice(j, j + 3) !== '-->')
                j++;
            if (j < n)
                j += 3;
            push(code.slice(i, j), 'comment');
            i = j;
            continue;
        }
        if (xml && c === '<') {
            let j = i + 1;
            while (j < n && code.charAt(j) !== '>' && code.charAt(j) !== LF)
                j++;
            if (j < n)
                j += 1;
            push(code.slice(i, j), 'tag');
            i = j;
            continue;
        }
        if (c === DQ || c === SQ || c === BT) {
            const quote = c;
            let j = i + 1;
            while (j < n) {
                if (code.charAt(j) === BS) {
                    j += 2;
                    continue;
                }
                if (code.charAt(j) === quote) {
                    j += 1;
                    break;
                }
                j++;
            }
            push(code.slice(i, j), 'string');
            i = j;
            continue;
        }
        if (isDigit(c) || (c === '.' && isDigit(code.charAt(i + 1)))) {
            let j = i;
            while (j < n && (isDigit(code.charAt(j)) || code.charAt(j) === '.' || code.charAt(j) === '_'))
                j++;
            push(code.slice(i, j), 'number');
            i = j;
            continue;
        }
        if (isWordStart(c)) {
            let j = i + 1;
            while (j < n && isWordChar(code.charAt(j)))
                j++;
            const word = code.slice(i, j);
            let kind;
            if (keywords.includes(word))
                kind = 'keyword';
            else if (code.charAt(j) === '(')
                kind = 'function';
            else if (word.charAt(0) >= 'A' && word.charAt(0) <= 'Z')
                kind = 'type';
            else
                kind = 'variable';
            push(word, kind);
            i = j;
            continue;
        }
        push(c, null);
        i++;
    }
    return out.join('');
}
function ltrim(s) {
    let i = 0;
    while (i < s.length && (s.charAt(i) === ' ' || s.charAt(i) === TAB))
        i++;
    return s.slice(i);
}
function renderInline(s) {
    const parts = s.split('`');
    let out = '';
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 1)
            out += `<code>${parts[i]}</code>`;
        else {
            let p = parts[i] ?? '';
            p = p.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => `<img src="${url}" alt="${alt}" />`);
            p = p.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, txt, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`);
            p = p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            p = p.replace(/__([^_]+)__/g, '<strong>$1</strong>');
            p = p.replace(/~~([^~]+)~~/g, '<del>$1</del>');
            p = p.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
            p = p.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
            out += p;
        }
    }
    return out;
}
export function renderMarkdown(src) {
    let raw = src ?? '';
    raw = raw.split('\r\n').join('\n').split('\r').join('\n');
    const safe = escapeHtml(raw);
    const lines = safe.split('\n');
    const html = [];
    let i = 0;
    const n = lines.length;
    while (i < n) {
        const line = lines[i] ?? '';
        if (ltrim(line).slice(0, 3) === '```') {
            const lang = ltrim(line).slice(3).trim();
            const buf = [];
            i++;
            while (i < n && (lines[i] ?? '').trim() !== '```') {
                buf.push(lines[i] ?? '');
                i++;
            }
            i++;
            const code = buf.join('\n');
            const langAttr = lang ? ` class="language-${lang}"` : '';
            html.push(`<pre><code${langAttr}>${code}</code></pre>`);
            continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
            const level = (heading[1] ?? '').length;
            html.push(`<h${level}>${renderInline(heading[2] ?? '')}</h${level}>`);
            i++;
            continue;
        }
        if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line) && line.replace(/\s/g, '').length >= 3) {
            html.push('<hr />');
            i++;
            continue;
        }
        if (/^\s*>\s?/.test(line)) {
            const q = [];
            while (i < n && /^\s*>\s?/.test(lines[i] ?? '')) {
                q.push((lines[i] ?? '').replace(/^\s*>\s?/, ''));
                i++;
            }
            html.push(`<blockquote>${renderInline(q.join('<br />'))}</blockquote>`);
            continue;
        }
        const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
        const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
        if (bullet || numbered) {
            const ordered = !!numbered;
            const items = [];
            while (i < n) {
                const b = /^\s*[-*+]\s+(.*)$/.exec(lines[i] ?? '');
                const num = /^\s*(\d+)[.)]\s+(.*)$/.exec(lines[i] ?? '');
                if (b) {
                    items.push(b[1] ?? '');
                    i++;
                    continue;
                }
                if (num) {
                    items.push(num[1] ?? '');
                    i++;
                    continue;
                }
                break;
            }
            const tag = ordered ? 'ol' : 'ul';
            html.push(`<${tag}>${items.map(t => `<li>${renderInline(t)}</li>`).join('')}</${tag}>`);
            continue;
        }
        if (line.includes('|') && i + 1 < n && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i + 1] ?? '')) {
            const cells = (l) => {
                let t = l.trim();
                if (t.startsWith('|'))
                    t = t.slice(1);
                if (t.endsWith('|'))
                    t = t.slice(0, -1);
                return t.split('|').map(c => c.trim());
            };
            const header = cells(line);
            const rows = [];
            i += 2;
            while (i < n && (lines[i] ?? '').includes('|') && (lines[i] ?? '').trim() !== '') {
                rows.push(cells(lines[i] ?? ''));
                i++;
            }
            const th = header.map(c => `<th>${renderInline(c)}</th>`).join('');
            const trs = rows.map(r => `<tr>${r.map(c => `<td>${renderInline(c)}</td>`).join('')}</tr>`).join('');
            html.push(`<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`);
            continue;
        }
        if (line.trim() === '') {
            i++;
            continue;
        }
        const p = [];
        while (i < n && (lines[i] ?? '').trim() !== '' && !/^(#{1,6})\s/.test(lines[i] ?? '') && !ltrim(lines[i] ?? '').startsWith('```') && !/^\s*>\s?/.test(lines[i] ?? '') && !/^\s*[-*+]\s+/.test(lines[i] ?? '') && !/^\s*\d+[.)]\s+/.test(lines[i] ?? '')) {
            p.push(lines[i] ?? '');
            i++;
        }
        html.push(`<p>${renderInline(p.join(' '))}</p>`);
    }
    return html.join('\n');
}
/** Editor helpers. */
export function leadingIndent(line) {
    let i = 0;
    while (i < line.length && (line.charAt(i) === ' ' || line.charAt(i) === TAB))
        i++;
    return line.slice(0, i);
}
export function trimmedLine(line) {
    let end = line.length;
    while (end > 0 && (line.charAt(end - 1) === ' ' || line.charAt(end - 1) === TAB || line.charAt(end - 1) === CR || line.charAt(end - 1) === LF))
        end--;
    return line.slice(0, end);
}
export function indentUnit(cfg) {
    if (cfg.useTabs)
        return TAB;
    const n = cfg.indentSize && cfg.indentSize > 0 ? cfg.indentSize : 2;
    return ' '.repeat(n);
}
//# sourceMappingURL=render.js.map