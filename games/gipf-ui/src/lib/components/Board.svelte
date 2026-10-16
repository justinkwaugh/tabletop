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
    import { pieceDiscs, pieceExtent } from '$lib/board/pieceGeometry.js'

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

    const pieces = $derived(session.gameState.board.pieces())

    const RING_GAP = 1.5
    const OPTIONAL_GAP = 5
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
        >
            {#if entry}
                <circle r={DOT_RADIUS * 2.4} class="dot-ring"></circle>
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
            <PieceShape color={colorOf(piece)} gipf={piece.gipf} radius={PIECE_RADIUS} />
        </g>
    {/each}

    <!-- Marks sit above every piece: a spot on each piece that must go, and a roomier ring on each
         GIPF-piece you can keep or take, drawn last so it stays whole. -->
    {#each markedPieces as piece (coordsKey(piece.coords))}
        {@const center = pointCenter(piece.coords)}
        {@const role = rowRole(piece.coords)}
        {@const optional = includesCoords(session.rowGipfPieces, piece.coords)}
        {@const discs = pieceDiscs(piece.gipf, PIECE_RADIUS)}
        {@const faceY = center.y + discs[discs.length - 1].faceY}
        {#if optional}
            <circle
                cx={center.x}
                cy={center.y}
                r={pieceExtent(piece.gipf, PIECE_RADIUS) + OPTIONAL_GAP}
                class="row-mark optional role-{role}"
            ></circle>
        {/if}
        {#if role === 'row'}
            <circle
                cx={center.x}
                cy={center.y}
                r={pieceExtent(piece.gipf, PIECE_RADIUS) + RING_GAP}
                class="row-mark role-row"
            ></circle>
        {:else}
            <circle cx={center.x} cy={faceY} r={SPOT_RADIUS} class="mark-spot role-{role}"></circle>
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
            <circle cx={center.x} cy={center.y} r={PIECE_RADIUS + 2} class="target-ring"></circle>
        </g>
    {/each}
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

    .dot-ring {
        fill: rgb(240 176 74 / 0.16);
        stroke: var(--gipf-target);
        stroke-width: 2;
    }

    .dot.entry:hover .dot-ring,
    .dot.entry:focus-visible .dot-ring {
        fill: rgb(240 176 74 / 0.3);
    }

    .dot.chosen .dot-ring {
        fill: rgb(240 176 74 / 0.38);
        stroke-width: 3.5;
    }

    .dot.chosen .dot-core {
        fill: var(--gipf-target);
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

    .row-mark.optional {
        stroke-width: 4;
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
