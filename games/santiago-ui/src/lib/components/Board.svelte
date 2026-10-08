<script lang="ts">
    import { onMount } from 'svelte'
    import { Color } from '@tabletop/common'
    import { fade } from 'svelte/transition'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import { bribePillKey } from '$lib/animators/bribePopAnimator.svelte.js'
    import { DUST_PARTICLES, dustParticleKey } from '$lib/animators/droughtDustAnimator.svelte.js'
    import { groupProposalsBySegment } from '$lib/model/turnRules.js'
    import { SquareType, isFieldSquare, MachineState, isSameSegment, type CanalSegment } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import BirdLayer from '$lib/birds/BirdLayer.svelte'
    import SunWash from './SunWash.svelte'
    import DustMotes from './DustMotes.svelte'
    import SurveyLine from './SurveyLine.svelte'
    import { fieldImageUrl } from '$lib/utils/cropImages.js'
    import { boardUrl, desertUrl, palmtreeUrl } from '$lib/utils/imageUrls.js'
    import {
        W, H, BORDER_X, BORDER_Y, FIELD_W, FIELD_H, CELL_W, CELL_H,
        GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS, COL_STARTS, gridLine, intersectionX, intersectionY
    } from '$lib/utils/boardGeometry.js'
    import { CANAL_HALF_THICKNESS, intersectionKey, segmentEndpointKeys, segmentEnds, segmentKey, waterEntersAtFarEnd } from '$lib/utils/canalGeometry.js'

    const session = getGameSession()
    const canalBuild = session.canalBuild
    const bribePop = session.bribePop
    const fieldPop = session.fieldPop
    const droughtDust = session.droughtDust
    const boardCanals = $derived(canalBuild.canals ?? session.gameState.board.canals)
    const waterNetwork = $derived({ spring: session.gameState.board.spring, canals: boardCanals })


    const fieldImage = fieldImageUrl

    // Deterministic pseudo-random tilt per cell — looks like a real piece placed on a board
    function fieldRotation(col: number, row: number): number {
        return ((col * 7 + row * 11 + col * row * 3) % 17 - 8) * 0.125
    }

    function swayPhase(seg: CanalSegment): number {
        return ((seg.col * 7 + seg.row * 13 + (seg.orientation === 'H' ? 5 : 0)) % 17) / 17
    }

    function palmSwayStyle(col: number, row: number): string {
        const seconds = 4.5 + ((col * 3 + row * 5) % 7) * 0.4
        const offset = ((col * 11 + row * 7) % 13) / 13
        return `animation-duration: ${seconds}s; animation-delay: ${-offset * seconds}s`
    }

    function cubeRotation(col: number, row: number, i: number): number {
        return ((col * 5 + row * 7 + i * 13) % 9 - 4) * 0.25
    }

    // Deterministic 90° multiple per cell — simulates someone flipping the tile to desert
    function desertRotation(col: number, row: number): number {
        return ((col * 3 + row * 5 + col * row * 7) % 4) * 90
    }

    // Returns 'irrigated', 'unirrigated', or null for non-highlighted squares
    function fieldHighlight(col: number, row: number): 'irrigated' | 'unirrigated' | null {
        const v = session.validFieldPlacements.get(`${col},${row}`)
        if (v === undefined) return null
        return v ? 'irrigated' : 'unirrigated'
    }

    function isValidNeutralPlacement(col: number, row: number): boolean {
        return session.validNeutralPlacements.has(`${col},${row}`)
    }

    function handleCellClick(col: number, row: number) {
        if (fieldHighlight(col, row) !== null) {
            session.placeField(col, row)
            return
        }
        if (isValidNeutralPlacement(col, row)) {
            session.placeNeutralField(col, row)
        }
    }

    function handleSegmentClick(seg: CanalSegment) {
        session.clickSegment(seg)
    }

    function playerColor(playerId: string): string {
        return session.colors.getPlayerUiColor(playerId)
    }

    function isYellowPlayer(playerId: string): boolean {
        return session.colors.getPlayerColor(playerId) === Color.Yellow
    }

    // Which way water runs along a segment, taking the spring as the source: -1 toward (x2,y2)
    // (right or down), +1 toward (x1,y1) (left or up). Canal sparkles drift this way.
    function segFlowDir(seg: CanalSegment): -1 | 1 {
        const spring = session.gameState.board.spring
        if (seg.orientation === 'H') {
            return spring.col <= seg.col ? -1 : 1
        } else {
            return spring.row <= seg.row ? -1 : 1
        }
    }

    // Proposed canals grouped by segment — shown during the full CanalBuilding phase
    const proposedSegments = $derived(
        groupProposalsBySegment(bribePop.proposals ?? session.canalProposals).map((sp) => ({
            segment: sp.segment,
            contributions: sp.contributions.map(c => ({ playerId: c.playerId, color: playerColor(c.playerId), amount: c.amount })),
        }))
    )

    const isOverseerDeciding = $derived(
        session.gameState.machineState === MachineState.CanalBuilding &&
        session.isMyTurn &&
        session.isOverseerDecisionPhase
    )

    const bribeColorsByKey = $derived(new Map(proposedSegments.map((ps) => [
        segmentKey(ps.segment),
        ps.contributions.map((c) => c.color)
    ])))

    const BRIBE_PILL_HALF_WIDTH = 20
    const BANK_PILL_HALF_WIDTH = 32
    const PILL_SPACING_ALONG_H = 48
    const PILL_SPACING_ALONG_V = 36
    const PILL_RISE = 40
    const PILL_DROP = 30
    const PILL_GAP = 8
    const PENNANT_SIDE_CLEARANCE = 18
    // Nothing outside the board's top and right edges is visible, so spots there put their pills
    // below the twine or to its left, and a horizontal spot's row of pills shifts to stay on the
    // board.
    function pillCenter(seg: CanalSegment, index: number, count: number, halfWidth: number): { cx: number; cy: number } {
        const c = segmentEnds(seg)
        if (seg.orientation === 'H') {
            const rowHalfSpan = ((count - 1) / 2) * PILL_SPACING_ALONG_H + halfWidth
            const rowCenter = Math.min(Math.max((c.x1 + c.x2) / 2, rowHalfSpan), W - rowHalfSpan)
            return {
                cx: rowCenter + (index - (count - 1) / 2) * PILL_SPACING_ALONG_H,
                cy: seg.row === 0 ? c.y1 + PILL_DROP : c.y1 - PILL_RISE
            }
        }
        const onRightEdge = seg.col === COL_STARTS.length
        return {
            cx: onRightEdge ? c.x1 - PENNANT_SIDE_CLEARANCE - halfWidth : c.x1 + PILL_GAP + halfWidth,
            cy: (c.y1 + c.y2) / 2 + (index - (count - 1) / 2) * PILL_SPACING_ALONG_V
        }
    }

    let hoveredLabelKey = $state<string | null>(null)

    // A finger has no hover, so on touch the first tap on an unbribed spot reveals its cost to the
    // bank, and building there takes a tap on that cost. Any change of state forgets the reveal.
    let lastSegmentPointer = 'mouse'
    let revealedBankKey: string | null = $derived.by(() => {
        void session.gameState
        return null
    })

    function tapSegment(seg: CanalSegment, buildsForBankCost: boolean) {
        const key = segmentKey(seg)
        if (buildsForBankCost && lastSegmentPointer === 'touch' && revealedBankKey !== key) {
            revealedBankKey = key
            return
        }
        handleSegmentClick(seg)
    }

    // Grid nodes touched by ≥2 canal segments — those ends get a square (not rounded)
    // cap, so adjoining segments' rectangles tile together with no gap and no patch needed.
    const canalJunctionKeys = $derived.by(() => {
        const counts = new Map<string, number>()
        for (const seg of boardCanals) {
            for (const key of segmentEndpointKeys(seg)) {
                counts.set(key, (counts.get(key) ?? 0) + 1)
            }
        }
        return new Set([...counts.entries()].filter(([, n]) => n >= 2).map(([key]) => key))
    })

    function hasCanalSegment(col: number, row: number, orientation: 'H' | 'V'): boolean {
        return boardCanals.some(
            (s) => s.orientation === orientation && s.col === col && s.row === row
        )
    }

    // A small quarter-circle fillet radius for the corners of an L-turn, T-junction, or
    // 4-way crossing. Each of a junction's 4 corners is classified by how many of its two
    // adjacent cardinal directions (e.g. NE pairs with East and North) have a canal
    // continuing through them:
    //  - 0 (neither): a genuinely convex/exposed corner — rounded by hiding a small sliver
    //    via canalCornerMask, revealing the board underneath (see canalCornerFillets).
    //  - 1 (exactly one): not a corner at all — that one segment's own body extends past
    //    it, so the boundary there is just a straight edge continuing through. Left alone.
    //  - 2 (both): a concave/reflex corner (a notch cut into the solid, e.g. the inside of
    //    an L-turn) — rounded by *adding* a small quarter-disk into the notch (see
    //    canalConcaveFillets), tangent to both edges so it blends smoothly.
    // Implemented additively/via mask rather than reshaping each segment's own path, since
    // that would risk breaking the segments' proven-correct seamless tiling at junctions.
    const CANAL_FILLET_RADIUS = 6
    const canalCornerFillets = $derived.by(() => {
        const r = CANAL_HALF_THICKNESS
        const fillets: { cx: number; cy: number; ox: number; oy: number }[] = []
        for (const key of canalJunctionKeys) {
            const [jcol, jrow] = key.split(',').map(Number)
            const jx = intersectionX(jcol)
            const jy = intersectionY(jrow)
            const east = hasCanalSegment(jcol, jrow, 'H')
            const west = hasCanalSegment(jcol - 1, jrow, 'H')
            const south = hasCanalSegment(jcol, jrow, 'V')
            const north = hasCanalSegment(jcol, jrow - 1, 'V')
            // ox/oy point from the sharp corner back toward the junction's interior —
            // where the fillet's circle center goes.
            if (!east && !north) fillets.push({ cx: jx + r, cy: jy - r, ox: -1, oy: 1 })
            if (!west && !north) fillets.push({ cx: jx - r, cy: jy - r, ox: 1, oy: 1 })
            if (!east && !south) fillets.push({ cx: jx + r, cy: jy + r, ox: -1, oy: -1 })
            if (!west && !south) fillets.push({ cx: jx - r, cy: jy + r, ox: 1, oy: -1 })
        }
        return fillets
    })

    // Concave/reflex corners — the mirror image of canalCornerFillets' condition (both
    // adjacent directions present instead of neither). Drawn as a quarter-disk CENTERED ON
    // the sharp corner itself (radius CANAL_FILLET_RADIUS, same scale as the convex fillet),
    // clipped to just the one quadrant that's actually the empty notch — not a circle
    // offset away from the corner, which would put its bulk well past the joint instead of
    // softening the corner in place. qx/qy point from the corner into that empty quadrant.
    const canalConcaveFillets = $derived.by(() => {
        const r = CANAL_HALF_THICKNESS
        const fillets: { cx: number; cy: number; qx: number; qy: number }[] = []
        for (const key of canalJunctionKeys) {
            const [jcol, jrow] = key.split(',').map(Number)
            const jx = intersectionX(jcol)
            const jy = intersectionY(jrow)
            const east = hasCanalSegment(jcol, jrow, 'H')
            const west = hasCanalSegment(jcol - 1, jrow, 'H')
            const south = hasCanalSegment(jcol, jrow, 'V')
            const north = hasCanalSegment(jcol, jrow - 1, 'V')
            if (east && north) fillets.push({ cx: jx + r, cy: jy - r, qx: 1, qy: -1 })
            if (west && north) fillets.push({ cx: jx - r, cy: jy - r, qx: -1, qy: -1 })
            if (east && south) fillets.push({ cx: jx + r, cy: jy + r, qx: 1, qy: 1 })
            if (west && south) fillets.push({ cx: jx - r, cy: jy + r, qx: -1, qy: 1 })
        }
        return fillets
    })

    // Cubic-bezier approximation of a quarter circle (the standard "kappa" constant), rather
    // than an SVG arc command — an arc needs a sweep-flag guess, a bezier just needs plain
    // control-point coordinates computed from the corner and the two tangent points.
    const BEZIER_QUARTER_CIRCLE_KAPPA = 0.5522847498
    function concaveFilletPathD(f: { cx: number; cy: number; qx: number; qy: number }): string {
        const fr = CANAL_FILLET_RADIUS
        const k = BEZIER_QUARTER_CIRCLE_KAPPA
        const a = { x: f.cx + f.qx * fr, y: f.cy }
        const b = { x: f.cx, y: f.cy + f.qy * fr }
        const cp1 = { x: f.cx + f.qx * fr, y: f.cy + f.qy * fr * k }
        const cp2 = { x: f.cx + f.qx * fr * k, y: f.cy + f.qy * fr }
        return `M ${f.cx} ${f.cy} L ${a.x} ${a.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${b.x} ${b.y} Z`
    }

    // Builds a canal segment as a path (rather than a plain rect) so each end can be
    // independently rounded (true dead end) or square (connects to another segment).
    function canalPathD(seg: CanalSegment, junctionKeys: Set<string>): string {
        const c = segmentEnds(seg)
        const r = CANAL_HALF_THICKNESS
        if (seg.orientation === 'H') {
            const startFree = !junctionKeys.has(`${seg.col},${seg.row}`)
            const endFree = !junctionKeys.has(`${seg.col + 1},${seg.row}`)
            return roundedSegmentPath(c.x1, c.y1, c.x2, c.y1, r, startFree, endFree)
        } else {
            const startFree = !junctionKeys.has(`${seg.col},${seg.row}`)
            const endFree = !junctionKeys.has(`${seg.col},${seg.row + 1}`)
            return roundedSegmentPath(c.x1, c.y1, c.x1, c.y2, r, startFree, endFree)
        }
    }

    // Draws a straight thick "pill" from (ax,ay) to (bx,by): rounded at either end when
    // that end is free (a dead end), or squared off and overshot past the true point by r
    // when it's shared with another segment — the overshoot is what closes the gap a
    // flush square end would otherwise leave at the outer corner of an L-turn (a plain
    // square butt-join only covers each segment's own side of the joint, never the corner
    // beyond it — the overshoot extends into that corner instead of relying on the other
    // segment to cover it, which it geometrically can't).
    function roundedSegmentPath(
        ax: number, ay: number, bx: number, by: number, r: number,
        startFree: boolean, endFree: boolean
    ): string {
        const dx = bx - ax, dy = by - ay
        const len = Math.hypot(dx, dy)
        const ux = dx / len, uy = dy / len // unit vector along the segment, A→B
        const px = -uy, py = ux           // unit perpendicular

        // Free ends inset by r (room for the rounded cap to bulge back out to the true
        // point); joined ends overshoot by r past the true point in the same direction.
        const startShift = startFree ? r : -r
        const endShift = endFree ? -r : r

        const startTop = { x: ax + ux * startShift + px * r, y: ay + uy * startShift + py * r }
        const startBot = { x: ax + ux * startShift - px * r, y: ay + uy * startShift - py * r }
        const endTop = { x: bx + ux * endShift + px * r, y: by + uy * endShift + py * r }
        const endBot = { x: bx + ux * endShift - px * r, y: by + uy * endShift - py * r }

        let d = `M ${startTop.x} ${startTop.y} L ${endTop.x} ${endTop.y} `
        d += endFree ? `A ${r} ${r} 0 0 0 ${endBot.x} ${endBot.y} ` : `L ${endBot.x} ${endBot.y} `
        d += `L ${startBot.x} ${startBot.y} `
        d += startFree ? `A ${r} ${r} 0 0 0 ${startTop.x} ${startTop.y} ` : `L ${startTop.x} ${startTop.y} `
        return d + 'Z'
    }


    type Sparkle = { x: number; y: number; dx: number; dy: number; scale: number; rotate: number; id: number }
    let sparkles = $state<Sparkle[]>([])
    let sparkleId = 0
    const SPARKLE_LIFETIME_MS = 1200
    const sparkleRemovals = new Set<ReturnType<typeof setTimeout>>()

    function addSparkle(sparkle: Sparkle) {
        sparkles = [...sparkles, sparkle]
        const removal = setTimeout(() => {
            sparkleRemovals.delete(removal)
            sparkles = sparkles.filter((x) => x.id !== sparkle.id)
        }, SPARKLE_LIFETIME_MS)
        sparkleRemovals.add(removal)
    }

    onMount(() => () => {
        for (const removal of sparkleRemovals) clearTimeout(removal)
        sparkleRemovals.clear()
    })

    onMount(() => {
        function spawnSparkle() {
            const canals = session.gameState.board.canals
            if (canals.length === 0) return
            const seg = canals[Math.floor(Math.random() * canals.length)]
            const c = segmentEnds(seg)
            const t = 0.15 + Math.random() * 0.7
            const dir = segFlowDir(seg)
            const drift = 8
            const perpOffset = (Math.random() - 0.5) * 4
            const s: Sparkle = {
                x: c.x1 + (c.x2 - c.x1) * t + (seg.orientation === 'V' ? perpOffset : 0),
                y: c.y1 + (c.y2 - c.y1) * t + (seg.orientation === 'H' ? perpOffset : 0),
                dx: seg.orientation === 'H' ? -dir * drift : 0,
                dy: seg.orientation === 'V' ? -dir * drift : 0,
                scale: 0.7 + Math.random() * 0.7,
                rotate: (Math.random() - 0.5) * 60,
                id: ++sparkleId
            }
            addSparkle(s)
        }

        let timeout: ReturnType<typeof setTimeout>
        function schedule() {
            const count = session.gameState.board.canals.length
            // Scale from ~1500ms at 1 canal down to ~300ms at 20+ canals
            const clamped = Math.max(1, Math.min(count, 20))
            const base = 1500 - 1200 * (clamped - 1) / 19
            timeout = setTimeout(() => { spawnSparkle(); schedule() }, base * (0.5 + Math.random() * 0.5))
        }
        schedule()
        return () => clearTimeout(timeout)
    })

    // A slower, stationary sparkle at the spring itself (no drift, unlike canal sparkles —
    // dx/dy stay 0, so sparkle-pop's translate offsets are all zero and it just pops in place).
    onMount(() => {
        function spawnSpringSparkle() {
            // The spring isn't shown on the board yet during placement — nothing to sparkle.
            if (session.gameState.machineState === MachineState.SpringPlacement) return
            const spring = session.gameState.board.spring
            const angle = Math.random() * Math.PI * 2
            const radius = Math.random() * 8
            const s: Sparkle = {
                x: intersectionX(spring.col) + Math.cos(angle) * radius,
                y: intersectionY(spring.row) + Math.sin(angle) * radius,
                dx: 0,
                dy: 0,
                scale: 0.7 + Math.random() * 0.7,
                rotate: (Math.random() - 0.5) * 60,
                id: ++sparkleId
            }
            addSparkle(s)
        }

        let timeout: ReturnType<typeof setTimeout>
        function schedule() {
            timeout = setTimeout(() => { spawnSpringSparkle(); schedule() }, 5000 + Math.random() * 5000)
        }
        schedule()
        return () => clearTimeout(timeout)
    })
</script>

<style>
.board-shell :global(.survey .bank-pill) {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease-out;
}
.board-shell :global(.survey:hover .bank-pill),
.board-shell :global(.survey .bank-pill.revealed) {
    opacity: 1;
    pointer-events: all;
}
@keyframes palm-sway {
    0%, 100% { transform: rotate(-1.5deg) skewX(0.6deg); }
    50%      { transform: rotate(1.8deg) skewX(-0.8deg); }
}
.palm-sway {
    transform-origin: 50% 92%;
    animation-name: palm-sway;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
}
@media (prefers-reduced-motion: reduce) {
    .palm-sway { animation: none; }
}
@keyframes sparkle-pop {
    0%   { opacity: 0;   transform: translate(0px, 0px) scale(0.2); }
    25%  { opacity: 1;   transform: translate(calc(var(--dx) * 0.25px), calc(var(--dy) * 0.25px)) scale(1.1); }
    60%  { opacity: 0.9; transform: translate(calc(var(--dx) * 0.6px),  calc(var(--dy) * 0.6px))  scale(1); }
    100% { opacity: 0;   transform: translate(calc(var(--dx) * 1px),    calc(var(--dy) * 1px))    scale(0.6); }
}
.canal-sparkle {
    animation: sparkle-pop 1.2s ease-out forwards;
    transform-box: fill-box;
    transform-origin: center;
    pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
    .canal-sparkle { display: none; }
}

.board-shell {
    position: relative;
    display: inline-flex;
    padding: 10px;
    border-radius: 20px;
    background:
        radial-gradient(980px 620px at 14% 10%, rgba(255, 226, 180, 0.34), transparent 64%),
        repeating-linear-gradient(
            -30deg,
            rgba(80, 40, 15, 0.03) 0 2px,
            rgba(255, 255, 255, 0.02) 2px 7px
        ),
        #8a4a2e;
}

.board-surface {
    border-radius: 14px;
    overflow: hidden;
    box-shadow:
        0 0 0 5px rgba(58, 28, 10, 0.32),
        0 10px 22px rgba(30, 14, 4, 0.35);
}

/* Saved for later — Justin wants to see the placement arrow without the bounce for now,
   but may want it back. Re-add class="hover-arrow-bounce" to the arrow's <svg> to restore. */
@keyframes hoverArrowBounce {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(4px); }
}
.hover-arrow-bounce {
    animation: hoverArrowBounce 0.8s ease-in-out infinite;
}

@keyframes springPulse {
    0%     { r: 0px;    opacity: 0.85; }
    33.33% { opacity: 0.85; }
    66.67% { r: 34px;   opacity: 0; }
    100%   { r: 34px;   opacity: 0; }
}
.spring-pulse {
    animation: springPulse 6s ease-out infinite;
}

/* Once a canal is placed, the ripple becomes a much rarer ambient effect (5x longer
   period) — same active growth/fade speed as springPulse, just a far longer idle gap. */
@keyframes springPulseSlow {
    0%      { r: 0px;    opacity: 0.85; }
    6.667%  { opacity: 0.85; }
    13.333% { r: 34px;   opacity: 0; }
    100%    { r: 34px;   opacity: 0; }
}
.spring-pulse-slow {
    animation: springPulseSlow 30s ease-out infinite;
}
</style>

<div class="board-shell">
<div class="board-surface relative"
     style="width: {W}px; height: {H}px; background-image: url('{boardUrl}'); background-size: 100% 100%; background-position: center center">

    <!-- Cell grid — inset to match board image's stone border -->
    <div class="absolute grid"
         style="left: {BORDER_X}px; top: {BORDER_Y}px; width: {FIELD_W}px; height: {FIELD_H}px; grid-template-columns: {GRID_TEMPLATE_COLUMNS}; grid-template-rows: {GRID_TEMPLATE_ROWS}">
        {#each Array(6) as _, row (row)}
            {#each Array(8) as _, col (col)}
                {@const sq = (session.boardPreview.squares ?? session.gameState.board.squares)[col][row]}
                {@const highlight = fieldHighlight(col, row)}
                {@const neutralOk = isValidNeutralPlacement(col, row)}
                <button
                    class="group block w-full h-full select-none relative overflow-hidden transition-opacity cursor-default"
                    style="grid-column: {gridLine(col)}; grid-row: {gridLine(row)}"
                    onclick={() => handleCellClick(col, row)}
                    tabindex={highlight !== null || neutralOk ? 0 : -1}
                    aria-label="Square {col},{row}"
                >
                    {#if highlight !== null || neutralOk}
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <svg class="h-2/3 w-2/3 opacity-60" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M12 3v14m0 0-5-5m5 5 5-5" stroke="#4ade80" stroke-width="3"
                                      stroke-linecap="round" stroke-linejoin="round"
                                      style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.6))" />
                            </svg>
                        </div>
                    {/if}
                    {#if !isFieldSquare(sq)}
                        {#if sq.hasPalmTree}
                            <img src={palmtreeUrl} alt="palm tree" class="palm-sway absolute inset-0 w-full h-full object-contain p-1" style={palmSwayStyle(col, row)} />
                        {/if}
                    {:else if sq.dried}
                        <img src={desertUrl} alt="desert"
                             class="absolute object-cover"
                             style="inset:3px; width:calc(100% - 6px); height:calc(100% - 6px); border-radius:3px; transform:rotate({desertRotation(col,row)}deg) scale(1.03); filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.55))" />
                    {:else}
                        <div class="absolute inset-0" {@attach fieldPop.field(col, row)}>
                            {#if droughtDust.flipping.includes(intersectionKey(col, row))}
                                <!-- Drying: the field's card turns over to its desert side. -->
                                <div class="absolute" style="inset:3px; perspective: 600px">
                                    <div class="relative w-full h-full" style="transform-style: preserve-3d"
                                         {@attach droughtDust.flipCard(col, row)}>
                                        <img src={fieldImage(sq.crop, sq.farmerCapacity)}
                                             alt=""
                                             class="absolute inset-0 w-full h-full object-cover"
                                             style="backface-visibility: hidden; border-radius:3px; transform:rotate({fieldRotation(col,row)}deg) scale(1.03); filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.55))" />
                                        <img src={desertUrl}
                                             alt=""
                                             class="absolute inset-0 w-full h-full object-cover"
                                             style="backface-visibility: hidden; border-radius:3px; transform:rotateY(180deg) rotate({desertRotation(col,row)}deg) scale(1.03); filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.55))" />
                                    </div>
                                </div>
                            {:else}
                                <img src={fieldImage(sq.crop, sq.farmerCapacity)}
                                     alt=""
                                     class="absolute object-cover"
                                     style="inset:3px; width:calc(100% - 6px); height:calc(100% - 6px); border-radius:3px; transform:rotate({fieldRotation(col,row)}deg) scale(1.03); filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.55))" />
                            {/if}
                            <!-- Farmer cubes — only for owned fields -->
                            {#if sq.playerId}
                                <div class="absolute flex gap-[2px]" style="left: calc(20% - 7px); bottom: calc(20% - 6px)">
                                    {#each Array(sq.farmerCount) as _, i (i)}
                                        <div class="w-[18px] h-[18px] rounded-[4px]"
                                             style="background-color: {playerColor(sq.playerId)}; border: 1px solid rgba(0,0,0,0.85); box-shadow: 1px 2px 3px rgba(0,0,0,0.65); transform: rotate({cubeRotation(col, row, i)}deg)">
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                            {#if sq.hasPalmTree}
                                <img src={palmtreeUrl} alt="palm tree" class="palm-sway absolute bottom-0.5 right-0.5 w-8 h-8 object-contain" style={palmSwayStyle(col, row)} />
                            {/if}
                        </div>
                    {/if}
                </button>
            {/each}
        {/each}
    </div>
</div>

    <!-- SVG canal overlay — a sibling of .board-surface (not nested inside it) so its
         overflow:hidden (needed to round the board image's corners) doesn't clip labels
         that land near the board's edges; positioned to match .board-surface exactly. -->
    <svg class="absolute" width={W} height={H} viewBox="0 0 {W} {H}"
         style="left: 10px; top: 10px; pointer-events: none; overflow: visible; user-select: none"
         {@attach attachAnimator(canalBuild)}
         {@attach attachAnimator(bribePop)}
         {@attach attachAnimator(fieldPop)}
         {@attach attachAnimator(droughtDust)}>
        <defs>
            <clipPath id="canalReveal">
                <rect x="0" y="0" width={W} height={H}
                      {@attach (el: SVGRectElement) => {
                          canalBuild.setRevealRect(el)
                          return () => canalBuild.setRevealRect(undefined)
                      }} />
            </clipPath>
            <radialGradient id="droughtDust">
                <stop offset="0%" stop-color="rgb(238, 214, 172)" stop-opacity="1"/>
                <stop offset="60%" stop-color="rgb(228, 200, 154)" stop-opacity="0.75"/>
                <stop offset="100%" stop-color="rgb(218, 188, 140)" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="surveyStakeWood" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#f0c48a"/>
                <stop offset="100%" stop-color="#b47a42"/>
            </linearGradient>
            <!-- Horizontal piece: lighter on top edge (light from above) -->
            <linearGradient id="canalH" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="#8888cc"/>
                <stop offset="18%"  stop-color="#2222aa"/>
                <stop offset="65%"  stop-color="#0000a0"/>
                <stop offset="100%" stop-color="#000081"/>
            </linearGradient>
            <!-- Vertical piece: lighter on left edge -->
            <linearGradient id="canalV" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stop-color="#8888cc"/>
                <stop offset="18%"  stop-color="#2222aa"/>
                <stop offset="65%"  stop-color="#0000a0"/>
                <stop offset="100%" stop-color="#000081"/>
            </linearGradient>
            <!-- Fades a flat, orientation-independent color in near each segment's ends
                 (over the main gradient) so an H piece and a V piece meeting at a joint
                 show the same color right at the joint, instead of their differently
                 -oriented tube-shading clashing there. Fully transparent in the middle,
                 so the shading still shows along most of a segment's length. -->
            <linearGradient id="canalFadeH" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stop-color="#0000a0" stop-opacity="1"/>
                <stop offset="15%"  stop-color="#0000a0" stop-opacity="0"/>
                <stop offset="85%"  stop-color="#0000a0" stop-opacity="0"/>
                <stop offset="100%" stop-color="#0000a0" stop-opacity="1"/>
            </linearGradient>
            <linearGradient id="canalFadeV" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="#0000a0" stop-opacity="1"/>
                <stop offset="15%"  stop-color="#0000a0" stop-opacity="0"/>
                <stop offset="85%"  stop-color="#0000a0" stop-opacity="0"/>
                <stop offset="100%" stop-color="#0000a0" stop-opacity="1"/>
            </linearGradient>
            <!-- Self-similar radial gradient — since it's relative to the pulse circle's
                 own (animated) radius, the light band always sits near its current outer
                 edge, reading as a wavefront rippling outward as the circle grows. -->
            <radialGradient id="springPulseGradient">
                <stop offset="0%"   stop-color="#7dd3fc" stop-opacity="0"/>
                <stop offset="55%"  stop-color="#7dd3fc" stop-opacity="0"/>
                <stop offset="80%"  stop-color="#bee7fd" stop-opacity="0.85"/>
                <stop offset="100%" stop-color="#e0f2fe" stop-opacity="0"/>
            </radialGradient>
            <!-- Cuts a small quarter-circle notch out of the canal rendering at each exposed
                 junction corner (see canalCornerFillets) — the mask is white (fully visible)
                 everywhere by default; each fillet punches a tiny black square out of just its
                 sharp corner, then a white circle "un-punches" the rounded part back in, so
                 only the small sliver between the sharp point and the fillet arc is actually
                 hidden. What shows through there is the board's own background underneath the
                 canal overlay — a natural look for a rounded canal bend. -->
            <mask id="canalCornerMask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                <rect x="0" y="0" width={W} height={H} fill="white" />
                {#each canalCornerFillets as f, i (i)}
                    <rect x={Math.min(f.cx, f.cx + f.ox * CANAL_FILLET_RADIUS)}
                          y={Math.min(f.cy, f.cy + f.oy * CANAL_FILLET_RADIUS)}
                          width={CANAL_FILLET_RADIUS} height={CANAL_FILLET_RADIUS}
                          fill="black" />
                    <circle cx={f.cx + f.ox * CANAL_FILLET_RADIUS} cy={f.cy + f.oy * CANAL_FILLET_RADIUS}
                            r={CANAL_FILLET_RADIUS} fill="white" />
                {/each}
            </mask>
        </defs>

        <!-- Placed canals — rendered above tiles so they sit on top of tile shadows.
             Ends are square where they meet another segment, rounded at true dead ends,
             so adjoining segments tile together seamlessly with no separate joint patch.
             The mask then softens each junction's one genuinely exposed corner with a
             small curve (see canalCornerMask above). -->
        <g mask="url(#canalCornerMask)">
            {#each boardCanals as seg (segmentKey(seg))}
                {@const isH = seg.orientation === 'H'}
                {@const d = canalPathD(seg, canalJunctionKeys)}
                <g clip-path={segmentKey(seg) === canalBuild.revealingKey ? 'url(#canalReveal)' : undefined}>
                    <path {d} fill={isH ? 'url(#canalH)' : 'url(#canalV)'}/>
                    <path {d} fill={isH ? 'url(#canalFadeH)' : 'url(#canalFadeV)'}/>
                </g>
            {/each}
        </g>

        <!-- Concave junction corners — disabled for now (visible artifact reported at the
             inner/reflex corner across three different implementation attempts; the math
             kept checking out on paper, so the bug is likely in an assumption I haven't
             spotted rather than the formulas themselves). Left commented out, not deleted,
             in case we want to pick this back up — canalConcaveFillets/concaveFilletPathD
             below are unused while this stays off. The outer (convex) curve above is
             unaffected and confirmed working.
        {#each canalConcaveFillets as f}
            <path d={concaveFilletPathD(f)} fill="#0000a0" />
        {/each}
        -->

        {#each droughtDust.puffs as puff (puff.key)}
            <g transform="translate({puff.x} {puff.y})">
                {#each { length: DUST_PARTICLES } as _, i (i)}
                    <circle r={7 + (i % 3) * 2.5} fill="url(#droughtDust)" opacity="0"
                            {@attach droughtDust.particle(dustParticleKey(puff.key, i))} />
                {/each}
            </g>
        {/each}

        <!-- Canal sparkles — small glints that drift along placed canal segments -->
        {#each sparkles as s (s.id)}
            <g transform="translate({s.x},{s.y}) scale({s.scale})">
                <g class="canal-sparkle" style="--dx:{s.dx};--dy:{s.dy}">
                    <g transform="rotate({s.rotate})">
                        <line x1="0" y1="-1.5" x2="0" y2="1.5" stroke="white" stroke-width="0.5" stroke-linecap="round" opacity="0.9"/>
                        <line x1="-1.5" y1="0" x2="1.5" y2="0" stroke="white" stroke-width="0.5" stroke-linecap="round" opacity="0.9"/>
                        <line x1="-1" y1="-1" x2="1" y2="1" stroke="white" stroke-width="0.3" stroke-linecap="round" opacity="0.5"/>
                        <line x1="1" y1="-1" x2="-1" y2="1" stroke="white" stroke-width="0.3" stroke-linecap="round" opacity="0.5"/>
                        <circle r="0.4" fill="white" opacity="0.95"/>
                    </g>
                </g>
            </g>
        {/each}

        {#snippet bribeLabel(segment: CanalSegment, contrib: { playerId: string; color: string; amount: number }, cx: number, cy: number, hovered: boolean)}
            <g transform="translate({cx} {cy})">
                <g {@attach bribePop.pill(bribePillKey(segment, contrib.playerId))}>
                    <g style="transform: scale({hovered ? 1.15 : 1}); transition: transform 0.12s ease-out">
                        <rect x={-BRIBE_PILL_HALF_WIDTH} y="-14" width={BRIBE_PILL_HALF_WIDTH * 2} height="28" rx="6"
                              fill={contrib.color}
                              stroke="black" stroke-width="1"
                              opacity="0.9" />
                        <text x="0" y="0" text-anchor="middle" dominant-baseline="middle"
                              fill={isYellowPlayer(contrib.playerId) ? 'black' : 'white'} font-size="16" font-weight="bold"
                              style="font-family:sans-serif">{contrib.amount}</text>
                    </g>
                </g>
            </g>
        {/snippet}
        {#each proposedSegments as ps, psIndex (psIndex)}
            {@const n = ps.contributions.length}
            {#if isOverseerDeciding}
                {@const key = segmentKey(ps.segment)}
                {@const hovered = hoveredLabelKey === key}
                <g style="pointer-events: all; cursor: pointer; touch-action: manipulation"
                   onclick={() => session.acceptProposal(ps.segment)}
                   onmouseenter={() => hoveredLabelKey = key}
                   onmouseleave={() => hoveredLabelKey = null}>
                    {#each ps.contributions as contrib, i (i)}
                        {@const { cx, cy } = pillCenter(ps.segment, i, n, BRIBE_PILL_HALF_WIDTH)}
                        {@render bribeLabel(ps.segment, contrib, cx, cy, hovered)}
                    {/each}
                </g>
            {:else}
                {#each ps.contributions as contrib, i (i)}
                    {@const { cx, cy } = pillCenter(ps.segment, i, n, BRIBE_PILL_HALF_WIDTH)}
                    {@render bribeLabel(ps.segment, contrib, cx, cy, false)}
                {/each}
            {/if}
        {/each}

        {#each session.visibleSegments as seg (segmentKey(seg))}
            {@const c = segmentEnds(seg)}
            {@const key = segmentKey(seg)}
            {@const bribeColors = bribeColorsByKey.get(key)}
            <g {@attach (el: SVGGElement) => {
                   canalBuild.setSurveyNode(key, el)
                   return () => canalBuild.setSurveyNode(key, undefined)
               }}>
            <g in:fade={{ duration: session.easesAmbientChanges ? 250 : 0 }}>
            <SurveyLine
                {...c}
                selected={session.selectedBribeSegment !== undefined && isSameSegment(seg, session.selectedBribeSegment)}
                selectedColor={session.myPlayer ? playerColor(session.myPlayer.id) : undefined}
                fillsFromFarEnd={waterEntersAtFarEnd(seg, waterNetwork)}
                phase={swayPhase(seg)}
                bunting={bribeColors}
            >
                <!-- Drawn from visibleSegments (everyone, all through the bribe phase) but only
                     given a hit area when this player can actually act on it - see
                     SantiagoGameSession.validSegments. An observer sees where the bribes are
                     pointing without the lines inviting a click that would be rejected. -->
                {#if session.isMyTurn}
                    <!-- Wider transparent hit area. 34 user units rather than 16: the board is
                         drawn in a 768x576 viewBox and scaled to fit, so on a phone (~350px
                         wide) 16 units came out around 7 physical pixels - fine for a mouse,
                         essentially unhittable with a fingertip, which is what an Android
                         player reported. Parallel canals sit ~99 units apart, so 34 still
                         leaves a wide gap between neighbouring hit areas.
                         touch-action stops Android from holding the tap back to see whether a
                         double-tap zoom is coming. -->
                    <line {...c} stroke="transparent" stroke-width="34"
                          style="pointer-events: all; cursor: pointer; touch-action: manipulation"
                          onpointerdown={(event) => (lastSegmentPointer = event.pointerType)}
                          onclick={() => tapSegment(seg, isOverseerDeciding && !bribeColors)} />
                {/if}
                {#if isOverseerDeciding && !bribeColors}
                    {@const { cx, cy } = pillCenter(seg, 0, 1, BANK_PILL_HALF_WIDTH)}
                    <!-- Shown only while this spot is hovered, or on touch after a first tap on its
                         twine: the action bar already states the cost of rejecting every bribe and
                         building here. -->
                    <g class="bank-pill" class:revealed={revealedBankKey === segmentKey(seg)}
                       style="cursor: pointer; touch-action: manipulation"
                       onclick={() => session.rejectAndBuild(seg)}>
                        <rect x={cx - BANK_PILL_HALF_WIDTH} y={cy - 14} width={BANK_PILL_HALF_WIDTH * 2} height="28" rx="6"
                              fill="#666666" stroke="black" stroke-width="1" opacity="0.85" />
                        <text x={cx} y={cy} text-anchor="middle" dominant-baseline="middle"
                              fill="white" font-size="12" font-weight="bold"
                              style="font-family:sans-serif">
                            {session.rejectPenalty} → bank
                        </text>
                    </g>
                {/if}
            </SurveyLine>
            </g>
            </g>
        {/each}

        {#if session.gameState.machineState !== MachineState.SpringPlacement}
            <!-- Spring -->
            <circle
                cx={intersectionX(session.gameState.board.spring.col) + 1}
                cy={intersectionY(session.gameState.board.spring.row)}
                r="16.875"
                fill="#000081"
                stroke="#cccccc"
                stroke-width="2.5"
            />
            <!-- Spring pulse idle animation — disabled per Justin's feedback (didn't like it).
                 Left commented out rather than deleted in case we want it back.
            <circle
                cx={intersectionX(session.gameState.board.spring.col)}
                cy={intersectionY(session.gameState.board.spring.row)}
                r="0"
                fill="url(#springPulseGradient)"
                class={session.gameState.board.canals.length > 0 ? 'spring-pulse-slow' : 'spring-pulse'}
            /> -->
        {:else if session.isSpringPlacementTurn}
            <!-- Spring placement — click any highlighted intersection (corners excluded) -->
            {#each [...session.validSpringSpots] as key (key)}
                {@const [col, row] = key.split(',').map(Number)}
                {@const px = intersectionX(col)}
                {@const py = intersectionY(row)}
                <circle
                    cx={px} cy={py} r="11"
                    fill="rgba(125,211,252,0.55)"
                    stroke="#e0f2fe" stroke-width="1.5"
                    style="pointer-events: all; cursor: pointer"
                    onclick={() => session.placeSpring(col, row)}
                />
            {/each}
        {/if}
    </svg>
    <BirdLayer />
    <SunWash />
    <DustMotes />
</div>
