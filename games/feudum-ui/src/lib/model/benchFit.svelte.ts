import type { Attachment } from 'svelte/attachments'
import { GuildBox } from '$lib/utils/boardGeometry.js'

export interface BenchRoom {
    readonly height: number
    readonly width: number
    readonly title: number
    readonly footer: number
    readonly padding: number
    readonly gap: number
    readonly around: readonly number[]
}

export class BenchFit {
    long = $state<number | undefined>(undefined)

    /** Contract, Guild and Feast: the areas stand upright side by side. */
    fit(room: BenchRoom) {
        const long = BenchFit.areaLong(room)
        if (this.long === undefined || Math.abs(long - this.long) >= 1) {
            this.long = long
        }
    }

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
            this.fit({
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

    private static areaLong(room: BenchRoom): number {
        const count = room.around.length
        const tall =
            room.height - room.title - room.footer - room.padding - Math.max(...room.around)
        const across = (room.width - room.gap * (count - 1)) / count
        return Math.floor(Math.min(tall, (across * GuildBox.width) / GuildBox.height))
    }
}
