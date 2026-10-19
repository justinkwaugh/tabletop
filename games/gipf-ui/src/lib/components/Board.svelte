<script lang="ts">
    import { addAxial, sameCoordinates, scaleAxial, type AxialCoordinates } from '@tabletop/common'
    import { ALL_POINTS, AXES, DOTS, SPOTS, type Piece } from '@tabletop/gipf'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import {
        coordsKey,
        DOT_RADIUS,
        playAreaOutline,
        PIECE_RADIUS,
        pointCenter,
        viewBox
    } from '$lib/board/geometry.js'
    import PieceShape from './PieceShape.svelte'
    import { CROWN_SCALE, topFaceY } from '$lib/board/pieceGeometry.js'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
    import { cubicOut } from 'svelte/easing'

    const session = getGameSession()

    const frame = viewBox()
    const playArea = playAreaOutline()
    const inBoard = (coords: AxialCoordinates) => includesCoords(ALL_POINTS, coords)

    // Lines run dot to dot across the play area; the board's rim has no line between dots.
    const lines = AXES.flatMap((axis) =>
        ALL_POINTS.filter((point) => !inBoard(addAxial(point, scaleAxial(axis, -1)))).flatMap(
            (start) => {
                const points = [start]
                while (inBoard(addAxial(points[points.length - 1], axis))) {
                    points.push(addAxial(points[points.length - 1], axis))
                }
                const crossesPlay = points.some((point) => includesCoords(SPOTS, point))
                const end = points[points.length - 1]
                return crossesPlay ? [{ from: pointCenter(start), to: pointCenter(end) }] : []
            }
        )
    )

    const animator = new BoardAnimator(session)
    let hoveredDot: string | undefined = $state()
    const pieces = $derived(animator.pieces)

    // The piece you are about to bring in drops onto the dot you chose, until it slides in.
    const preview = $derived.by(() => {
        const dot = session.chosenDot
        const gipf = session.chosenGipf
        const playerId = session.myPlayer?.id
        if (dot === undefined || gipf === undefined || playerId === undefined) return undefined
        return animator.entering ? undefined : { dot, gipf, playerId }
    })

    function drop(_node: Element) {
        return {
            duration: 220,
            easing: cubicOut,
            css: (t: number) =>
                `opacity: ${t}; transform: translateY(${(1 - t) * -18}px) scale(${1 + (1 - t) * 0.15})`
        }
    }

    const SPOT_RADIUS = PIECE_RADIUS * 0.28
    const markedPieces = $derived(
        pieces
            .filter((piece) => rowRole(piece.coords) !== undefined)
            .toSorted(
                (a, b) =>
                    Number(includesCoords(session.rowGipfPieces, a.coords)) -
                    Number(includesCoords(session.rowGipfPieces, b.coords))
            )
    )

    function colorOf(piece: Piece) {
        return session.gameState.getPlayerState(piece.playerId).color
    }

    function isEntryDot(coords: AxialCoordinates) {
        return includesCoords(session.entryDots, coords)
    }

    function isChosenDot(coords: AxialCoordinates) {
        return session.chosenDot !== undefined && sameCoordinates(session.chosenDot, coords)
    }

    function rowRole(coords: AxialCoordinates): 'removing' | 'keeping' | 'row' | undefined {
        if (session.chosenRow) {
            if (includesCoords(session.removing, coords)) return 'removing'
            if (includesCoords(session.keep, coords)) return 'keeping'
        }
        return session.rows.some((row) => includesCoords(row.reach, coords)) ? 'row' : undefined
    }

    function choosePiece(coords: AxialCoordinates) {
        const inChosenRow = session.chosenRow && includesCoords(session.chosenRow.reach, coords)
        if (inChosenRow && includesCoords(session.rowGipfPieces, coords)) {
            session.toggleKeep(coords)
        } else {
            session.chooseRowAt(coords)
        }
    }

    function onKey(event: KeyboardEvent, act: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            act()
        }
    }

    function arrow(from: AxialCoordinates, to: AxialCoordinates): string {
        const start = pointCenter(from)
        const end = pointCenter(to)
        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy)
        const ux = dx / length
        const uy = dy / length
        const tipX = end.x - ux * PIECE_RADIUS * 0.55
        const tipY = end.y - uy * PIECE_RADIUS * 0.55
        const baseX = start.x + ux * DOT_RADIUS * 2
        const baseY = start.y + uy * DOT_RADIUS * 2
        const wing = 7
        return `M ${baseX} ${baseY} L ${tipX} ${tipY} M ${tipX - ux * wing - uy * wing} ${tipY - uy * wing + ux * wing} L ${tipX} ${tipY} L ${tipX - ux * wing + uy * wing} ${tipY - uy * wing - ux * wing}`
    }
</script>

<svg
    class="gipf-board"
    viewBox={frame.viewBox}
    width={frame.width}
    height={frame.height}
    role="group"
    aria-label="GIPF board"
    {@attach animator.attach}
>
    <defs>
        <filter id="gipf-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5"></feGaussianBlur>
        </filter>
    </defs>

    <polygon points={playArea} class="play-area"></polygon>

    <g class="lines">
        {#each lines as line, index (index)}
            <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}></line>
        {/each}
    </g>

    {#each session.notation.labels as label (label.key)}
        <text x={label.at.x} y={label.at.y} class="coordinate-label">{label.text}</text>
    {/each}

    {#each DOTS as coords (coordsKey(coords))}
        {@const center = pointCenter(coords)}
        {@const entry = isEntryDot(coords)}
        <g
            transform="translate({center.x} {center.y})"
            class="dot"
            class:entry
            class:chosen={isChosenDot(coords)}
            role="button"
            tabindex={entry ? 0 : -1}
            aria-disabled={!entry}
            aria-label="dot {session.notation.name(coords)}"
            onclick={() => session.chooseDot(coords)}
            onkeydown={(event) => onKey(event, () => session.chooseDot(coords))}
            onpointerenter={() => (hoveredDot = coordsKey(coords))}
            onpointerleave={() => (hoveredDot = undefined)}
            onfocus={() => (hoveredDot = coordsKey(coords))}
            onblur={() => (hoveredDot = undefined)}
        >
            {#if entry}
                <circle r={DOT_RADIUS * 2.4} class="dot-hit"></circle>
            {/if}
            <circle r={DOT_RADIUS} class="dot-core"></circle>
        </g>
    {/each}

    {#each pieces as piece (coordsKey(piece.coords))}
        {@const center = pointCenter(piece.coords)}
        {@const role = rowRole(piece.coords)}
        <g
            transform="translate({center.x} {center.y})"
            class="piece role-{role ?? 'none'}"
            role="button"
            tabindex={role ? 0 : -1}
            aria-disabled={!role}
            aria-label="{piece.gipf ? 'GIPF-piece' : 'piece'} {session.notation.name(piece.coords)}"
            onclick={() => role && choosePiece(piece.coords)}
            onkeydown={(event) => role && onKey(event, () => choosePiece(piece.coords))}
        >
            <g {@attach animator.piece(coordsKey(piece.coords))}>
                <PieceShape color={colorOf(piece)} gipf={piece.gipf} radius={PIECE_RADIUS} />
            </g>
        </g>
    {/each}

    <g {@attach animator.marks()}>
        {#each session.entryDots as coords (coordsKey(coords))}
            {@const center = pointCenter(coords)}
            <circle
                cx={center.x}
                cy={center.y}
                r={DOT_RADIUS * 2.4}
                class="dot-ring"
                class:chosen={isChosenDot(coords)}
                class:hovered={hoveredDot === coordsKey(coords)}
            ></circle>
        {/each}
        <!-- Marks sit on each piece's top face, so they never reach a neighbour: a dashed ring for a
             row you can choose, a spot on each piece that goes, and on your own GIPF-pieces the
             crown ring coloured for keep or take. -->
        {#each markedPieces as piece (coordsKey(piece.coords))}
            {@const center = pointCenter(piece.coords)}
            {@const role = rowRole(piece.coords)}
            {@const faceY = center.y + topFaceY(piece.gipf, PIECE_RADIUS)}
            {#if role === 'row'}
                <circle cx={center.x} cy={faceY} r={PIECE_RADIUS - 3} class="row-mark role-row"
                ></circle>
            {:else}
                {#if includesCoords(session.rowGipfPieces, piece.coords)}
                    <circle
                        cx={center.x}
                        cy={faceY}
                        r={PIECE_RADIUS * CROWN_SCALE}
                        class="crown-mark role-{role}"
                    ></circle>
                {/if}
                <circle cx={center.x} cy={faceY} r={SPOT_RADIUS} class="mark-spot role-{role}"
                ></circle>
            {/if}
        {/each}

        {#each session.targets as entry (coordsKey(entry.line[0]))}
            {@const center = pointCenter(entry.line[0])}
            <g
                class="target"
                role="button"
                tabindex="0"
                aria-label="push to {session.notation.name(entry.line[0])}"
                onclick={() => session.push(entry.line[0])}
                onkeydown={(event) => onKey(event, () => session.push(entry.line[0]))}
            >
                <path d={arrow(entry.dot, entry.line[0])} class="arrow"></path>
                <circle cx={center.x} cy={center.y} r={PIECE_RADIUS + 2} class="target-ring"
                ></circle>
            </g>
        {/each}
    </g>
    {#if animator.entering}
        {@const center = pointCenter(animator.entering.dot)}
        <g transform="translate({center.x} {center.y})" class="entering">
            <g {@attach animator.enteringPiece()}>
                <PieceShape
                    color={session.gameState.getPlayerState(animator.entering.playerId).color}
                    gipf={animator.entering.gipf}
                    radius={PIECE_RADIUS}
                />
            </g>
        </g>
    {:else if preview}
        {@const center = pointCenter(preview.dot)}
        <g transform="translate({center.x} {center.y})" class="entering">
            <g in:drop>
                <PieceShape
                    color={session.gameState.getPlayerState(preview.playerId).color}
                    gipf={preview.gipf}
                    radius={PIECE_RADIUS}
                />
            </g>
        </g>
    {/if}
</svg>

<style>
    .gipf-board {
        overflow: visible;
        user-select: none;
    }

    .play-area {
        fill: var(--gipf-play);
    }

    .lines line {
        stroke: var(--gipf-line);
        stroke-opacity: var(--gipf-line-opacity);
        stroke-width: 1.6;
    }

    .coordinate-label {
        fill: var(--gipf-label);
        font-size: 17px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
    }

    .dot {
        outline: none;
    }

    .dot-core {
        fill: var(--gipf-line);
    }

    .dot.entry {
        cursor: pointer;
    }

    .dot-hit {
        fill: transparent;
    }

    .dot-ring {
        fill: rgb(240 176 74 / 0.16);
        stroke: var(--gipf-target);
        stroke-width: 2;
        pointer-events: none;
    }

    .dot-ring.hovered {
        fill: rgb(240 176 74 / 0.3);
    }

    .dot-ring.chosen {
        fill: rgb(240 176 74 / 0.38);
        stroke-width: 3.5;
    }

    .piece {
        outline: none;
    }

    .row-mark {
        fill: none;
        stroke-width: 2.5;
        pointer-events: none;
    }

    .role-row {
        cursor: pointer;
    }

    .row-mark.role-row {
        stroke: var(--gipf-row);
        stroke-opacity: 0.55;
        stroke-dasharray: 5 4;
    }

    .role-removing {
        cursor: pointer;
    }

    /* Your own GIPF-piece's toggle: its crown ring, coloured for keep or take. */
    .crown-mark {
        fill: none;
        stroke-width: 3.5;
        pointer-events: none;
    }

    .crown-mark.role-removing {
        stroke: var(--gipf-row);
    }

    .crown-mark.role-keeping {
        stroke: var(--gipf-keep);
    }

    .mark-spot {
        stroke: rgb(0 0 0 / 0.35);
        stroke-width: 1;
        pointer-events: none;
    }

    .mark-spot.role-removing {
        fill: var(--gipf-row);
    }

    .mark-spot.role-keeping {
        fill: var(--gipf-keep);
    }

    .row-mark.role-removing {
        stroke: var(--gipf-row);
    }

    .role-keeping {
        cursor: pointer;
    }

    .row-mark.role-keeping {
        stroke: var(--gipf-keep);
    }

    .entering {
        pointer-events: none;
    }

    .target {
        cursor: pointer;
        outline: none;
    }

    .arrow {
        fill: none;
        stroke: var(--gipf-target);
        stroke-width: 3.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .target-ring {
        fill: rgb(240 176 74 / 0.14);
        stroke: var(--gipf-target);
        stroke-width: 2;
        stroke-dasharray: 5 4;
    }

    .target:hover .target-ring,
    .target:focus-visible .target-ring {
        fill: rgb(240 176 74 / 0.3);
        stroke-dasharray: none;
    }
</style>
