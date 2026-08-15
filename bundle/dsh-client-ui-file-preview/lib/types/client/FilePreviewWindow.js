import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Browser half: the floating file-preview window and the header toggle button.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/FilePreviewWindow
 */
import { useEffect, useRef, useState } from 'react';
import { escapeHtml, highlight, indentUnit, isMdPath, langFor, leadingIndent, renderMarkdown, trimmedLine, } from "./render.js";
import css from './FilePreviewWindow.module.css';
/** Module-level open store shared by the header button and the overlay window. */
let mdOpen = false;
const openListeners = new Set();
function setOpen(value) {
    if (mdOpen === value)
        return;
    mdOpen = value;
    for (const fn of openListeners)
        fn();
}
function subscribeOpen(fn) {
    openListeners.add(fn);
    return () => { openListeners.delete(fn); };
}
/** Translate a structured business failure into user-facing text. */
function describeFailure(error) {
    switch (error.code) {
        case 'no-workspace': return '无工作区';
        case 'not-found': return '文件不存在';
        case 'not-text': return '不是文本文件，无法预览';
        case 'too-large': return '文件过大，暂不预览';
        case 'write-denied': return '写入被沙箱拒绝';
        case 'io-failure': return error.message ?? 'IO 错误';
        default: return error.code ?? '未知错误';
    }
}
/** Unwrap the two-level envelope (carrier `RemoteResult` + business `{ ok, value }`). */
function unwrap(carried) {
    if (!carried.ok)
        return { ok: false, error: carried.error.message };
    const result = carried.value;
    if (!result.ok)
        return { ok: false, error: describeFailure(result.error ?? {}) };
    return { ok: true, value: result.value };
}
const DEFAULT_CONFIG = { indentSize: 2, useTabs: false, pollInterval: 1500, fontSize: 13 };
function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
}
function viewport() {
    if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
        return { w: window.innerWidth, h: window.innerHeight };
    }
    return { w: 4096, h: 4096 };
}
const CORNER_CLASS = {
    'top-left': css.cornerTopLeft,
    'top-right': css.cornerTopRight,
    'bottom-left': css.cornerBottomLeft,
    'bottom-right': css.cornerBottomRight,
};
export function FilePreviewWindow({ remote, useSessions }) {
    const sessionId = useSessions(s => s?.current);
    const [open, setOpenState] = useState(mdOpen);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ w: 560, h: 600 });
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [expanded, setExpanded] = useState({});
    const [drag, setDrag] = useState(null);
    const [resize, setResize] = useState(null);
    const [pathInput, setPathInput] = useState('');
    const [file, setFile] = useState(null);
    const [source, setSource] = useState('');
    const [html, setHtml] = useState('');
    const [mode, setMode] = useState('preview');
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [tree, setTree] = useState([]);
    const [theme, setTheme] = useState({ colors: {}, bg: undefined, fg: undefined });
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const editorPreRef = useRef(null);
    useEffect(() => subscribeOpen(() => setOpenState(mdOpen)), []);
    useEffect(() => { if (open)
        reveal(); }, [open]);
    useEffect(() => { if (open && sessionId)
        void refreshTree(); }, [open, sessionId]);
    useEffect(() => {
        if (sessionId) {
            void refreshTree();
            void loadTheme();
            void loadConfig();
        }
    }, [sessionId]);
    useEffect(() => {
        if (!open || !sessionId)
            return;
        const id = setInterval(() => { void refreshTree(); }, config.pollInterval || 1500);
        return () => clearInterval(id);
    }, [open, sessionId, config.pollInterval]);
    function reveal() {
        const vp = viewport();
        const w = clamp(size.w, 320, Math.max(320, vp.w - 32));
        const h = clamp(size.h, 240, Math.max(240, vp.h - 32));
        setSize({ w, h });
        setPos({ x: Math.max(8, vp.w - w - 16), y: 16 });
    }
    async function refreshTree() {
        if (!sessionId)
            return;
        const res = unwrap(await remote.listTree({ sessionId }));
        if (res.ok)
            setTree(res.value);
    }
    async function loadTheme() {
        if (!sessionId)
            return;
        const res = unwrap(await remote.readTheme({ sessionId }));
        if (res.ok)
            setTheme({ colors: res.value.colors, bg: res.value.bg ?? undefined, fg: res.value.fg ?? undefined });
    }
    async function loadConfig() {
        if (!sessionId)
            return;
        const res = unwrap(await remote.readConfig({ sessionId }));
        if (res.ok)
            setConfig(res.value);
    }
    function refreshAll() {
        void refreshTree();
        void loadTheme();
        void loadConfig();
    }
    async function load(path) {
        if (!path || !sessionId)
            return;
        setLoading(true);
        setError(null);
        const res = unwrap(await remote.readFile({ sessionId, path }));
        if (res.ok) {
            const content = res.value.content;
            const isMarkdown = isMdPath(path);
            setFile({ path, name: res.value.path || path, isMarkdown });
            setSource(content);
            setHtml(isMarkdown ? renderMarkdown(content) : '');
            setDirty(false);
            setMode('preview');
        }
        else {
            setFile(null);
            setError(res.error);
        }
        setLoading(false);
    }
    async function save() {
        if (file === null || !sessionId)
            return;
        setLoading(true);
        const res = unwrap(await remote.writeFile({ sessionId, path: file.path, content: source }));
        if (res.ok) {
            setDirty(false);
            if (file.isMarkdown)
                setHtml(renderMarkdown(source));
        }
        else {
            setError(res.error);
        }
        setLoading(false);
    }
    function toggleDir(path) {
        setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
    }
    function changeFontSize(delta) {
        setConfig(c => ({ ...c, fontSize: clamp((c.fontSize || 13) + delta, 10, 32) }));
    }
    function switchToPreview() {
        if (file?.isMarkdown)
            setHtml(renderMarkdown(source));
        setMode('preview');
    }
    function handleKeyDown(e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            if (file !== null && dirty)
                void save();
        }
    }
    if (!open)
        return null;
    const fontSizePx = `${config.fontSize || 13}px`;
    const actions = (_jsxs("div", { className: css.actions, children: [_jsx("button", { className: css.modeBtn, title: "\u51CF\u5C0F\u5B57\u53F7", onClick: () => changeFontSize(-1), children: "A\u2212" }), _jsx("span", { className: css.fontSize, children: config.fontSize || 13 }), _jsx("button", { className: css.modeBtn, title: "\u589E\u5927\u5B57\u53F7", onClick: () => changeFontSize(1), children: "A+" }), _jsx("span", { className: css.sep }), _jsx("button", { className: mode === 'preview' ? `${css.modeBtn} ${css.modeBtnOn}` : css.modeBtn, onClick: switchToPreview, children: "\u9884\u89C8" }), _jsx("button", { className: mode === 'edit' ? `${css.modeBtn} ${css.modeBtnOn}` : css.modeBtn, onClick: () => setMode('edit'), children: "\u7F16\u8F91" }), _jsx("button", { className: css.saveBtn, disabled: file === null || !dirty, onClick: () => void save(), children: "\u4FDD\u5B58" })] }));
    let body = null;
    if (loading) {
        body = _jsx("div", { className: css.hint, children: "\u52A0\u8F7D\u4E2D\u2026" });
    }
    else if (error !== null) {
        body = _jsx("div", { className: `${css.scroll} ${css.error}`, children: error });
    }
    else if (file === null) {
        body = _jsx("div", { className: css.hint, children: "\u70B9\u51FB\u5DE6\u4FA7\u6587\u4EF6\u9884\u89C8" });
    }
    else if (mode === 'edit') {
        const lang = langFor(file.path);
        const editorHtml = (lang ? highlight(source, lang, theme.colors) : escapeHtml(source)) + '\n';
        const wrapStyle = theme.bg ? { background: theme.bg } : undefined;
        const preStyle = { fontSize: fontSizePx, color: theme.fg ?? '#1a1a1a' };
        const caretColor = theme.fg || '#1a1a1a';
        body = (_jsxs("div", { className: css.editorWrap, style: wrapStyle, children: [_jsx("pre", { ref: editorPreRef, className: css.editorBg, "aria-hidden": true, style: preStyle, dangerouslySetInnerHTML: { __html: editorHtml } }), _jsx("textarea", { className: css.editor, value: source, spellCheck: false, autoFocus: true, style: { caretColor, fontSize: fontSizePx }, onScroll: (e) => {
                        if (editorPreRef.current) {
                            editorPreRef.current.scrollTop = e.currentTarget.scrollTop;
                            editorPreRef.current.scrollLeft = e.currentTarget.scrollLeft;
                        }
                    }, onChange: (e) => { setSource(e.target.value); setDirty(true); }, onKeyDown: (e) => {
                        if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229)
                            return;
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            const ta = e.currentTarget;
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;
                            const before = source.slice(0, start);
                            const lineStart = before.lastIndexOf('\n') + 1;
                            const lineText = before.slice(lineStart);
                            let indent = leadingIndent(lineText);
                            const lastCh = trimmedLine(lineText).slice(-1);
                            if (lastCh === '{' || lastCh === '[' || lastCh === '(')
                                indent += indentUnit(config);
                            setSource(before + '\n' + indent + source.slice(end));
                            setDirty(true);
                            const cursor = start + 1 + indent.length;
                            requestAnimationFrame(() => ta.setSelectionRange(cursor, cursor));
                        }
                        else if (e.key === 'Tab') {
                            e.preventDefault();
                            const ta = e.currentTarget;
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;
                            const unit = indentUnit(config);
                            setSource(source.slice(0, start) + unit + source.slice(end));
                            setDirty(true);
                            const cursor = start + unit.length;
                            requestAnimationFrame(() => ta.setSelectionRange(cursor, cursor));
                        }
                        else if (e.key === '"' || e.key === "'" || e.key === '`') {
                            e.preventDefault();
                            const ta = e.currentTarget;
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;
                            setSource(source.slice(0, start) + e.key + source.slice(start, end) + e.key + source.slice(end));
                            setDirty(true);
                            const cursor = start === end ? start + 1 : end + 2;
                            requestAnimationFrame(() => ta.setSelectionRange(cursor, cursor));
                        }
                        else if (e.key === '(' || e.key === '[' || e.key === '{') {
                            e.preventDefault();
                            const ta = e.currentTarget;
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;
                            const close = e.key === '(' ? ')' : e.key === '[' ? ']' : '}';
                            setSource(source.slice(0, start) + e.key + source.slice(start, end) + close + source.slice(end));
                            setDirty(true);
                            const cursor = start === end ? start + 1 : end + 2;
                            requestAnimationFrame(() => ta.setSelectionRange(cursor, cursor));
                        }
                    } })] }));
    }
    else if (file.isMarkdown) {
        body = (_jsxs("div", { className: css.scroll, children: [_jsx("div", { className: css.meta, children: file.name }), _jsx("div", { className: css.out, style: { fontSize: fontSizePx }, dangerouslySetInnerHTML: { __html: html } })] }));
    }
    else {
        const lang = langFor(file.path);
        const plainHtml = lang ? highlight(source, lang, theme.colors) : escapeHtml(source);
        const scrollStyle = theme.bg ? { background: theme.bg } : undefined;
        const preStyle = { fontSize: fontSizePx };
        if (theme.fg)
            preStyle.color = theme.fg;
        body = (_jsxs("div", { className: css.scroll, style: scrollStyle, children: [_jsx("div", { className: css.meta, style: theme.fg ? { color: theme.fg } : undefined, children: file.name }), _jsx("pre", { className: css.plain, style: preStyle, dangerouslySetInnerHTML: { __html: plainHtml } })] }));
    }
    const renderNode = (node, depth) => {
        const style = { paddingLeft: 10 + depth * 14 };
        if (node.type === 'dir') {
            const isOpen = !!expanded[node.path];
            return (_jsxs("div", { children: [_jsxs("button", { className: css.treeNode, style: style, title: node.path, onClick: () => toggleDir(node.path), children: [_jsx("span", { className: css.caret, children: isOpen ? '▾' : '▸' }), _jsx("span", { className: css.nodeIcon, children: "\uD83D\uDCC1" }), _jsx("span", { className: css.nodeName, children: node.name })] }), isOpen && node.children.map(c => renderNode(c, depth + 1))] }, node.path));
        }
        const active = file !== null && file.path === node.path;
        return (_jsxs("button", { className: active ? `${css.treeNode} ${css.treeFileOn}` : css.treeNode, style: style, title: node.path, onClick: () => { setPathInput(node.path); void load(node.path); }, children: [_jsx("span", { className: css.caret, children: " " }), _jsx("span", { className: css.nodeIcon, children: node.type === 'file' ? '📄' : '▪' }), _jsx("span", { className: css.nodeName, children: node.name })] }, node.path));
    };
    return (_jsxs("div", { className: css.win, style: { left: pos.x, top: pos.y, width: size.w, height: size.h }, onKeyDown: handleKeyDown, children: [_jsxs("div", { className: css.header, onPointerDown: (e) => {
                    // Buttons inside the header must keep their own click; only drag from the bar itself.
                    if (e.target.closest?.('button'))
                        return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDrag({ pointerId: e.pointerId, dx: e.clientX - pos.x, dy: e.clientY - pos.y });
                }, onPointerMove: (e) => {
                    if (!drag || e.pointerId !== drag.pointerId)
                        return;
                    const vp = viewport();
                    setPos({
                        x: clamp(e.clientX - drag.dx, 8, Math.max(8, vp.w - size.w - 8)),
                        y: clamp(e.clientY - drag.dy, 8, Math.max(8, vp.h - size.h - 8)),
                    });
                }, onPointerUp: (e) => { if (drag && e.pointerId === drag.pointerId)
                    setDrag(null); }, children: [_jsx("button", { className: css.sideBtn, title: sidebarOpen ? '收起文件列表' : '展开文件列表', onClick: () => setSidebarOpen(!sidebarOpen), children: "\u2630" }), _jsx("div", { className: css.title, children: "\u6587\u4EF6\u9884\u89C8" }), _jsx("button", { className: css.closeBtn, title: "\u6536\u8D77", onClick: () => setOpen(false), children: "\u2014" })] }), _jsxs("div", { className: css.toolbar, children: [_jsx("input", { className: css.input, value: pathInput, placeholder: "\u8F93\u5165\u6587\u4EF6\u8DEF\u5F84\uFF08\u76F8\u5BF9\u5DE5\u4F5C\u533A\u6216\u7EDD\u5BF9\uFF09", onChange: e => setPathInput(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
                            void load(pathInput); } }), _jsx("button", { className: css.btn, onClick: () => void load(pathInput), children: "\u6253\u5F00" })] }), _jsxs("div", { className: css.main, children: [sidebarOpen
                        ? (_jsxs("div", { className: css.sidebar, children: [_jsxs("div", { className: css.sidebarHead, children: [_jsx("span", { className: css.sidebarTitle, children: "\u6587\u4EF6" }), _jsx("span", { className: css.sidebarSpacer }), _jsx("button", { className: css.btn, title: "\u5237\u65B0\u76EE\u5F55\u4E0E\u914D\u7F6E", onClick: refreshAll, children: "\u21BB" }), _jsx("button", { className: css.btn, title: "\u6298\u53E0\u4FA7\u8FB9\u680F", onClick: () => setSidebarOpen(false), children: "\u25C0" })] }), tree.length > 0
                                    ? _jsx("div", { className: css.sidebarList, children: tree.map(n => renderNode(n, 0)) })
                                    : _jsx("div", { className: css.hint, children: "\u65E0\u6587\u4EF6" })] }))
                        : (_jsx("div", { className: css.rail, children: _jsx("button", { className: css.railBtn, title: "\u5C55\u5F00\u6587\u4EF6\u5217\u8868", onClick: () => setSidebarOpen(true), children: "\u25B6" }) })), _jsxs("div", { className: css.body, children: [body, file !== null && actions] })] }), ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => (_jsx("div", { className: `${css.resize ?? ''} ${CORNER_CLASS[corner] ?? ''}`, title: "\u62D6\u52A8\u8C03\u6574\u5927\u5C0F", onPointerDown: (e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setResize({ pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, w: size.w, h: size.h, x: pos.x, y: pos.y, corner });
                }, onPointerMove: (e) => {
                    if (!resize || e.pointerId !== resize.pointerId)
                        return;
                    const vp = viewport();
                    const dx = e.clientX - resize.startX;
                    const dy = e.clientY - resize.startY;
                    const minW = 320;
                    const minH = 240;
                    let w = resize.w;
                    let h = resize.h;
                    let x = resize.x;
                    let y = resize.y;
                    if (corner.includes('left')) {
                        w = Math.max(minW, resize.w - dx);
                        x = resize.x + resize.w - w;
                    }
                    else {
                        w = Math.max(minW, Math.min(resize.w + dx, vp.w - resize.x - 8));
                    }
                    if (corner.includes('top')) {
                        h = Math.max(minH, resize.h - dy);
                        y = resize.y + resize.h - h;
                    }
                    else {
                        h = Math.max(minH, Math.min(resize.h + dy, vp.h - resize.y - 8));
                    }
                    setSize({ w, h });
                    setPos({ x, y });
                }, onPointerUp: (e) => { if (resize && e.pointerId === resize.pointerId)
                    setResize(null); } }, corner)))] }));
}
export function FilePreviewFab() {
    const [open, setOpenState] = useState(mdOpen);
    useEffect(() => subscribeOpen(() => setOpenState(mdOpen)), []);
    return (_jsxs("button", { className: css.fabBtn, title: open ? '收起文件预览' : '打开文件预览', onClick: () => setOpen(!open), children: [_jsxs("svg", { width: 18, height: 18, viewBox: "0 0 32 32", "aria-hidden": true, children: [_jsx("circle", { cx: 16, cy: 13, r: 13, fill: "#f6a6c8" }), _jsx("ellipse", { cx: 5.2, cy: 19, rx: 3.4, ry: 10, fill: "#f6a6c8" }), _jsx("ellipse", { cx: 26.8, cy: 19, rx: 3.4, ry: 10, fill: "#f6a6c8" }), _jsx("ellipse", { cx: 16, cy: 17.5, rx: 9, ry: 8.5, fill: "#ffe9da" }), _jsx("path", { d: "M7 17 C7 7.5 25 7.5 25 17 C21.5 11.5 10.5 11.5 7 17 Z", fill: "#f6a6c8" }), _jsx("ellipse", { cx: 12.3, cy: 18.6, rx: 1.7, ry: 2.7, fill: "#5b4a52" }), _jsx("ellipse", { cx: 19.7, cy: 18.6, rx: 1.7, ry: 2.7, fill: "#5b4a52" }), _jsx("circle", { cx: 13, cy: 17.7, r: 0.75, fill: "#ffffff" }), _jsx("circle", { cx: 20.4, cy: 17.7, r: 0.75, fill: "#ffffff" }), _jsx("ellipse", { cx: 9.6, cy: 21.6, rx: 2, ry: 1.2, fill: "#ff9fb2", opacity: 0.8 }), _jsx("ellipse", { cx: 22.4, cy: 21.6, rx: 2, ry: 1.2, fill: "#ff9fb2", opacity: 0.8 }), _jsx("path", { d: "M14.6 22.8 Q16 24.2 17.4 22.8", fill: "none", stroke: "#e0697f", strokeWidth: 1.1, strokeLinecap: "round" }), _jsx("circle", { cx: 21.5, cy: 4.5, r: 2.3, fill: "#ff6b9d" }), _jsx("circle", { cx: 25.5, cy: 4.5, r: 2.3, fill: "#ff6b9d" }), _jsx("circle", { cx: 23.5, cy: 4.5, r: 1.1, fill: "#ffe1ec" })] }), _jsx("span", { children: "\u6587\u4EF6\u9884\u89C8" })] }));
}
//# sourceMappingURL=FilePreviewWindow.js.map