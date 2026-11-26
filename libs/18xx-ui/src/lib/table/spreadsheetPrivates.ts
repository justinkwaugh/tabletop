import type { Owner } from '@tabletop/18xx'

/** Which axis of the spreadsheet a holder's line runs along. */
export type PrivateHolderSide = 'owner' | 'company'

export type SpreadsheetPrivateHolder = {
    id: string
    owner: Owner
    side: PrivateHolderSide
}

export type HeldPrivate = {
    company: { id: string }
    income: number
    value: number
}

export type SpreadsheetPrivate = HeldPrivate & {
    holderId: string
    side: PrivateHolderSide
}

/**
 * The privates held by the holders shown on the sheet, in the title's private order. A holder
 * appears once, so each private is marked on exactly one line.
 */
export function spreadsheetPrivates(
    holders: readonly SpreadsheetPrivateHolder[],
    heldBy: (owner: Owner) => readonly HeldPrivate[],
    privateOrder: readonly string[]
): SpreadsheetPrivate[] {
    return holders
        .flatMap((holder) =>
            heldBy(holder.owner).map((held) => ({
                ...held,
                holderId: holder.id,
                side: holder.side
            }))
        )
        .toSorted((a, b) => privateOrder.indexOf(a.company.id) - privateOrder.indexOf(b.company.id))
}
