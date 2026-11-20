import type { Attachment } from 'svelte/attachments'
import { GuildBox } from '$lib/utils/boardGeometry.js'

/** What stands round the areas' pictures in the bench, in CSS pixels. */
export interface BenchRoom {
    /** The bench's height (a phone's sheet: its cap), less its own padding and border. */
    readonly height: number
    /** The areas' holder's width inside its padding. */
    readonly width: number
    readonly title: number
    readonly footer: number
    /** The areas' holder's padding, top and bottom together. */
    readonly padding: number
    /** Between two areas side by side. */
    readonly gap: number
    /** Each area's height outside its picture: its button row and the gap above it. */
    readonly around: readonly number[]
}

/**
 * Contract, The bench: the areas stand upright side by side, so each picture's long side is the
 * height left under the title and over the footer, less the tallest button row, or what the
 * holder's width allows each at the guild area's own shape, whichever is less.
 */
export function fittedAreaLong(room: BenchRoom): number {
    const count = room.around.length
    const tall = room.height - room.title - room.footer - room.padding - Math.max(...room.around)
    const across = (room.width - room.gap * (count - 1)) / count
    return Math.floor(Math.min(tall, (across * GuildBox.width) / GuildBox.height))
}

/**
 * The long side at which every area of the bench stands whole above its footer, measured from the
 * bench as it stands and again whenever the bench, its title or its footer changes size.
 */
export class BenchFit {
    long = $state<number | undefined>(undefined)

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
            const cap = parseFloat(outer.maxHeight)
            const long = fittedAreaLong({
                height:
                    (Number.isNaN(cap) ? node.clientHeight : cap) -
                    parseFloat(outer.paddingBottom) -
                    parseFloat(outer.borderTopWidth),
                width:
                    holder.clientWidth -
                    parseFloat(inner.paddingLeft) -
                    parseFloat(inner.paddingRight),
                title: title.offsetHeight,
                footer: footer.offsetHeight,
                padding: parseFloat(inner.paddingTop) + parseFloat(inner.paddingBottom),
                gap: parseFloat(inner.columnGap),
                around: areas.map(
                    (area) =>
                        area.offsetHeight -
                        (area.querySelector<HTMLElement>('[data-pick]')?.offsetHeight ?? 0)
                )
            })
            if (this.long === undefined || Math.abs(long - this.long) >= 1) {
                this.long = long
            }
        }
        // The next frame: a new long side resizes the bench this observer watches.
        let frame = 0
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(measure)
        })
        for (const watched of [node, title, footer]) {
            observer.observe(watched)
        }
        measure()
        return () => {
            cancelAnimationFrame(frame)
            observer.disconnect()
        }
    }
}
