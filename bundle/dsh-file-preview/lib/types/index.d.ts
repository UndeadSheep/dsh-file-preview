/**
 * Workspace file preview: tree listing, text read/write, theme and config
 * resolution for the browser half's floating preview window.
 * @module @undeadsheep/dsh-file-preview
 */
import { Context } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ListTreeRequest, ListTreeResult, ReadConfigRequest, ReadConfigResult, ReadFileRequest, ReadFileResult, ReadThemeRequest, ReadThemeResult, WriteFileRequest, WriteFileResult } from './types.ts';
export type * from './types.ts';
/** Optional deployment policy. */
export interface Config {
    /** Maximum UTF-8 byte length of a file the preview will read. */
    maxFileBytes?: number;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        filePreview: FilePreviewService;
    }
}
/** Host-facing Remote for the floating file-preview window. */
export declare class FilePreviewService extends TypertRemoteService {
    static inject: string[];
    static Config: s<Config>;
    private readonly maxFileBytes;
    constructor(ctx: Context, config: Config);
    /** Resolve the per-call sandbox policy from a session id (fallback: deployment default). */
    private policyFor;
    /** Recursively list a directory into the wire tree shape (directories first). */
    private walk;
    listTree(request: ListTreeRequest): Promise<ListTreeResult>;
    readFile(request: ReadFileRequest): Promise<ReadFileResult>;
    writeFile(request: WriteFileRequest): Promise<WriteFileResult>;
    readTheme(request: ReadThemeRequest): Promise<ReadThemeResult>;
    readConfig(request: ReadConfigRequest): Promise<ReadConfigResult>;
}
export default FilePreviewService;
//# sourceMappingURL=index.d.ts.map