import { untrack } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { SvelteMap } from 'svelte/reactivity'
import { assertExists } from '@tabletop/common'

/**
 * One width for a menu's buttons, or a pair of confirms, as a grid's equal columns give their
 * cells: each is drawn as wide as the widest in the group. Each row lays out and wraps its own
 * buttons, so no shared grid track can size them; their content is measured instead, with the
 * padding and border of the box that takes the width (the content's parent).
 */
export class ChoiceWidth {
    private widths = new SvelteMap<HTMLElement, number>()

    /**
     * In whole CSS pixels, read from the layout rather than the screen, so a scaled panel reads
     * the same. Rounded up: a fractional width given back as a minimum can land a fraction short.
     */
    readonly widest = $derived(Math.ceil(Math.max(0, ...this.widths.values())))

    /**
     * On a button's content, which sizes itself (`w-max`) whatever the button's width; the width
     * goes to its parent, so the parent's padding and border count. It is read before the first
     * paint; a later change of layout alone (a font arriving) is read a frame late, as the
     * panel's fit is.
     */
    readonly measure: Attachment<HTMLElement> = (node) => {
        const box = node.parentElement
        assertExists(box, 'Measured content sits in the box that takes the width')
        let frame = 0
        const read = () => {
            const inside = getComputedStyle(node)
            const around = getComputedStyle(box)
            const width = [
                inside.width,
                around.paddingLeft,
                around.paddingRight,
                around.borderLeftWidth,
                around.borderRightWidth
            ].reduce((sum, length) => sum + parseFloat(length), 0)
            untrack(() => this.widths.set(node, width))
        }
        const layoutChanges = new ResizeObserver(() => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(read)
        })
        read()
        layoutChanges.observe(node)
        return () => {
            layoutChanges.disconnect()
            cancelAnimationFrame(frame)
            untrack(() => this.widths.delete(node))
        }
    }
}
