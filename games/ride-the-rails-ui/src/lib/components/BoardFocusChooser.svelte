<script lang="ts">
    import type { ScalingWrapper } from '@tabletop/frontend-components'
    import type { BoundingBox, RectangleDimensions } from '@tabletop/common'
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import { prefersReducedMotion } from 'svelte/motion'
    import type { BoardFocusSelection } from '$lib/model/boardFocus.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOARD_EXTENTS } from '$lib/utils/boardGeometry.js'
    import {
        BOARD_FOCUSES,
        BOARD_MAX_FIT_SCALE,
        buildZoomKeepsView,
        buildZoomRequest,
        focusRequest,
        litRevealRect,
        restingFocus,
        restsAtCover,
        shownBoardRect,
        showsFocusChooser,
        type BoardFocus,
        type BuildOffer
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
        selection.keepPlayersView()
        // A focus chosen while building is where the end of building returns to.
        if (restoreView) restoreView = (animate) => show(focus, animate)
    }

    // Set once the view first rests, so an offer lit before then is looked at from where it rests.
    let rested = false

    // The part of the board the view shows now, read from where the board is drawn.
    function shownNow(): BoundingBox | undefined {
        const board = findInTable(tableOf(viewport), '[data-map-board]')
        if (!board) return undefined
        return shownBoardRect(
            board.getBoundingClientRect(),
            viewport.getBoundingClientRect(),
            boardInsetTop()
        )
    }

    // Contract, Phone layout: a new Riding offer whose lit hexes all lie outside a cover-fit view
    // pans the board, at its scale, to the nearest of them, unless the player has moved the view
    // since. A building offer is fitted instead (lookAtBuild).
    function lookAtOffer() {
        const hexIds = selection.offer.take()
        const shown = shownNow()
        if (!wrapper || !hexIds || !shown || !restsAtCover(viewOf(viewport))) return
        const target = litRevealRect(hexIds, shown)
        if (!target) return
        selection.release()
        wrapper.revealRect(target, { animate: !prefersReducedMotion.current })
    }

    // The building offer last seen, looked at once the view rests.
    let buildOffer: BuildOffer = { turn: undefined, lit: [], held: undefined }

    // Where the view goes back to when the building turns on this screen end: the focus last
    // chosen during them, else the focus chosen before the first zoom, the whole map where the
    // view rested on it, or the view as it was.
    let restoreView: ((animate: boolean) => void) | undefined

    function rememberView(shownWrapper: ScalingWrapper): (animate: boolean) => void {
        const focus = selection.current
        if (focus) return (animate) => show(focus, animate)
        // A focus rather than a fit, so a resize while it glides (the panel changing as the turn
        // ends) refits the whole map instead of stopping short.
        if (!restsAtCover(viewOf(viewport)) && shownWrapper.isZoomedOut()) {
            return (animate) =>
                shownWrapper.focusRect(BOARD_EXTENTS, {
                    maxScale: BOARD_MAX_FIT_SCALE,
                    padding: 0,
                    animate
                })
        }
        const captured = shownWrapper.captureView()
        return (animate) => captured({ animate })
    }

    // Contract, Build: the deciding seat's view fits its building offer's lit hexes.
    function lookAtBuild() {
        const move = selection.build.follow(buildOffer)
        if (!wrapper || !move) return
        const animate = !prefersReducedMotion.current
        if (move.kind === 'restore') {
            restoreView?.(animate)
            restoreView = undefined
            return
        }
        if (move.kind === 'fit' && move.remember) restoreView = rememberView(wrapper)
        const view = viewOf(viewport)
        const shown = shownNow()
        if (!shown) return
        if (move.kind === 'keep-in-view' && buildZoomKeepsView(move.hexIds, view, shown)) return
        const request = buildZoomRequest(move.hexIds, view, shown)
        if (!request) return
        selection.release()
        wrapper.focusRect(request.rect, { maxScale: request.maxScale, padding: 0, animate })
    }

    // Re-runs whenever the lit hexes, the building turn or a held spotlight change; while history
    // is shown the offer is left as it was.
    const followOffer: Attachment<HTMLElement> = () => {
        const lit = gameSession.boardOffer.lit
        const turn = gameSession.buildingTurn
        const held = gameSession.heldRailroadId
        if (gameSession.isViewingHistory) return
        untrack(() => {
            buildOffer = { turn, lit: turn === undefined ? [] : lit, held }
            // A building offer is the zoom's alone, so the Riding pan never fights it.
            selection.offer.light(turn === undefined ? lit.map((hex) => hex.hexId) : [])
            if (rested) {
                lookAtBuild()
                lookAtOffer()
            }
        })
    }

    // A phone's view first rests on the middle third with hexes at least 37 px, not the wrapper's
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
                lookAtBuild()
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
