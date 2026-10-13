import type { Attachment } from 'svelte/attachments'

/**
 * Sets `--board-zoom` on a node to how much its parent is drawn scaled on screen, so the node's
 * own style can undo the board's zoom and keep a screen size. The board's wrapper zooms by a
 * transform on an ancestor, which changes no layout and fires no resize, so the zoom is read
 * again whenever an ancestor's style changes.
 */
export const boardZoom: Attachment<HTMLElement> = (node) => {
    const parent = node.parentElement
    if (!parent) return
    const read = () => {
        const laid = parent.offsetWidth
        if (laid === 0) return
        node.style.setProperty('--board-zoom', String(parent.getBoundingClientRect().width / laid))
    }
    const styles = new MutationObserver(read)
    for (let ancestor = parent.parentElement; ancestor; ancestor = ancestor.parentElement) {
        styles.observe(ancestor, { attributes: true, attributeFilter: ['style'] })
    }
    read()
    return () => styles.disconnect()
}
