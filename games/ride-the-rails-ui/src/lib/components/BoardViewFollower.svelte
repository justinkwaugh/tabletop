<script lang="ts">
    import { visualClientRect, type ScalingWrapper } from '@tabletop/frontend-components'
    import type { BoundingBox, RectangleDimensions } from '@tabletop/common'
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import { prefersReducedMotion } from 'svelte/motion'
    import type { BoardView } from '$lib/model/boardView.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOARD_EXTENTS } from '$lib/utils/boardGeometry.js'
    import {
        BOARD_MAX_FIT_SCALE,
        buildZoomKeepsView,
        buildZoomRequest,
        litRevealRect,
        restingRequest,
        restsAtCover,
        shownBoardRect,
        type BuildOffer
    } from '$lib/utils/boardFocus.js'
    import { findInTable, tableOf } from '$lib/utils/tableScope.js'

    let {
        wrapper,
        viewport,
        boardView
    }: {
        wrapper: ScalingWrapper | undefined
        viewport: HTMLElement
        boardView: BoardView
    } = $props()

    const gameSession = getGameSession()

    function viewOf(element: HTMLElement): RectangleDimensions {
        return { width: element.clientWidth, height: element.clientHeight }
    }

    // Contract, Phone layout: the middle third, hexes at least 37 px.
    function showResting(animate: boolean) {
        if (!wrapper) return
        const request = restingRequest(viewOf(viewport))
        wrapper.focusRect(request.rect, { maxScale: request.maxScale, padding: 0, animate })
        boardView.rest()
    }

    // Set once the view first rests, so an offer lit before then is looked at from where it rests.
    let rested = false

    // The part of the board the view shows now, read from where the board is drawn. The board lies
    // inside the view's CSS zoom, so it is measured as drawn (`docs/phone-rendering.md`, Measuring
    // under zoom).
    function shownNow(): BoundingBox | undefined {
        const board = findInTable(tableOf(viewport), '[data-map-board]')
        if (!board) return undefined
        return shownBoardRect(visualClientRect(board), viewport.getBoundingClientRect())
    }

    // Contract, Phone layout: a new Riding offer whose lit hexes all lie outside a cover-fit view
    // pans the board, at its scale, to the nearest of them, unless the player has moved the view
    // since. A building offer is fitted instead (lookAtBuild).
    function lookAtOffer() {
        const hexIds = boardView.offer.take()
        const shown = shownNow()
        if (!wrapper || !hexIds || !shown || !restsAtCover(viewOf(viewport))) return
        const target = litRevealRect(hexIds, shown)
        if (!target) return
        boardView.leaveRest()
        wrapper.revealRect(target, { animate: !prefersReducedMotion.current })
    }

    // The building offer last seen, looked at once the view rests.
    let buildOffer: BuildOffer = { turn: undefined, lit: [], held: undefined }

    // Where the view goes back to when the building turns on this screen end: the view from
    // before the first zoom, which is a phone's rest, the whole map where the view rested on it,
    // or the view as it was.
    let restoreView: ((animate: boolean) => void) | undefined

    function rememberView(shownWrapper: ScalingWrapper): (animate: boolean) => void {
        if (boardView.resting) return showResting
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
        const move = boardView.build.follow(buildOffer)
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
        boardView.leaveRest()
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
            boardView.offer.light(turn === undefined ? lit.map((hex) => hex.hexId) : [])
            if (rested) {
                lookAtBuild()
                lookAtOffer()
            }
        })
    }

    // A phone's view first rests on the middle third with hexes at least 37 px, not the wrapper's
    // cover fit, and is kept there at its scale as the view resizes.
    const followView: Attachment<HTMLElement> = () => {
        const view = viewport
        const observer = new ResizeObserver(() => {
            const size = viewOf(view)
            if (!wrapper || size.width === 0 || size.height === 0) return
            if (!rested) {
                rested = true
                if (restsAtCover(size)) showResting(false)
                lookAtBuild()
                lookAtOffer()
            } else if (boardView.resting) {
                showResting(false)
            }
        })
        observer.observe(view)
        return () => observer.disconnect()
    }
</script>

<div hidden {@attach followView} {@attach followOffer}></div>
