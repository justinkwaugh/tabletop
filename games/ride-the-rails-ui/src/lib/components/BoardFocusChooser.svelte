<script lang="ts">
    import type { ScalingWrapper } from '@tabletop/frontend-components'
    import type { RectangleDimensions } from '@tabletop/common'
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import { prefersReducedMotion } from 'svelte/motion'
    import type { BoardFocusSelection } from '$lib/model/boardFocus.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        BOARD_FOCUSES,
        focusRequest,
        litRevealRect,
        restingFocus,
        restsAtCover,
        shownBoardRect,
        showsFocusChooser,
        type BoardFocus
    } from '$lib/utils/boardFocus.js'
    import { boardInsetTop } from '$lib/utils/phoneLayout.svelte.js'
    import { findInTable, tableOf } from '$lib/utils/tableScope.js'

    let {
        wrapper,
        viewport,
        selection
    }: {
        wrapper: ScalingWrapper | undefined
        viewport: HTMLElement
        selection: BoardFocusSelection
    } = $props()

    const gameSession = getGameSession()

    // Contract, Phone layout (U-8): shown only while a hex is small on screen.
    const shown = $derived(wrapper !== undefined && showsFocusChooser(wrapper.viewScale()))

    // The view the wrapper fits into: its viewport below the chooser's inset.
    function viewOf(element: HTMLElement): RectangleDimensions {
        return {
            width: element.clientWidth,
            height: Math.max(0, element.clientHeight - boardInsetTop())
        }
    }

    function show(focus: BoardFocus, animate: boolean) {
        if (!wrapper) return
        const request = focusRequest(focus, viewOf(viewport))
        wrapper.focusRect(request.rect, { maxScale: request.maxScale, padding: 0, animate })
        selection.choose(focus)
    }

    function choose(focus: BoardFocus) {
        show(focus, true)
        selection.offer.moveByHand()
    }

    // Set once the view first rests, so an offer lit before then is looked at from where it rests.
    let rested = false

    // Contract, Phone layout: a new offer whose lit hexes all lie outside a cover-fit view pans the
    // board, at its scale, to the nearest of them, unless the player has moved the view since.
    function lookAtOffer() {
        const hexIds = selection.offer.take()
        const board = findInTable(tableOf(viewport), '[data-map-board]')
        if (!wrapper || !hexIds || !board || !restsAtCover(viewOf(viewport))) return
        const shown = shownBoardRect(
            board.getBoundingClientRect(),
            viewport.getBoundingClientRect(),
            boardInsetTop()
        )
        const target = litRevealRect(hexIds, shown)
        if (!target) return
        selection.release()
        wrapper.revealRect(target, { animate: !prefersReducedMotion.current })
    }

    // Re-runs whenever the lit hexes change; while history is shown the offer is left as it was.
    const followOffer: Attachment<HTMLElement> = () => {
        const hexIds = gameSession.boardOffer.lit.map((hex) => hex.hexId)
        if (gameSession.isViewingHistory) return
        untrack(() => {
            selection.offer.light(hexIds)
            if (rested) lookAtOffer()
        })
    }

    // A phone's view first rests on the middle third with hexes at least 33 px, not the wrapper's
    // cover fit; a chosen focus is kept at its scale as the view resizes.
    const followView: Attachment<HTMLElement> = () => {
        const view = viewport
        const observer = new ResizeObserver(() => {
            const size = viewOf(view)
            if (!wrapper || size.width === 0 || size.height === 0) return
            if (!rested) {
                rested = true
                const resting = restingFocus(size)
                if (resting) show(resting, false)
                lookAtOffer()
            } else if (selection.current) {
                show(selection.current, false)
            }
        })
        observer.observe(view)
        return () => observer.disconnect()
    }
</script>

<div class="chooser-anchor" {@attach followView} {@attach followOffer}>
    {#if shown}
        <div class="chooser shadow-md" role="group" aria-label="Focus the map">
            {#each BOARD_FOCUSES as { focus, label } (focus)}
                <button
                    type="button"
                    class:on={selection.current === focus}
                    aria-pressed={selection.current === focus}
                    onclick={() => choose(focus)}>{label}</button
                >
            {/each}
        </div>
    {/if}
</div>

<style>
    .chooser-anchor {
        position: absolute;
        top: 6px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        pointer-events: none;
    }

    .chooser {
        display: flex;
        gap: 2px;
        padding: 3px;
        border-radius: 10px;
        border: 1px solid var(--rtr-line);
        background: var(--rtr-panel);
        pointer-events: auto;
    }

    button {
        padding: 4px 11px;
        border-radius: 7px;
        color: var(--rtr-ink);
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
    }

    button:focus-visible {
        outline: 2px solid var(--rtr-accent);
    }

    button.on {
        background: var(--rtr-ink);
        color: var(--rtr-panel);
    }
</style>
