import { flushSync } from 'svelte'
import type { ActionBlock, ActionPanelView, ActionRow, LineRole } from '$lib/model/actionPanel.js'

/** Reading a panel as a seat would: what it says, what it offers, and the presses. */
export function linesOf(view: ActionPanelView, role?: LineRole): readonly string[] {
    return view.blocks.flatMap((block) =>
        block.kind === 'line' && (!role || block.role === role) ? [block.text] : []
    )
}

export function rowsOf(view: ActionPanelView, name?: string): readonly ActionRow[] {
    return view.blocks.flatMap((block) =>
        block.kind === 'rows' && (!name || block.name === name) ? block.rows : []
    )
}

export function rowLabels(view: ActionPanelView, name?: string): readonly string[] {
    return rowsOf(view, name).map(({ choice }) => choice.label)
}

export function rowNamed(view: ActionPanelView, label: string | RegExp): ActionRow {
    const rows = rowsOf(view)
    const found = rows.find(({ choice }) =>
        typeof label === 'string' ? choice.label === label : label.test(choice.label)
    )
    if (!found) {
        throw new Error(`No row ${label} in ${rowLabels(view).join(' | ')}`)
    }
    return found
}

export function blockOf<K extends ActionBlock['kind']>(
    view: ActionPanelView,
    kind: K
): Extract<ActionBlock, { kind: K }> | undefined {
    return view.blocks.find(
        (block): block is Extract<ActionBlock, { kind: K }> => block.kind === kind
    )
}

export function primariesOf(
    view: ActionPanelView
): readonly Extract<ActionBlock, { kind: 'primary' }>[] {
    // A trade picker holds its send beneath its choices; the nourish picker, in its summary.
    return view.blocks.flatMap((block): Extract<ActionBlock, { kind: 'primary' }>[] => {
        if (block.kind === 'primary') {
            return [block]
        }
        if (block.kind === 'nourish-picker') {
            return [block.send]
        }
        return block.kind === 'trade-picker' && block.send ? [block.send] : []
    })
}

export function primaryLabels(view: ActionPanelView): readonly string[] {
    return primariesOf(view).map(({ label }) => label)
}

export function primaryNamed(
    view: ActionPanelView,
    label: string | RegExp
): Extract<ActionBlock, { kind: 'primary' }> {
    const found = primariesOf(view).find((primary) =>
        typeof label === 'string' ? primary.label === label : label.test(primary.label)
    )
    if (!found) {
        throw new Error(`No primary ${label} in ${primaryLabels(view).join(' | ')}`)
    }
    return found
}

export async function pressRow(row: ActionRow): Promise<void> {
    await row.press()
    flushSync()
}

export function cardRows(view: ActionPanelView) {
    return blockOf(view, 'cards')?.rows ?? []
}

export async function pressCard(view: ActionPanelView, kind: string): Promise<void> {
    const card = cardRows(view).find((row) => row.kind === kind)
    if (!card) {
        throw new Error(`No card ${kind}`)
    }
    await card.press()
    flushSync()
}
