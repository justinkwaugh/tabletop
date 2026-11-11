import type { Attachment } from 'svelte/attachments'
import { GuildBox } from '$lib/utils/boardGeometry.js'

/** What stands round the areas' pictures in a phone's bench sheet, in CSS pixels. */
export interface SheetRoom {
    /** The sheet's height cap, less its own padding and border. */
    readonly sheet: number
    readonly title: number
    readonly footer: number
    /** The areas' holder's padding, top and bottom together. */
    readonly padding: number
    readonly gap: number
    /** Each area's height outside its picture: its button row and the gap above it. */
    readonly around: readonly number[]
}

/**
 * Contract, Phone layout: the room left under the title and over the footer, less what stands round
 * the areas' pictures, shared out between the pictures, gives each its height, and so its width at
 * the guild area's own shape.
 */
export function fittedAreaWidth(room: SheetRoom): number {
    const count = room.around.length
    const pictures =
        room.sheet -
        room.title -
        room.footer -
        room.padding -
        room.gap * (count - 1) -
        room.around.reduce((sum, height) => sum + height, 0)
    return Math.floor(((pictures / count) * GuildBox.width) / GuildBox.height)
}

/**
 * The width at which every area of a phone's bench sheet stands whole above its footer, measured
 * from the sheet as it stands and again whenever the sheet, its title or its footer changes size.
 */
export class BenchFit {
    width = $state<number | undefined>(undefined)

    readonly attach: Attachment<HTMLElement> = (node) => {
        const title = node.querySelector<HTMLElement>('[data-bench-title]')
        const footer = node.querySelector<HTMLElement>('[data-bench-footer]')
        const holder = node.querySelector<HTMLElement>('[data-bench-areas]')
        if (!title || !footer || !holder) {
            return
        }
        const measure = () => {
            const areas = [...holder.querySelectorAll<HTMLElement>('[data-bench-area]')]
            if (areas.length === 0) {
                return
            }
            const outer = getComputedStyle(node)
            const inner = getComputedStyle(holder)
            const width = fittedAreaWidth({
                sheet:
                    parseFloat(outer.maxHeight) -
                    parseFloat(outer.paddingBottom) -
                    parseFloat(outer.borderTopWidth),
                title: title.offsetHeight,
                footer: footer.offsetHeight,
                padding: parseFloat(inner.paddingTop) + parseFloat(inner.paddingBottom),
                gap: parseFloat(inner.rowGap),
                around: areas.map(
                    (area) =>
                        area.offsetHeight -
                        (area.querySelector<HTMLElement>('[data-pick]')?.offsetHeight ?? 0)
                )
            })
            if (this.width === undefined || Math.abs(width - this.width) >= 1) {
                this.width = width
            }
        }
        const observer = new ResizeObserver(measure)
        for (const watched of [node, title, footer]) {
            observer.observe(watched)
        }
        measure()
        return () => observer.disconnect()
    }
}
