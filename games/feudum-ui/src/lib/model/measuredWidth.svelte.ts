import type { Attachment } from 'svelte/attachments'

/** An element's width in CSS pixels as it stands, kept as it changes. */
export class MeasuredWidth {
    width = $state<number | undefined>(undefined)

    readonly attach: Attachment<HTMLElement> = (node) => {
        const measure = () => {
            const width = node.getBoundingClientRect().width
            if (width > 0 && (this.width === undefined || Math.abs(width - this.width) >= 0.5)) {
                this.width = width
            }
        }
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        measure()
        return () => observer.disconnect()
    }
}
