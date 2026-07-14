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
    const CANAL_THICKNESS = 9.6
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
                            <svg class="w-4 h-4 hover-arrow-bounce" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M12 3v14m0 0-5-5m5 5 5-5" stroke="#fef08a" stroke-width="3"
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
         style="left: 10px; top: 10px; pointer-events: none; overflow: visible">
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
        </defs>

        <!-- Placed canals — rendered above tiles so they sit on top of tile shadows.
             Ends are square where they meet another segment, rounded at true dead ends,
             so adjoining segments tile together seamlessly with no separate joint patch. -->
        {#each session.gameState.board.canals as seg}
            {@const isH = seg.orientation === 'H'}
            {@const d = canalPathD(seg, canalJunctionKeys)}
            <path {d} fill={isH ? 'url(#canalH)' : 'url(#canalV)'}/>
            <path {d} fill={isH ? 'url(#canalFadeH)' : 'url(#canalFadeV)'}/>
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

        <!-- Proposed canals — labels only; dashed lines come from the validSegments layer unchanged -->
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
                        <rect x={cx - 20} y={cy - 14} width="40" height="28" rx="6"
                              fill={hovered ? 'rgba(74,222,128,0.95)' : contrib.color}
                              stroke={isYellow ? 'black' : 'none'} stroke-width={isYellow ? 1 : 0}
                              opacity="0.9" />
                        <text x={cx} y={cy} text-anchor="middle" dominant-baseline="middle"
                              fill={isYellow ? 'black' : 'white'} font-size="16" font-weight="bold" style="font-family:sans-serif">
                            {contrib.amount}
                        </text>
                    {/each}
                </g>
            {:else}
                {#each ps.contributions as contrib, i}
                    {@const cx = isH ? mx + (i - (n - 1) / 2) * 48 : c.x1 + 28}
                    {@const cy = isH ? c.y1 - 28 : my + (i - (n - 1) / 2) * 36}
                    {@const isYellow = isYellowPlayer(contrib.playerId)}
                    <rect x={cx - 20} y={cy - 14} width="40" height="28" rx="6"
                          fill={contrib.color} opacity="0.9"
                          stroke={isYellow ? 'black' : 'none'} stroke-width={isYellow ? 1 : 0} />
                    <text x={cx} y={cy} text-anchor="middle" dominant-baseline="middle"
                          fill={isYellow ? 'black' : 'white'} font-size="16" font-weight="bold" style="font-family:sans-serif">
                        {contrib.amount}
                    </text>
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
            <g style="pointer-events: all; cursor: pointer"
               onclick={() => session.rejectAndBuild(seg)}
               onmouseenter={() => hoveredLabelKey = key}
               onmouseleave={() => hoveredLabelKey = null}>
                <rect x={cx - 20} y={cy - 14} width="40" height="28" rx="6"
                      fill={hovered ? 'rgba(74,222,128,0.95)' : 'rgba(194,65,12,0.9)'}
                      opacity="0.9" />
                <text x={cx} y={cy} text-anchor="middle" dominant-baseline="middle"
                      fill="white" font-size="16" font-weight="bold" style="font-family:sans-serif">
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
            />
            <!-- Spring pulse — a light-blue ring expanding outward from the spring, fading
                 as it grows. The gradient is transparent through most of its radius so the
                 ring only shows near its own (growing) outer edge. Loops every 6s until the
                 first canal is placed, then drops to every 30s (a much rarer ambient effect
                 once the board's more visually busy). -->
            <circle
                cx={intersectionX(session.gameState.board.spring.col)}
                cy={intersectionY(session.gameState.board.spring.row)}
                r="0"
                fill="url(#springPulseGradient)"
                class={session.gameState.board.canals.length > 0 ? 'spring-pulse-slow' : 'spring-pulse'}
            />
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
