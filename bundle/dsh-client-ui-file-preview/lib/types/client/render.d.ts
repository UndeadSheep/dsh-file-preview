/**
 * Pure renderers shared by the preview and editor surfaces.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/render
 */
import type { PreviewThemeColors } from '@undeadsheep/dsh-file-preview/types';
export declare const DEFAULT_COLORS: Required<PreviewThemeColors>;
export declare function escapeHtml(value: string): string;
export declare function langFor(path: string): string | null;
export declare function isMdPath(path: string): boolean;
export declare function highlight(code: string, lang: string | null, colors?: PreviewThemeColors): string;
export declare function renderMarkdown(src: string): string;
/** Editor helpers. */
export declare function leadingIndent(line: string): string;
export declare function trimmedLine(line: string): string;
export declare function indentUnit(cfg: {
    useTabs?: boolean;
    indentSize?: number;
}): string;
//# sourceMappingURL=render.d.ts.map