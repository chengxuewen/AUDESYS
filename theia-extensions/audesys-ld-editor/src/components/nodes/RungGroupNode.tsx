/**
 * RungGroupNode — React Flow custom node acting as a rung container.
 *
 * Child nodes (contacts, coils) reference this node via `parentId` +
 * `extent: 'parent'`; React Flow nests them inside this wrapper div.
 * The group itself is not draggable — its y position is derived from
 * the rung index by graphToFlow.
 *
 * Annotations (P1): line 1 shows the network title (or the rung number),
 * line 2 the network comment. Double-click either line opens an inline
 * input (committed via `d.onSetTitle` / `d.onSetComment`).
 */
import React from '@theia/core/shared/react';
import { NodeProps } from '@xyflow/react';

const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' ? v : fallback;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

interface LdRungData extends Record<string, unknown> {
    title?: string;
    comment?: string;
    onSetTitle?: (id: string, title: string) => void;
    onSetComment?: (id: string, comment: string) => void;
    /** P2 validation: rung-level error count + messages (tooltip). */
    errorCount?: number;
    errorTitle?: string;
    /** P2 validation: non-blocking warning count + messages (yellow). */
    warningCount?: number;
    warningTitle?: string;
}

export const RungGroupNode: React.FC<NodeProps> = ({ id, data, selected }) => {
    const d = data as unknown as LdRungData;
    const rungNumber = num(data.rungNumber, 0);
    const title = str(data.title);
    const comment = str(data.comment);
    const errorCount = num(data.errorCount, 0);
    const errorTitle = str(data.errorTitle);
    const warningCount = num(data.warningCount, 0);
    const warningTitle = str(data.warningTitle);
    const hasAnnotation = title.length > 0 || comment.length > 0 || selected;
    const hasErrors = errorCount > 0;
    const hasWarnings = warningCount > 0 && !hasErrors;
    const [editingTitle, setEditingTitle] = React.useState(false);
    const [editingComment, setEditingComment] = React.useState(false);
    const [titleDraft, setTitleDraft] = React.useState(title);
    const [commentDraft, setCommentDraft] = React.useState(comment);

    const startTitleEdit = (): void => {
        setTitleDraft(title);
        setEditingTitle(true);
    };
    const commitTitle = (): void => {
        setEditingTitle(false);
        if (titleDraft !== title) {
            d.onSetTitle?.(id, titleDraft);
        }
    };
    const startCommentEdit = (): void => {
        setCommentDraft(comment);
        setEditingComment(true);
    };
    const commitComment = (): void => {
        setEditingComment(false);
        if (commentDraft !== comment) {
            d.onSetComment?.(id, commentDraft);
        }
    };

    return (
        <div
            className={`ld-rung-group${selected ? ' ld-rung-group--selected' : ''}${hasAnnotation ? ' ld-rung-group--annotated' : ''}${hasErrors ? ' ld-rung-group--error' : ''}${hasWarnings ? ' ld-rung-group--warning' : ''}`}
            title={errorTitle || warningTitle || undefined}
        >
            {hasErrors && (
                <span className="ld-rung-group__error-badge">⚠ {errorCount}</span>
            )}
            {hasWarnings && (
                <span className="ld-rung-group__warning-badge">⚠ {warningCount}</span>
            )}
            {editingTitle ? (
                <input
                    className="ld-rung-group__title-input"
                    value={titleDraft}
                    autoFocus
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commitTitle();
                        if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                />
            ) : (
                <div className="ld-rung-group__label" onDoubleClick={startTitleEdit} title="Double-click to edit the network title">
                    {String(rungNumber).padStart(3, '0')}
                    {title ? ` ${title}` : ''}
                </div>
            )}
            {editingComment ? (
                <input
                    className="ld-rung-group__comment-input"
                    value={commentDraft}
                    autoFocus
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onBlur={commitComment}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commitComment();
                        if (e.key === 'Escape') setEditingComment(false);
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                />
            ) : (
                <div
                    className={`ld-rung-group__comment${comment ? '' : ' ld-rung-group__comment--empty'}`}
                    onDoubleClick={startCommentEdit}
                    title="Double-click to edit the network comment"
                >
                    {comment || (selected ? 'Add network comment…' : '')}
                </div>
            )}
        </div>
    );
};
