import { untrack } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { SvelteMap } from 'svelte/reactivity'

/**
 * One width for a menu's buttons, as a grid's equal columns give their cells: every button is
 * drawn as wide as the widest content in the menu. Each row of a menu lays out and wraps its
 * own buttons, so no shared grid track can size them; their content is measured instead.
 */
export class ChoiceWidth {
    private widths = new SvelteMap<HTMLElement, number>()

    /**
     * In whole CSS pixels, read from the layout rather than the screen, so a scaled panel reads
     * the same. Rounded up: a fractional width given back as a minimum can land a fraction short.
     */
    readonly widest = $derived(Math.ceil(Math.max(0, ...this.widths.values())))

    /**
     * On a button's content, which sizes itself (`w-max`) whatever the button's width. It is read
     * before the first paint; a later change of layout alone (a font arriving) is read a frame
     * late, as the panel's fit is.
     */
    readonly measure: Attachment<HTMLElement> = (node) => {
        let frame = 0
        const read = () =>
            untrack(() => this.widths.set(node, parseFloat(getComputedStyle(node).width)))
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
