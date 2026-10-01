<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import { MediaQuery } from 'svelte/reactivity'
    import { fittedSize } from '$lib/model/fitBox.js'

    let {
        fraction = 0.4,
        portraitFraction = 0.55,
        children
    }: {
        fraction?: number
        portraitFraction?: number
        children: Snippet
    } = $props()

    let scale = $state(1)
    let height = $state<number | undefined>(undefined)
    let columnHeight = $state(0)

    const portrait = new MediaQuery('(max-width: 640px) and (orientation: portrait)')

    let budget = $derived(columnHeight * (portrait.current ? portraitFraction : fraction))

    const measureColumn: Attachment<HTMLElement> = (node) => {
        const column = node.parentElement
        if (!column) return
        const read = () => {
            columnHeight = column.clientHeight
        }
        const observer = new ResizeObserver(read)
        observer.observe(column)
        read()
        return () => observer.disconnect()
    }

    // Scaling changes text wrap and so height: read at full width, ignoring the resizes the
    // read itself causes, then check that what settled still fits. A resize that landed while
    // the read was in flight (an image finishing, a step's cards arriving) fails that check and
    // is read again; two re-reads bound the width heuristic's own drift.
    const fitToBudget: Attachment<HTMLElement> = (node) => {
        const budgetNow = budget
        if (budgetNow <= 0) return
        let frame = 0
        let reading = false
        let rereads = 0
        let settledHeight: number | undefined
        const measure = () => {
            cancelAnimationFrame(frame)
            reading = true
            settledHeight = undefined
            scale = 1
            height = undefined
            frame = requestAnimationFrame(() => {
                const fitted = fittedSize(node.scrollHeight, budgetNow)
                scale = fitted.scale
                height = fitted.height
                frame = requestAnimationFrame(() => {
                    reading = false
                    settledHeight = node.scrollHeight
                    const shown = Math.ceil(settledHeight * scale)
                    const misfit = shown > fitted.height || shown < fitted.height - 8
                    if (misfit && rereads < 2) {
                        rereads += 1
                        measure()
                    } else {
                        rereads = 0
                    }
                })
            })
        }
        const observer = new ResizeObserver(() => {
            if (reading || settledHeight === undefined) return
            if (node.scrollHeight !== settledHeight) measure()
        })
        observer.observe(node)
        measure()
        return () => {
            observer.disconnect()
            cancelAnimationFrame(frame)
        }
    }
</script>

<div
    class="fit shrink-0"
    {@attach measureColumn}
    style="height:{height !== undefined ? `${height}px` : 'auto'};"
>
    <div
        class="fit__inner"
        {@attach fitToBudget}
        style="width:{scale < 1 ? `${100 / scale}%` : '100%'}; transform:{scale < 1
            ? `scale(${scale})`
            : 'none'};"
    >
        {@render children()}
    </div>
</div>

<style>
    /* Never clips: a read that ran short overlaps the board below until the next read. */
    .fit {
        position: relative;
        z-index: 1;
    }
    .fit__inner {
        transform-origin: top left;
    }
</style>
