<script lang="ts">
    import { onMount } from 'svelte'
    import { SquareType, isFieldSquare, MachineState, type CanalSegment } from '@tabletop/santiago'
    import { Color } from '@tabletop/common'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { fieldImageUrl } from '$lib/utils/cropImages.js'
    import {
        W, H, BORDER_X, BORDER_Y, FIELD_W, FIELD_H, CELL_W, CELL_H,
        GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS, gridLine, intersectionX, intersectionY
    } from '$lib/utils/boardGeometry.js'

    const session = getGameSession()

    // Placed-canal visual thickness.
    const CANAL_THICKNESS = 12.48 // 9.6 * 1.3 — ~30% thicker
    const CANAL_HALF_THICKNESS = CANAL_THICKNESS / 2

    function segCoords(seg: { orientation: 'H' | 'V'; col: number; row: number }) {
        const x = intersectionX(seg.col)
        const y = intersectionY(seg.row)
        return seg.orientation === 'H'
            ? { x1: x, y1: y, x2: intersectionX(seg.col + 1), y2: y }
            : { x1: x, y1: y, x2: x, y2: intersectionY(seg.row + 1) }
    }

    const fieldImage = fieldImageUrl

    // Deterministic pseudo-random tilt per cell — looks like a real piece placed on a board
    function fieldRotation(col: number, row: number): number {
        return ((col * 7 + row * 11 + col * row * 3) % 17 - 8) * 0.125
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

    // Direction the dashes should flow: -1 makes them march toward (x2,y2) / (right or down);
    // +1 makes them march toward (x1,y1) / (left or up). Spring is always the source.
    function segFlowDir(seg: { orientation: 'H' | 'V'; col: number; row: number }): -1 | 1 {
        const spring = session.gameState.board.spring
        if (seg.orientation === 'H') {
            return spring.col <= seg.col ? -1 : 1
        } else {
            return spring.row <= seg.row ? -1 : 1
        }
    }

    // Proposed canals grouped by segment — shown during the full CanalBuilding phase
    const proposedSegments = $derived.by(() => {
        if (session.gameState.machineState !== MachineState.CanalBuilding) return []
        return session.segmentProposals.map((sp) => ({
            segment: sp.segment as CanalSegment,
            contributions: sp.contributions.map(c => ({ playerId: c.playerId, color: playerColor(c.playerId), amount: c.amount })),
        }))
    })

    const isOverseerDeciding = $derived(
        session.gameState.machineState === MachineState.CanalBuilding &&
        session.isMyTurn &&
        session.isOverseerDecisionPhase
    )

    // Valid canal locations that received no bribe — shown to the overseer as a
    // "reject all & build here" label with the penalty cost, alongside the bribe labels.
    const unbribedSegments = $derived.by(() => {
        if (!isOverseerDeciding) return []
        const bribed = new Set(proposedSegments.map(ps => labelKey(ps.segment)))
        return session.validSegments.filter(seg => !bribed.has(labelKey(seg)))
    })

    // Grid nodes touched by ≥2 canal segments — those ends get a square (not rounded)
    // cap, so adjoining segments' rectangles tile together with no gap and no patch needed.
    const canalJunctionKeys = $derived.by(() => {
        const counts = new Map<string, number>()
        for (const seg of session.gameState.board.canals) {
            const endpoints = seg.orientation === 'H'
                ? [`${seg.col},${seg.row}`, `${seg.col + 1},${seg.row}`]
                : [`${seg.col},${seg.row}`, `${seg.col},${seg.row + 1}`]
            for (const key of endpoints) {
                counts.set(key, (counts.get(key) ?? 0) + 1)
            }
        }
        return new Set([...counts.entries()].filter(([, n]) => n >= 2).map(([key]) => key))
    })

    function hasCanalSegment(col: number, row: number, orientation: 'H' | 'V'): boolean {
        return session.gameState.board.canals.some(
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
        const c = segCoords(seg)
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

    let hoveredLabelKey = $state<string | null>(null)
    function labelKey(seg: CanalSegment) { return `${seg.orientation},${seg.col},${seg.row}` }

    type Sparkle = { x: number; y: number; dx: number; dy: number; scale: number; rotate: number; id: number }
    let sparkles = $state<Sparkle[]>([])
    let sparkleId = 0

    onMount(() => {
        function spawnSparkle() {
            const canals = session.gameState.board.canals
            if (canals.length === 0) return
            const seg = canals[Math.floor(Math.random() * canals.length)]
            const c = segCoords(seg)
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
            sparkles = [...sparkles, s]
            setTimeout(() => { sparkles = sparkles.filter(x => x.id !== s.id) }, 1200)
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
            sparkles = [...sparkles, s]
            setTimeout(() => { sparkles = sparkles.filter(x => x.id !== s.id) }, 1200)
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
@keyframes marchingAnts {
    from { stroke-dashoffset: var(--dash-start, 0); }
    to   { stroke-dashoffset: var(--flow-end, -10); }
}
.canal-animated {
    animation: marchingAnts 1.67s linear infinite;
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
     style="width: {W}px; height: {H}px; background-image: url('/santiago_board.png'); background-size: 100% 100%; background-position: center center">

    <!-- Cell grid — inset to match board image's stone border -->
    <div class="absolute grid"
         style="left: {BORDER_X}px; top: {BORDER_Y}px; width: {FIELD_W}px; height: {FIELD_H}px; grid-template-columns: {GRID_TEMPLATE_COLUMNS}; grid-template-rows: {GRID_TEMPLATE_ROWS}">
        {#each Array(6) as _, row}
            {#each Array(8) as _, col}
                {@const sq = session.gameState.board.squares[col][row]}
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
                            <img src="/palmtree.png" alt="palm tree" class="absolute inset-0 w-full h-full object-contain p-1" />
                        {/if}
                    {:else if sq.dried}
                        <img src="/desert.png" alt="desert"
                             class="absolute object-cover"
                             style="inset:3px; width:calc(100% - 6px); height:calc(100% - 6px); border-radius:3px; transform:rotate({desertRotation(col,row)}deg) scale(1.03); filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.55))" />
                    {:else}
                        <img src={fieldImage(sq.crop, sq.farmerCapacity)}
                             alt=""
                             class="absolute object-cover"
                             style="inset:3px; width:calc(100% - 6px); height:calc(100% - 6px); border-radius:3px; transform:rotate({fieldRotation(col,row)}deg) scale(1.03); filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.55))" />
                        <!-- Farmer cubes — only for owned fields -->
                        {#if sq.playerId}
                            <div class="absolute flex gap-[2px]" style="left: calc(20% - 7px); bottom: calc(20% - 6px)">
                                {#each Array(sq.farmerCount) as _, i}
                                    <div class="w-[18px] h-[18px] rounded-[4px]"
                                         style="background-color: {playerColor(sq.playerId)}; border: 1px solid rgba(0,0,0,0.85); box-shadow: 1px 2px 3px rgba(0,0,0,0.65); transform: rotate({cubeRotation(col, row, i)}deg)">
                                    </div>
                                {/each}
                            </div>
                        {/if}
                        {#if sq.hasPalmTree}
                            <img src="/palmtree.png" alt="palm tree" class="absolute bottom-0.5 right-0.5 w-8 h-8 object-contain" />
                        {/if}
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
         style="left: 10px; top: 10px; pointer-events: none; overflow: visible; user-select: none">
        <defs>
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
                {#each canalCornerFillets as f}
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
            {#each session.gameState.board.canals as seg}
                {@const isH = seg.orientation === 'H'}
                {@const d = canalPathD(seg, canalJunctionKeys)}
                <path {d} fill={isH ? 'url(#canalH)' : 'url(#canalV)'}/>
                <path {d} fill={isH ? 'url(#canalFadeH)' : 'url(#canalFadeV)'}/>
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

        <!-- Proposed canals — labels only; dashed lines come from the validSegments layer unchanged. -->
        {#snippet bribeLabel(cx: number, cy: number, fill: string, textColor: string, amount: number, extraStyle: string)}
            <rect x={cx - 20} y={cy - 14} width="40" height="28" rx="6"
                  fill={fill}
                  stroke="black" stroke-width="1"
                  opacity="0.9"
                  style={extraStyle} />
            <text x={cx} y={cy} text-anchor="middle" dominant-baseline="middle"
                  fill={textColor} font-size="16" font-weight="bold"
                  style="font-family:sans-serif; {extraStyle}">{amount}</text>
        {/snippet}
        {#each proposedSegments as ps}
            {@const c = segCoords(ps.segment)}
            {@const isH = ps.segment.orientation === 'H'}
            {@const mx = (c.x1 + c.x2) / 2}
            {@const my = (c.y1 + c.y2) / 2}
            {@const n = ps.contributions.length}
            {#if isOverseerDeciding}
                {@const key = labelKey(ps.segment)}
                {@const hovered = hoveredLabelKey === key}
                <g style="pointer-events: all; cursor: pointer"
                   onclick={() => session.acceptProposal(ps.segment)}
                   onmouseenter={() => hoveredLabelKey = key}
                   onmouseleave={() => hoveredLabelKey = null}>
                    {#each ps.contributions as contrib, i}
                        {@const cx = isH ? mx + (i - (n - 1) / 2) * 48 : c.x1 + 28}
                        {@const cy = isH ? c.y1 - 28 : my + (i - (n - 1) / 2) * 36}
                        {@const isYellow = isYellowPlayer(contrib.playerId)}
                        {@const popStyle = `transform-origin: ${cx}px ${cy}px; transform: scale(${hovered ? 1.15 : 1}); transition: transform 0.12s ease-out`}
                        {@render bribeLabel(cx, cy, contrib.color, isYellow ? 'black' : 'white', contrib.amount, popStyle)}
                    {/each}
                </g>
            {:else}
                {#each ps.contributions as contrib, i}
                    {@const cx = isH ? mx + (i - (n - 1) / 2) * 48 : c.x1 + 28}
                    {@const cy = isH ? c.y1 - 28 : my + (i - (n - 1) / 2) * 36}
                    {@const isYellow = isYellowPlayer(contrib.playerId)}
                    {@render bribeLabel(cx, cy, contrib.color, isYellow ? 'black' : 'white', contrib.amount, '')}
                {/each}
            {/if}
        {/each}

        <!-- Unbribed canal locations — overseer can click to reject all bribes and build here for a penalty -->
        {#each unbribedSegments as seg}
            {@const c = segCoords(seg)}
            {@const isH = seg.orientation === 'H'}
            {@const cx = isH ? (c.x1 + c.x2) / 2 : c.x1 + 28}
            {@const cy = isH ? c.y1 - 28 : (c.y1 + c.y2) / 2}
            {@const key = labelKey(seg)}
            {@const hovered = hoveredLabelKey === key}
            {@const popStyle = `transform-origin: ${cx}px ${cy}px; transform: scale(${hovered ? 1.15 : 1}); transition: transform 0.12s ease-out`}
            <g style="pointer-events: all; cursor: pointer"
               onclick={() => session.rejectAndBuild(seg)}
               onmouseenter={() => hoveredLabelKey = key}
               onmouseleave={() => hoveredLabelKey = null}>
                <rect x={cx - 20} y={cy - 14} width="40" height="28" rx="6"
                      fill="#666666"
                      stroke="black" stroke-width="1"
                      opacity="0.7"
                      style={popStyle} />
                <text x={cx} y={cy} text-anchor="middle" dominant-baseline="middle"
                      fill="white" font-size="16" font-weight="bold"
                      style="font-family:sans-serif; {popStyle}">
                    {session.rejectPenalty > 0 ? `-${session.rejectPenalty}` : '0'}
                </text>
            </g>
        {/each}

        <!-- Valid (unplaced) canal segments — clickable in canal mode -->
        {#each session.validSegments as seg}
            {@const c = segCoords(seg)}
            {@const dir = segFlowDir(seg)}
            <!-- Wider transparent hit area -->
            <line {...c} stroke="transparent" stroke-width="16"
                  style="pointer-events: all; cursor: pointer"
                  onclick={() => handleSegmentClick(seg)} />
            <line {...c}
                  stroke="#7dd3fc"
                  stroke-width="6"
                  stroke-linecap="round"
                  stroke-dasharray="15 12"
                  opacity="0.9"
                  class="canal-animated"
                  style={`--flow-end: ${dir * 27}`} />
        {/each}

        {#if session.gameState.machineState !== MachineState.SpringPlacement}
            <!-- Spring -->
            <circle
                cx={intersectionX(session.gameState.board.spring.col)}
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
            {#each [...session.validSpringSpots] as key}
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
</div>
