<script lang="ts">
    import { onMount } from 'svelte'
    import { SquareType, isFieldSquare, MachineState, type CanalSegment } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { fieldImageUrl } from '$lib/utils/cropImages.js'

    const session = getGameSession()

    let { cellPxW = $bindable(0), cellPxH = $bindable(0) }: { cellPxW?: number; cellPxH?: number } = $props()

    // Board display size (unscaled)
    const W = 384
    const H = 288

    // Calibrated from marker dots placed on santiago_board.png (6741×4931 px):
    //   red  dot (top-left  field corner): image (263, 190)
    //   blue dot (top-right field corner): image (6475, 187)
    //   green dot (bottom-right corner):   image (~6489, 4744)
    const BORDER_X = 263 / 6741 * W    // ≈ 15.0 px
    const BORDER_Y = 187 / 4931 * H    // ≈ 10.9 px
    const FIELD_W  = (6503 - 263) / 6741 * W   // ≈ 355.5 px
    const FIELD_H  = (4744 - 190) / 4931 * H   // ≈ 265.9 px

    // Ditch intersection step — board has 4-col × 3-row grid of 2×2 cell blocks
    const STEP_X = FIELD_W / 4         // ≈ 88.5 px
    const STEP_Y = FIELD_H / 3         // ≈ 88.6 px

    // Individual cell dimensions
    const CELL_W = STEP_X / 2          // ≈ 44.25 px
    const CELL_H = STEP_Y / 2          // ≈ 44.3 px

    function segCoords(seg: { orientation: 'H' | 'V'; col: number; row: number }) {
        const x = BORDER_X + seg.col * STEP_X
        const y = BORDER_Y + seg.row * STEP_Y
        return seg.orientation === 'H'
            ? { x1: x, y1: y, x2: x + STEP_X, y2: y }
            : { x1: x, y1: y, x2: x, y2: y + STEP_Y }
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

    function handleCellClick(col: number, row: number) {
        if (fieldHighlight(col, row) === null) return
        session.placeField(col, row)
    }

    function handleSegmentClick(seg: { orientation: 'H' | 'V'; col: number; row: number }) {
        if (isOverseerDeciding) {
            const hasProposal = proposedSegments.some(ps =>
                ps.segment.orientation === seg.orientation &&
                ps.segment.col === seg.col &&
                ps.segment.row === seg.row
            )
            if (hasProposal) {
                session.acceptProposal(seg)
                return
            }
        }
        session.selectSegment(seg)
    }

    function playerColor(playerId: string): string {
        return session.colors.getPlayerUiColor(playerId)
    }

    // Self-scaling: measure container width, derive scale factor
    let containerWidth: number = $state(0)
    const scale = $derived(containerWidth > 0 ? containerWidth / W : 1)

    $effect(() => {
        cellPxW = CELL_W * scale
        cellPxH = CELL_H * scale
    })

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
            contributions: sp.contributions.map(c => ({ color: playerColor(c.playerId), amount: c.amount })),
        }))
    })

    const isOverseerDeciding = $derived(
        session.gameState.machineState === MachineState.CanalBuilding &&
        session.isMyTurn &&
        session.isOverseerDecisionPhase
    )

    // Grid nodes touched by ≥2 canal segments — used to smooth joints
    const canalJunctionPoints = $derived.by(() => {
        const counts = new Map<string, { col: number; row: number; n: number }>()
        for (const seg of session.gameState.board.canals) {
            const endpoints = seg.orientation === 'H'
                ? [{ col: seg.col, row: seg.row }, { col: seg.col + 1, row: seg.row }]
                : [{ col: seg.col, row: seg.row }, { col: seg.col, row: seg.row + 1 }]
            for (const ep of endpoints) {
                const key = `${ep.col},${ep.row}`
                const entry = counts.get(key)
                if (entry) entry.n++
                else counts.set(key, { ...ep, n: 1 })
            }
        }
        return [...counts.values()].filter(p => p.n >= 2)
    })

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
</style>

<div bind:clientWidth={containerWidth} class="w-full shrink-0 overflow-hidden" style="height: {Math.round(H * scale)}px">
<div class="relative rounded shadow-xl origin-top-left"
     style="width: {W}px; height: {H}px; background-image: url('/santiago_board.png'); background-size: 98% 98%; background-position: center center; transform: scale({scale})">

    <!-- Cell grid — inset to match board image's stone border -->
    <div class="absolute grid"
         style="left: {BORDER_X}px; top: {BORDER_Y}px; width: {FIELD_W}px; height: {FIELD_H}px; grid-template-columns: repeat(8, {CELL_W}px); grid-template-rows: repeat(6, {CELL_H}px)">
        {#each Array(6) as _, row}
            {#each Array(8) as _, col}
                {@const sq = session.gameState.board.squares[col][row]}
                {@const highlight = fieldHighlight(col, row)}
                <button
                    class="block w-full h-full select-none relative overflow-hidden transition-opacity"
                    class:cursor-pointer={highlight !== null}
                    class:cursor-default={highlight === null}
                    onclick={() => handleCellClick(col, row)}
                    tabindex={highlight !== null ? 0 : -1}
                    aria-label="Square {col},{row}"
                >
                    {#if highlight !== null}
                        <svg class="absolute pointer-events-none"
                             style="width:50%; height:50%; top:25%; left:25%"
                             viewBox="0 0 24 24" fill="none"
                             stroke={highlight === 'irrigated' ? '#3b82f6' : '#f97316'}
                             stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    {/if}
                    {#if !isFieldSquare(sq)}
                        {#if sq.hasPalmTree}
                            <span class="absolute inset-0 flex items-center justify-center text-xl">🌴</span>
                        {/if}
                    {:else if sq.dried}
                        <img src="/desert.png" alt="desert"
                             class="absolute object-cover"
                             style="inset:3px; width:calc(100% - 6px); height:calc(100% - 6px); border-radius:3px; transform:rotate({desertRotation(col,row)}deg); filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.55))" />
                    {:else}
                        <img src={fieldImage(sq.crop, sq.farmerCapacity)}
                             alt=""
                             class="absolute object-cover"
                             style="inset:3px; width:calc(100% - 6px); height:calc(100% - 6px); border-radius:3px; transform:rotate({fieldRotation(col,row)}deg); filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.55))" />
                        <!-- Farmer cubes — one per farmer, player's colour -->
                        <div class="absolute flex gap-[2px]" style="left: 20%; bottom: 20%">
                            {#each Array(sq.farmerCount) as _, i}
                                <div class="w-[9px] h-[9px] rounded-[2px]"
                                     style="background-color: {playerColor(sq.playerId)}; border: 1px solid rgba(0,0,0,0.85); box-shadow: 1px 2px 3px rgba(0,0,0,0.65); transform: rotate({cubeRotation(col, row, i)}deg)">
                                </div>
                            {/each}
                        </div>
                        {#if sq.hasPalmTree}
                            <span class="absolute top-0.5 left-0.5 text-[10px] leading-none">🌴</span>
                        {/if}
                    {/if}
                </button>
            {/each}
        {/each}
    </div>

    <!-- SVG canal overlay — overflow visible so edge dots appear on the border -->
    <svg class="absolute inset-0" width={W} height={H} viewBox="0 0 {W} {H}"
         style="pointer-events: none; overflow: visible">
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
        </defs>

        <!-- Placed canals — rendered above tiles so they sit on top of tile shadows -->
        {#each session.gameState.board.canals as seg}
            {@const c = segCoords(seg)}
            {@const isH = seg.orientation === 'H'}
            {@const t = 4}
            {@const r = t / 2}
            {#if isH}
                <rect x={c.x1}     y={c.y1 - r + 2} width={c.x2 - c.x1} height={t} rx={r} fill="#000081" opacity="0.35"/>
                <rect x={c.x1}     y={c.y1 - r}      width={c.x2 - c.x1} height={t} rx={r} fill="url(#canalH)"/>
            {:else}
                <rect x={c.x1 - r + 2} y={c.y1} width={t} height={c.y2 - c.y1} rx={r} fill="#000081" opacity="0.35"/>
                <rect x={c.x1 - r}     y={c.y1} width={t} height={c.y2 - c.y1} rx={r} fill="url(#canalV)"/>
            {/if}
        {/each}

        <!-- Junction blobs — fill concave gaps where two canal segments meet -->
        {#each canalJunctionPoints as jp}
            {@const px = BORDER_X + jp.col * STEP_X}
            {@const py = BORDER_Y + jp.row * STEP_Y}
            <circle cx={px + 1.5} cy={py + 1.5} r="2.5" fill="#000081" opacity="0.35"/>
            <circle cx={px} cy={py} r="2.5" fill="#2222aa"/>
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
                        {@const cx = isH ? mx + (i - (n - 1) / 2) * 24 : c.x1 + 14}
                        {@const cy = isH ? c.y1 - 14 : my + (i - (n - 1) / 2) * 18}
                        <rect x={cx - 10} y={cy - 7} width="20" height="14" rx="3"
                              fill={hovered ? 'rgba(74,222,128,0.95)' : contrib.color}
                              opacity="0.9" />
                        <text x={cx} y={cy} text-anchor="middle" dominant-baseline="middle"
                              fill="white" font-size="8" font-weight="bold" style="font-family:sans-serif">
                            {contrib.amount}
                        </text>
                    {/each}
                </g>
            {:else}
                {#each ps.contributions as contrib, i}
                    {@const cx = isH ? mx + (i - (n - 1) / 2) * 24 : c.x1 + 14}
                    {@const cy = isH ? c.y1 - 14 : my + (i - (n - 1) / 2) * 18}
                    <rect x={cx - 10} y={cy - 7} width="20" height="14" rx="3" fill="rgba(0,0,0,0.75)" />
                    <text x={cx} y={cy} text-anchor="middle" dominant-baseline="middle"
                          fill={contrib.color} font-size="8" font-weight="bold" style="font-family:sans-serif">
                        {contrib.amount}
                    </text>
                {/each}
            {/if}
        {/each}

        <!-- Valid (unplaced) canal segments — clickable in canal mode -->
        {#each session.validSegments as seg}
            {@const c = segCoords(seg)}
            {@const selected = session.isSegmentSelected(seg)}
            {@const dir = segFlowDir(seg)}
            <!-- Wider transparent hit area -->
            <line {...c} stroke="transparent" stroke-width="16"
                  style="pointer-events: all; cursor: pointer"
                  onclick={() => handleSegmentClick(seg)} />
            <line {...c}
                  stroke={selected ? '#f0abfc' : '#7dd3fc'}
                  stroke-width={selected ? 5 : 3}
                  stroke-linecap="round"
                  stroke-dasharray={selected ? 'none' : '10 5'}
                  opacity="0.9"
                  class={selected ? '' : 'canal-animated'}
                  style={selected ? '' : `--flow-end: ${dir * 15}`} />
        {/each}

        <!-- Spring -->
        <circle
            cx={BORDER_X + session.gameState.board.spring.col * STEP_X}
            cy={BORDER_Y + session.gameState.board.spring.row * STEP_Y}
            r="4.5"
            fill="#0ea5e9"
            stroke="#e0f2fe"
            stroke-width="1.5"
        />
    </svg>
</div>
</div>
