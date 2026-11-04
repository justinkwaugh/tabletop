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
    // Elsewhere, a panel still taller than `budget` at the smallest scale is drawn at that scale and
    // scrolls inside a box `budget` tall.
    let clamped = $derived(!layout.upright && (fitted?.scrolls ?? false))
    // An upright phone never scales: the box is at most `budget` tall and the panel scrolls inside it.
    let scrolls = $derived(
        layout.upright
            ? naturalHeight !== undefined && budget > 0 && naturalHeight > budget
            : clamped
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

    /** The panel's height laid out at the box's full width, whatever width it is drawn at. */
    function fullWidthHeight(content: HTMLElement): number {
        const scaled = content.parentElement ?? content
        const drawnWidth = scaled.style.width
        scaled.style.width = '100%'
        const height = content.scrollHeight
        scaled.style.width = drawnWidth
        return height
    }

    /**
     * An answer row whose buttons sit on one line sticks to the bottom of a box that scrolls; a
     * row without buttons yet is not pinned. Read from the buttons' tops, not the row's height,
     * which the pin's own padding changes; and set only on a change, since every attribute change
     * below the node is measured again.
     */
    function pinAnswerRows(node: HTMLElement) {
        for (const row of node.querySelectorAll<HTMLElement>('[data-answer-row]')) {
            const tops = new Set(
                [...row.children].map((child) =>
                    child instanceof HTMLElement ? child.offsetTop : 0
                )
            )
            const pin = tops.size === 1
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
    class:fit--clamped={clamped}
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
    <!-- Below the smallest scale the scaled panel scrolls inside itself, so what sticks to its top
         and bottom (the turn bar, an answer row) is placed in the same scaled space it is drawn in,
         and the scroll ends where the panel ends. Its content is measured on its own, so the
         scroller's height never feeds the natural height it is worked out from. -->
    <div
        class="fit__inner"
        style="width:{scale < 1 ? `${100 / scale}%` : '100%'}; transform:{scale < 1
            ? `scale(${scale})`
            : 'none'}; --fit-scale:{scale};"
    >
        <div class="fit__content" {@attach measureNaturalHeight}>
            {@render children()}
        </div>
    </div>
</div>

<style>
    /* Scaled, it never clips: a read that ran short overlaps the board below until the next read.
       On an upright phone, and elsewhere below the smallest scale, it scrolls inside its share
       instead. A container, so content sized in `cqw` takes the unscaled box's width and fitting
       never changes its layout. */
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
    /* Elsewhere, below the smallest scale: the box its share tall, and the panel at that scale,
       as tall as the box once drawn, scrolling inside itself. The box clips what the transform
       leaves of the scroller's layout size. */
    .fit--clamped {
        overflow: clip;
        timeline-scope: --oath-fit-scroll;
    }
    .fit--clamped > .fit__inner {
        height: calc(100% / var(--fit-scale));
        overflow-y: auto;
        overscroll-behavior: contain;
        scroll-timeline: --oath-fit-scroll block;
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
    /* Below the smallest scale it is the scaled panel that scrolls. */
    .fit--more.fit--clamped {
        animation-timeline: --oath-fit-scroll;
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
       it stays where it is, drawn as the rest. Its strip reaches 6 px past the buttons each way
       into the space around them, so pinning leaves the panel's height, which decides whether
       it pins, unchanged. It is drawn above everything else in the panel, which shares one
       stacking context with it: the badges on its cards are layers of their own (Magnifier 10,
       SiteMagnifier 20, UseBadge 7), and one scrolled under the row must not cover the answers.
       The box is a layer itself (z-index 1), so this order stays inside it. */
    .fit--more :global([data-answer-row][data-pinned]) {
        position: sticky;
        bottom: 0;
        z-index: 30;
        padding-block: 6px;
        margin-block: -6px;
        background: linear-gradient(var(--oath-surface), var(--oath-surface)), var(--oath-page);
        box-shadow: 0 -10px 12px -6px rgb(0 0 0 / 0.7);
    }
    /* Below the smallest scale, the turn bar (and its Undo) stays at the box's top while the step
       scrolls under it, opaque as the pinned answer row and above the same badges. An upright
       phone scrolls it away. */
    .fit--clamped :global([data-turn-bar]) {
        position: sticky;
        top: 0;
        z-index: 30;
        background: linear-gradient(var(--oath-surface), var(--oath-surface)), var(--oath-page);
    }
</style>
