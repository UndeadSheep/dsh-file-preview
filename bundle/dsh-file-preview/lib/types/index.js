/**
 * Workspace file preview: tree listing, text read/write, theme and config
 * resolution for the browser half's floating preview window.
 * @module @undeadsheep/dsh-file-preview
 */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import s from '@deepseek-ai/schemastery';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_DEPTH = 12;
/** Host-facing Remote for the floating file-preview window. */
let FilePreviewService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _listTree_decorators;
    let _readFile_decorators;
    let _writeFile_decorators;
    let _readTheme_decorators;
    let _readConfig_decorators;
    return class FilePreviewService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _listTree_decorators = [Remote('listTree')];
            _readFile_decorators = [Remote('readFile')];
            _writeFile_decorators = [Remote('writeFile')];
            _readTheme_decorators = [Remote('readTheme')];
            _readConfig_decorators = [Remote('readConfig')];
            __esDecorate(this, null, _listTree_decorators, { kind: "method", name: "listTree", static: false, private: false, access: { has: obj => "listTree" in obj, get: obj => obj.listTree }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readFile_decorators, { kind: "method", name: "readFile", static: false, private: false, access: { has: obj => "readFile" in obj, get: obj => obj.readFile }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _writeFile_decorators, { kind: "method", name: "writeFile", static: false, private: false, access: { has: obj => "writeFile" in obj, get: obj => obj.writeFile }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readTheme_decorators, { kind: "method", name: "readTheme", static: false, private: false, access: { has: obj => "readTheme" in obj, get: obj => obj.readTheme }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readConfig_decorators, { kind: "method", name: "readConfig", static: false, private: false, access: { has: obj => "readConfig" in obj, get: obj => obj.readConfig }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['fs', 'sandboxPolicy', 'sessions'];
        static Config = s.object({
            maxFileBytes: s.number().step(1).min(1),
        });
        maxFileBytes = __runInitializers(this, _instanceExtraInitializers);
        constructor(ctx, config) {
            super(ctx, 'filePreview');
            this.maxFileBytes = config.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
        }
        /** Resolve the per-call sandbox policy from a session id (fallback: deployment default). */
        policyFor(sessionId) {
            if (sessionId !== undefined) {
                const session = this.ctx.sessions.get(sessionId);
                if (session)
                    return this.ctx.sandboxPolicy.resolve({ session });
            }
            return this.ctx.sandboxPolicy.resolve();
        }
        /** Recursively list a directory into the wire tree shape (directories first). */
        async walk(target, rel, depth) {
            const entries = await this.ctx.fs.listDir(target);
            const nodes = [];
            for (const entry of entries) {
                const name = entry.name;
                if (!name)
                    continue;
                const childRel = rel ? `${rel}/${name}` : name;
                if (entry.type === 'directory') {
                    const children = depth > 0
                        ? await this.walk(entry.target, childRel, depth - 1).catch(() => [])
                        : [];
                    nodes.push({ type: 'dir', name, path: childRel, children });
                }
                else if (entry.type === 'file') {
                    nodes.push(entry.size === undefined
                        ? { type: 'file', name, path: childRel }
                        : { type: 'file', name, path: childRel, size: entry.size });
                }
                else {
                    nodes.push(entry.size === undefined
                        ? { type: 'other', name, path: childRel }
                        : { type: 'other', name, path: childRel, size: entry.size });
                }
            }
            nodes.sort((a, b) => {
                if (a.type === 'dir' && b.type !== 'dir')
                    return -1;
                if (a.type !== 'dir' && b.type === 'dir')
                    return 1;
                return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
            });
            return nodes;
        }
        async listTree(request) {
            try {
                const policy = this.policyFor(request.sessionId);
                const root = await this.ctx.fs.resolve(policy.workspaceRoot, {});
                const tree = await this.walk(root, '', MAX_DEPTH);
                return { ok: true, value: tree };
            }
            catch (error) {
                return { ok: false, error: { code: 'io-failure', message: error instanceof Error ? error.message : String(error) } };
            }
        }
        async readFile(request) {
            try {
                const policy = this.policyFor(request.sessionId);
                const target = await this.ctx.fs.resolve(request.path, { cwd: policy.workspaceRoot });
                const info = await this.ctx.fs.stat(target);
                if (!info)
                    return { ok: false, error: { code: 'not-found', path: request.path } };
                if (info.type !== 'file')
                    return { ok: false, error: { code: 'not-text', path: request.path } };
                if (info.size !== undefined && info.size > this.maxFileBytes) {
                    return { ok: false, error: { code: 'too-large', path: request.path, maxBytes: this.maxFileBytes, size: info.size } };
                }
                const content = await this.ctx.fs.readText(target);
                return { ok: true, value: { path: request.path, content } };
            }
            catch (error) {
                if (error !== null && typeof error === 'object' && error.code === 'FS_NOT_TEXT') {
                    return { ok: false, error: { code: 'not-text', path: request.path } };
                }
                return { ok: false, error: { code: 'io-failure', message: error instanceof Error ? error.message : String(error) } };
            }
        }
        async writeFile(request) {
            try {
                const policy = this.policyFor(request.sessionId);
                const target = await this.ctx.fs.resolve(request.path, { cwd: policy.workspaceRoot });
                await this.ctx.fs.writeText(target, request.content, undefined, undefined, policy);
                return { ok: true, value: { path: request.path } };
            }
            catch {
                return { ok: false, error: { code: 'write-denied', path: request.path } };
            }
        }
        async readTheme(request) {
            const policy = this.policyFor(request.sessionId);
            const colors = {};
            let bg = null;
            let fg = null;
            try {
                const target = await this.ctx.fs.resolve('preview-theme.json', { cwd: policy.workspaceRoot });
                const parsed = JSON.parse(await this.ctx.fs.readText(target));
                for (const key of ['keyword', 'string', 'number', 'comment', 'tag', 'function', 'type', 'variable']) {
                    if (typeof parsed[key] === 'string')
                        colors[key] = parsed[key];
                }
                if (typeof parsed.background === 'string')
                    bg = parsed.background;
                if (typeof parsed.foreground === 'string')
                    fg = parsed.foreground;
            }
            catch { /* no dedicated theme file */ }
            try {
                const target = await this.ctx.fs.resolve('.vscode/settings.json', { cwd: policy.workspaceRoot });
                const parsed = JSON.parse(await this.ctx.fs.readText(target));
                const tcc = (parsed['editor.tokenColorCustomizations'] ?? {});
                const wcc = (parsed['workbench.colorCustomizations'] ?? {});
                const map = [
                    ['keyword', 'keywords'], ['string', 'strings'], ['number', 'numbers'], ['comment', 'comments'],
                    ['function', 'functions'], ['type', 'types'], ['variable', 'variables'],
                ];
                for (const [mine, theirs] of map) {
                    if (colors[mine] === undefined && typeof tcc[theirs] === 'string')
                        colors[mine] = tcc[theirs];
                }
                if (bg === null && typeof wcc['editor.background'] === 'string')
                    bg = wcc['editor.background'];
                if (fg === null && typeof wcc['editor.foreground'] === 'string')
                    fg = wcc['editor.foreground'];
            }
            catch { /* no vscode settings */ }
            const payload = { colors, bg, fg };
            return { ok: true, value: payload };
        }
        async readConfig(request) {
            const policy = this.policyFor(request.sessionId);
            const cfg = { indentSize: 2, useTabs: false, pollInterval: 1500, fontSize: 13 };
            let indentSet = false;
            let tabsSet = false;
            try {
                const target = await this.ctx.fs.resolve('preview.config.json', { cwd: policy.workspaceRoot });
                const parsed = JSON.parse(await this.ctx.fs.readText(target));
                if (typeof parsed.indentSize === 'number') {
                    cfg.indentSize = parsed.indentSize;
                    indentSet = true;
                }
                if (typeof parsed.useTabs === 'boolean') {
                    cfg.useTabs = parsed.useTabs;
                    tabsSet = true;
                }
                if (typeof parsed.pollInterval === 'number')
                    cfg.pollInterval = parsed.pollInterval;
                if (typeof parsed.fontSize === 'number')
                    cfg.fontSize = parsed.fontSize;
            }
            catch { /* no dedicated config */ }
            let prettier = null;
            for (const path of ['.prettierrc', '.prettierrc.json', 'package.json']) {
                try {
                    const target = await this.ctx.fs.resolve(path, { cwd: policy.workspaceRoot });
                    const parsed = JSON.parse(await this.ctx.fs.readText(target));
                    prettier = path === 'package.json' ? parsed.prettier : parsed;
                    if (prettier)
                        break;
                }
                catch { /* try next */ }
            }
            if (prettier && typeof prettier === 'object') {
                if (!indentSet && typeof prettier.tabWidth === 'number')
                    cfg.indentSize = prettier.tabWidth;
                if (!tabsSet && typeof prettier.useTabs === 'boolean')
                    cfg.useTabs = prettier.useTabs;
            }
            return { ok: true, value: cfg };
        }
    };
})();
export { FilePreviewService };
export default FilePreviewService;
//# sourceMappingURL=index.js.map