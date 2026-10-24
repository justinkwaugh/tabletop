<script lang="ts">
    import { addAxial, sameCoordinates, scaleAxial, type AxialCoordinates } from '@tabletop/common'
    import { ALL_POINTS, AXES, DOTS, SPOTS, type RemovedPiece } from '@tabletop/gipf'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import { coordsKey, CROWN_SCALE, DOT_RADIUS, PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import PieceDefs from './PieceDefs.svelte'
    import StandingPiece from './StandingPiece.svelte'
    import StagedPiece from './StagedPiece.svelte'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'

    const session = getGameSession()

    const view = VIEW
    const frame = view.frame()
    const playArea = view.playAreaOutline()
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
                return crossesPlay ? [{ from: view.center(start), to: view.center(end) }] : []
            }
        )
    )

    const animator = new BoardAnimator(session)
    let hoveredDot: string | undefined = $state()
    let hoveredTarget: string | undefined = $state()
    const pieces = $derived(animator.pieces)

    // The piece you are about to bring in drops onto the dot you chose, until it goes in. A piece
    // Undo took back out stands there already.
    const preview = $derived.by(() => {
        if (animator.entering || animator.pushedIn) return undefined
        if (animator.returned) return { ...animator.returned, drops: false }
        const dot = session.chosenDot
        const gipf = session.chosenGipf
        const playerId = session.myPlayer?.id
        if (dot === undefined || gipf === undefined || playerId === undefined) return undefined
        return { dot, gipf, playerId, drops: true }
    })

    type Drawn =
        | { kind: 'piece'; key: string; coords: AxialCoordinates; piece: RemovedPiece }
        | {
              kind: 'entering' | 'preview'
              key: string
              coords: AxialCoordinates
              gipf: boolean
              playerId: string
              drops: boolean
          }

    // Far pieces first, so nearer pieces stand in front of them. The piece coming in is drawn at
    // its dot's depth: the line it pushes moves with it, so the order holds as it slides.
    const drawOrder: Drawn[] = $derived.by(() => {
        const drawn: Drawn[] = pieces.map((piece) => ({
            kind: 'piece',
            key: coordsKey(piece.coords),
            coords: piece.coords,
            piece
        }))
        const incoming = animator.entering ?? preview
        if (incoming) {
            drawn.push({
                kind: animator.entering ? 'entering' : 'preview',
                // Another piece type chosen on the same dot drops in afresh.
                key: `incoming-${coordsKey(incoming.dot)}-${incoming.gipf}`,
                coords: incoming.dot,
                gipf: incoming.gipf,
                playerId: incoming.playerId,
                drops: preview?.drops ?? false
            })
        }
        return drawn.toSorted((a, b) => view.center(a.coords).y - view.center(b.coords).y)
    })

    const SPOT_RADIUS = PIECE_RADIUS * 0.28

    function colorOf(playerId: string) {
        return session.gameState.getPlayerState(playerId).color
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

    // Arrows lie on the board, from the dot to the edge of the ring around the first spot, so
    // they are laid out flat and then seen at the tilt.
    function arrow(from: AxialCoordinates, to: AxialCoordinates): string {
        const start = view.center(from)
        const end = view.center(to)
        const flat = (x: number, y: number) => `${x} ${y * view.tilt}`
        const [sx, sy, ex, ey] = [start.x, start.y / view.tilt, end.x, end.y / view.tilt]
        const length = Math.hypot(ex - sx, ey - sy)
        const ux = (ex - sx) / length
        const uy = (ey - sy) / length
        const tipX = ex - ux * (PIECE_RADIUS + 2)
        const tipY = ey - uy * (PIECE_RADIUS + 2)
        const baseX = sx + ux * DOT_RADIUS * 2
        const baseY = sy + uy * DOT_RADIUS * 2
        const wing = 8
        return `M ${flat(baseX, baseY)} L ${flat(tipX, tipY)} M ${flat(tipX - ux * wing - uy * wing, tipY - uy * wing + ux * wing)} L ${flat(tipX, tipY)} L ${flat(tipX - ux * wing + uy * wing, tipY - uy * wing - ux * wing)}`
    }

    // Everything a GIPF-piece standing on a spot would cover, for clicks on a target there.
    const standingOutline = (() => {
        const r = PIECE_RADIUS
        const ry = r * view.tilt
        const top = view.topFace(true)
        return `M ${-r} ${top} A ${r} ${ry} 0 0 1 ${r} ${top} L ${r} 0 A ${r} ${ry} 0 0 1 ${-r} 0 Z`
    })()
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
        <PieceDefs prefix="gipf-board" />
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
        {@const center = view.center(coords)}
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
                <ellipse rx={DOT_RADIUS * 2.4} ry={DOT_RADIUS * 2.4 * view.tilt} class="dot-hit"
                ></ellipse>
            {/if}
            <ellipse rx={DOT_RADIUS} ry={DOT_RADIUS * view.tilt} class="dot-core"></ellipse>
        </g>
    {/each}

    <!-- Rings on the board: round the dots you can bring a piece in from, and round the spots
         you can push into, behind whatever stands there. -->
    <g {@attach animator.marks()}>
        {#each session.entryDots as coords (coordsKey(coords))}
            {@const center = view.center(coords)}
            <ellipse
                cx={center.x}
                cy={center.y}
                rx={DOT_RADIUS * 2.4}
                ry={DOT_RADIUS * 2.4 * view.tilt}
                class="dot-ring"
                class:chosen={isChosenDot(coords)}
                class:hovered={hoveredDot === coordsKey(coords)}
            ></ellipse>
        {/each}
        {#each session.targets as entry (coordsKey(entry.line[0]))}
            {@const center = view.center(entry.line[0])}
            <ellipse
                cx={center.x}
                cy={center.y}
                rx={PIECE_RADIUS + 2}
                ry={(PIECE_RADIUS + 2) * view.tilt}
                class="target-ring"
                class:hovered={hoveredTarget === coordsKey(entry.line[0])}
            ></ellipse>
        {/each}
    </g>

    {#each drawOrder as drawn (drawn.key)}
        {@const center = view.center(drawn.coords)}
        {#if drawn.kind === 'piece'}
            {@const piece = drawn.piece}
            {@const role = rowRole(piece.coords)}
            {@const faceY = view.topFace(piece.gipf)}
            <g
                transform="translate({center.x} {center.y})"
                class="piece role-{role ?? 'none'}"
                role="button"
                tabindex={role ? 0 : -1}
                aria-disabled={!role}
                aria-label="{piece.gipf ? 'GIPF-piece' : 'piece'} {session.notation.name(
                    piece.coords
                )}"
                onclick={() => role && choosePiece(piece.coords)}
                onkeydown={(event) => role && onKey(event, () => choosePiece(piece.coords))}
            >
                <g {@attach animator.piece(drawn.key)}>
                    <StandingPiece
                        color={colorOf(piece.playerId)}
                        gipf={piece.gipf}
                        body={animator.body(drawn.key)}
                        shadow={animator.shadow(drawn.key)}
                    />
                </g>
                <!-- Marks lie on the top face, after the piece and outside the node that moves
                     it: a dashed ring for a row you can choose, a spot on each piece that goes,
                     and on your own GIPF-pieces the crown ring coloured for keep or take. -->
                {#if role}
                    <g {@attach animator.marks()}>
                        {#if role === 'row'}
                            <ellipse
                                cy={faceY}
                                rx={PIECE_RADIUS - 3}
                                ry={(PIECE_RADIUS - 3) * view.tilt}
                                class="row-mark role-row"
                            ></ellipse>
                        {:else}
                            {#if includesCoords(session.rowGipfPieces, piece.coords)}
                                <ellipse
                                    cy={faceY}
                                    rx={PIECE_RADIUS * CROWN_SCALE}
                                    ry={PIECE_RADIUS * CROWN_SCALE * view.tilt}
                                    class="crown-mark role-{role}"
                                ></ellipse>
                            {/if}
                            <ellipse
                                cy={faceY}
                                rx={SPOT_RADIUS}
                                ry={SPOT_RADIUS * view.tilt}
                                class="mark-spot role-{role}"
                            ></ellipse>
                        {/if}
                    </g>
                {/if}
            </g>
        {:else if drawn.kind === 'entering'}
            <g transform="translate({center.x} {center.y})" class="entering">
                <g {@attach animator.enteringPiece()}>
                    <StandingPiece
                        color={colorOf(drawn.playerId)}
                        gipf={drawn.gipf}
                        shadow={animator.enteringShadow()}
                        parts={animator.enteringParts}
                    />
                </g>
            </g>
        {:else}
            <g transform="translate({center.x} {center.y})" class="entering">
                <StagedPiece
                    color={colorOf(drawn.playerId)}
                    gipf={drawn.gipf}
                    drops={drawn.drops}
                    lifts={() => animator.entering === undefined && !animator.pushedIn}
                />
            </g>
        {/if}
    {/each}

    <!-- Arrows and the targets' click areas stand above the pieces. -->
    <g {@attach animator.marks()}>
        {#each session.targets as entry (coordsKey(entry.line[0]))}
            {@const center = view.center(entry.line[0])}
            {@const key = coordsKey(entry.line[0])}
            <g
                class="target"
                role="button"
                tabindex="0"
                aria-label="push to {session.notation.name(entry.line[0])}"
                onclick={() => session.push(entry.line[0])}
                onkeydown={(event) => onKey(event, () => session.push(entry.line[0]))}
                onpointerenter={() => (hoveredTarget = key)}
                onpointerleave={() => (hoveredTarget = undefined)}
                onfocus={() => (hoveredTarget = key)}
                onblur={() => (hoveredTarget = undefined)}
            >
                <path
                    d={standingOutline}
                    transform="translate({center.x} {center.y})"
                    class="target-hit"
                ></path>
                <path d={arrow(entry.dot, entry.line[0])} class="arrow"></path>
            </g>
        {/each}
    </g>
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

    /* A piece with nothing to choose lets clicks through to the dot or target behind it. */
    .piece.role-none {
        pointer-events: none;
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
        pointer-events: none;
    }

    .target-ring.hovered {
        fill: rgb(240 176 74 / 0.3);
        stroke-dasharray: none;
    }

    .target-hit {
        fill: transparent;
    }
</style>
