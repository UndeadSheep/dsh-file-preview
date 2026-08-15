/**
 * Browser half: the floating file-preview window and the header toggle button.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/FilePreviewWindow
 */
import React from 'react';
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client';
import type { FilePreviewRemote } from './remote.ts';
export interface FilePreviewWindowProps {
    remote: FilePreviewRemote;
    useSessions: SnapshotSelectorHook<SessionListState>;
}
export declare function FilePreviewWindow({ remote, useSessions }: FilePreviewWindowProps): React.ReactElement | null;
export declare function FilePreviewFab(): React.ReactElement;
//# sourceMappingURL=FilePreviewWindow.d.ts.map