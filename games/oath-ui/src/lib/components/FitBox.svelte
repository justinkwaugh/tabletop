<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import { fittedSize } from '$lib/model/fitBox.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'

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

    const layout = new PhoneLayout()

    let budget = $derived((basis ?? columnHeight) * (layout.upright ? portraitFraction : fraction))
    let fitted = $derived(
        naturalHeight === undefined ? undefined : fittedSize(naturalHeight, budget)
    )
    // An upright phone never scales: the box is at most `budget` tall and the panel scrolls inside it.
    let scrolls = $derived(
        layout.upright && naturalHeight !== undefined && budget > 0 && naturalHeight > budget
    )
    let scale = $derived(layout.upright ? 1 : (fitted?.scale ?? 1))

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

    /**
     * An answer row whose buttons sit on one line sticks to the bottom of an upright phone's box.
     * Read from the buttons' tops, not the row's height, which the pin's own padding changes; and
     * set only on a change, since every attribute change below the node is measured again.
     */
    function pinAnswerRows(node: HTMLElement) {
        for (const row of node.querySelectorAll<HTMLElement>('[data-answer-row]')) {
            const tops = new Set(
                [...row.children].map((child) =>
                    child instanceof HTMLElement ? child.offsetTop : 0
                )
            )
            const pin = tops.size <= 1
            if (row.hasAttribute('data-pinned') !== pin) row.toggleAttribute('data-pinned', pin)
        }
    }

    const measureNaturalHeight: Attachment<HTMLElement> = (node) => {
        let frame = 0
        const measure = () => {
            naturalHeight = fullWidthHeight(node)
            pinAnswerRows(node)
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
    class:fit--upright={layout.upright}
    class:fit--more={scrolls}
    {@attach measureColumn}
    style={layout.upright
        ? budget > 0
            ? `max-height:${budget}px;`
            : ''
        : `height:${fitted ? `${fitted.height}px` : 'auto'};`}
>
    <!-- `--fit-scale` for a tap target that must stay 44 px on the screen however the step is scaled;
         1 on an upright phone, which never scales. -->
    <div
        class="fit__inner"
        {@attach measureNaturalHeight}
        style="width:{scale < 1 ? `${100 / scale}%` : '100%'}; transform:{scale < 1
            ? `scale(${scale})`
            : 'none'}; --fit-scale:{scale};"
    >
        {@render children()}
    </div>
</div>

<style>
    /* Scaled, it never clips: a read that ran short overlaps the board below until the next read.
       On an upright phone it scrolls inside its share instead. A container, so content sized in
       `cqw` takes the unscaled box's width and fitting never changes its layout. */
    .fit {
        position: relative;
        z-index: 1;
        container-type: inline-size;
    }
    .fit__inner {
        transform-origin: top left;
    }

    /* An upright phone: the panel at full size, scrolling inside a box at most its share tall. */
    .fit--upright {
        overflow-y: auto;
        overscroll-behavior: contain;
    }
    /* More below: a line in the frame's colour at full opacity along the box's bottom, and a fade
       over its last 36 px that goes once scrolled to the end. A browser without scroll-driven
       animation keeps the line and has no fade. */
    @property --oath-fit-fade {
        syntax: '<length>';
        inherits: false;
        initial-value: 0px;
    }
    @keyframes fit-more {
        0%,
        92% {
            --oath-fit-fade: 36px;
        }
        100% {
            --oath-fit-fade: 0px;
        }
    }
    .fit--more {
        border-bottom: 2px solid var(--oath-frame);
        mask-image: linear-gradient(
            to bottom,
            #000 calc(100% - var(--oath-fit-fade)),
            rgb(0 0 0 / 0.2)
        );
        animation: fit-more linear both;
        animation-timeline: scroll(self);
    }
    @supports (color: oklab(from red l a b / 1)) {
        .fit--more {
            border-bottom-color: oklab(from var(--oath-frame) l a b / 1);
        }
    }
    /* A pinned answer row takes the fade's place. */
    .fit--more:has(:global([data-answer-row][data-pinned])) {
        mask-image: none;
    }
    /* While there is more below, the answer row on one line sticks to the box's bottom, drawn as
       the panel is drawn over the page, but opaque, with a shadow above it. In a panel that fits
       it stays where it is, drawn as the rest. */
    .fit--more :global([data-answer-row][data-pinned]) {
        position: sticky;
        bottom: 0;
        z-index: 2;
        padding-block: 6px;
        margin-bottom: -6px;
        background: linear-gradient(var(--oath-surface), var(--oath-surface)), var(--oath-page);
        box-shadow: 0 -10px 12px -6px rgb(0 0 0 / 0.7);
    }
</style>
