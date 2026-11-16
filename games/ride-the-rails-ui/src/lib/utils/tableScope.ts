/**
 * The title's table: the root `GameTable` draws, marked with this attribute. Every element query
 * the title makes (the board's frame, a flight's landing, the railroad popup) starts from it, so
 * none can read an element of the page outside the title.
 */
export const TABLE_ATTRIBUTE = 'data-rtr-table'

/** The table an element of the title sits in; none for an element outside it. */
export function tableOf(node: Element): Element | undefined {
    return node.closest(`[${TABLE_ATTRIBUTE}]`) ?? undefined
}

/** The first element in the table that `selector` matches; none without a table. */
export function findInTable(table: Element | undefined, selector: string): Element | undefined {
    return table?.querySelector(selector) ?? undefined
}

/** The view an element is shown in, as a box from its top left: what a popup or landing keeps inside. */
export function viewOf(element: Element) {
    const { clientWidth, clientHeight } = element.ownerDocument.documentElement
    return { left: 0, top: 0, width: clientWidth, height: clientHeight }
}
