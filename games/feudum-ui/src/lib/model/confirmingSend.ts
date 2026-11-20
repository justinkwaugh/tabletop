export interface SendPreview {
    /** R-X.2 */
    readonly revealsInfo?: boolean
}

export const CantBeUndone = "can't be undone"

/** R-X.2, Contract, Confirming a send that cannot be undone: an auto selection never completes a send. */
export function sendsOnPress(
    draft: { readonly allManual: boolean },
    preview?: SendPreview
): boolean {
    return draft.allManual && !preview?.revealsInfo
}

/** R-X.2 The Action's name, with the warning when the send can't be undone. */
export function primaryLabel(actionName: string, preview?: SendPreview): string {
    return preview?.revealsInfo ? `${actionName} · ${CantBeUndone}` : actionName
}
