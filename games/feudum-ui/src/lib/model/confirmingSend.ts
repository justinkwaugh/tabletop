/** What the logic package's preview of a staged input says about sending it. */
export interface SendPreview {
    /** R-X.2 */
    readonly revealsInfo?: boolean
}

const CantBeUndone = "can't be undone"

/**
 * R-X.2 (contract: Confirming a send) A press that completes an undoable Action sends at once. One
 * whose preview sets `revealsInfo` stages for the primary button, and so does a draft holding an
 * `auto` stage: an auto selection never completes a send.
 */
export function sendsOnPress(
    draft: { readonly allManual: boolean },
    preview?: SendPreview
): boolean {
    return draft.allManual && !preview?.revealsInfo
}

/** R-X.2 The primary button: the Action's name, with the warning when the send can't be undone. */
export function primaryLabel(actionName: string, preview?: SendPreview): string {
    return preview?.revealsInfo ? `${actionName} · ${CantBeUndone}` : actionName
}
