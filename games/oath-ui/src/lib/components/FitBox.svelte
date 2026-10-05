<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import { MediaQuery } from 'svelte/reactivity'
    import { fittedSize } from '$lib/model/fitBox.js'

    let {
        fraction = 0.4,
        portraitFraction = 0.55,
        basis = undefined,
        children
    }: {
        fraction?: number
        portraitFraction?: number
        basis?: number
        children: Snippet
    } = $props()

    let naturalHeight = $state<number | undefined>(undefined)
    let columnHeight = $state(0)

    const portrait = new MediaQuery('(max-width: 640px) and (orientation: portrait)')

    let budget = $derived(
        (basis ?? columnHeight) * (portrait.current ? portraitFraction : fraction)
    )
    let fitted = $derived(
        naturalHeight === undefined ? undefined : fittedSize(naturalHeight, budget)
    )
    let scale = $derived(fitted?.scale ?? 1)

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

    function fullWidthHeight(node: HTMLElement): number {
        const drawnWidth = node.style.width
        node.style.width = '100%'
        const height = node.scrollHeight
        node.style.width = drawnWidth
        return height
    }

    const measureNaturalHeight: Attachment<HTMLElement> = (node) => {
        let frame = 0
        const measure = () => {
            naturalHeight = fullWidthHeight(node)
        }
        const changesContent = (record: MutationRecord) =>
            record.target !== node || record.type !== 'attributes'
        const contentChanges = new MutationObserver((records) => {
            if (records.some(changesContent)) measure()
        })
        // A refit inside a ResizeObserver callback resizes observed ancestors (the full-screen
        // toolbar) in the same pass, which the browser reports as a ResizeObserver loop error.
        const layoutChanges = new ResizeObserver(() => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(measure)
        })
        contentChanges.observe(node, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true
        })
        layoutChanges.observe(node)
        measure()
        return () => {
            contentChanges.disconnect()
            layoutChanges.disconnect()
            cancelAnimationFrame(frame)
        }
    }
</script>

<div
    class="fit shrink-0"
    {@attach measureColumn}
    style="height:{fitted ? `${fitted.height}px` : 'auto'};"
>
    <div
        class="fit__inner"
        {@attach measureNaturalHeight}
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
