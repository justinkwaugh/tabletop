<script lang="ts">
    import { Color, type AxialCoordinates, type Point } from '@tabletop/common'
    import { CENTRE_SPACES, dotsOf, isCentre, SPACES, type PlacedPiece } from '@tabletop/punct'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import {
        coordsKey,
        BOARD_DEPTH,
        HOLE_RADIUS,
        PIECE_HALF_WIDTH,
        PIECE_THICKNESS,
        SEAM,
        pointsAttribute,
        SPACING
    } from '$lib/board/geometry.js'
    import { boardLabels, spaceLabel } from '$lib/board/coordinates.js'
    import { drawOrder } from '$lib/board/drawOrder.js'
    import { drawPiece, outlinePlan, pathOf, type Tone } from '$lib/board/pieceShape.js'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
    import PieceDefs from './PieceDefs.svelte'
    import PieceSlab from './PieceSlab.svelte'
    import PunctMarker from './PunctMarker.svelte'

    const session = getGameSession()
    const view = $derived(session.view)
    const labels = $derived(boardLabels(view))
    const frame = $derived(view.frame(labels.map((label) => label.at)))
    const animator = new BoardAnimator(session)

    // The printed board: a honeycomb cell round every hole, the pale area ending at the outer
    // cells' edges, the central hexagon's cells tinted.
    const cellPath = (coords: AxialCoordinates) =>
        `M ${pointsAttribute(view.cell(coords)).replaceAll(' ', ' L ')} Z`
    const gridPath = $derived(SPACES.map(cellPath).join(' '))
    const centrePath = $derived(CENTRE_SPACES.map(cellPath).join(' '))
    const plateSides = $derived(view.plateSides())

    function plateSideFill(light: number): string {
        const lit = [178, 192, 182]
        const shaded = [104, 116, 108]
        const [r, g, b] = lit.map((value, index) =>
            Math.round(shaded[index] + (value - shaded[index]) * light)
        )
        return `rgb(${r} ${g} ${b})`
    }

    // As large as fits inside the piece at the near right of its PÜNCT, over the dish's rim.
    const BADGE_RADIUS = PIECE_HALF_WIDTH * 0.42
    const BADGE_OFFSET = { x: PIECE_HALF_WIDTH * 0.5, y: PIECE_HALF_WIDTH * 0.3 }

    function toneOf(playerId: string): Tone {
        return session.gameState.getPlayerState(playerId).color === Color.White ? 'light' : 'dark'
    }

    // Where a piece standing on a level puts its PÜNCT on screen.
    function anchor(punct: AxialCoordinates, level: number): Point {
        return view.project(view.plan(punct), view.levelBase(level))
    }

    type Drawn =
        | {
              kind: 'piece'
              key: string
              cells: AxialCoordinates[]
              level: number
              piece: PlacedPiece
              staged: boolean
          }
        | {
              kind: 'marker'
              key: string
              cells: AxialCoordinates[]
              level: number
              playerId: string
          }

    const staged = $derived(session.staged)
    const movingId = $derived(staged?.from !== undefined ? staged.id : undefined)

    const drawn: Drawn[] = $derived.by(() => {
        const pieces: Drawn[] = animator.pieces
            .filter((piece) => piece.id !== movingId && piece.id !== animator.flier?.piece.id)
            .map((piece) => ({
                kind: 'piece',
                key: `piece-${piece.id}`,
                cells: dotsOf(piece.kind, piece.punct, piece.rotation),
                level: piece.level,
                piece,
                staged: false
            }))
        // A new piece you placed stands staged until the state it made lands with it.
        const landed = staged && animator.pieces.some((piece) => piece.id === staged.id)
        if (staged && !(landed && staged.from === undefined)) {
            const piece: PlacedPiece = {
                id: staged.id,
                playerId: staged.playerId,
                kind: staged.kind,
                punct: staged.punct,
                rotation: staged.rotation,
                level: staged.level
            }
            pieces.push({
                kind: 'piece',
                key: `piece-${staged.id}`,
                cells: dotsOf(staged.kind, staged.punct, staged.rotation),
                level: staged.level,
                piece,
                staged: true
            })
            if (staged.from) {
                pieces.push({
                    kind: 'marker',
                    key: 'marker',
                    cells: [staged.from],
                    level: session.gameState.board.heightAt(staged.from, staged.id),
                    playerId: staged.playerId
                })
            }
        }
        return drawOrder(pieces, view.turned)
    })

    // The board without the piece being moved: where marks for its PÜNCT lie.
    const destinationMarks = $derived.by(() => {
        const piece = session.chosenPiece
        if (piece === undefined || session.chosenAt !== undefined) return []
        return session.destinations.map((coords) => {
            const top = session.gameState.board.topAt(coords, piece.id)
            return {
                coords,
                onPieceId: top?.piece.id,
                height: session.gameState.board.heightAt(coords, piece.id)
            }
        })
    })

    const chosenPieceCells = $derived(
        session.chosenPiece
            ? dotsOf(
                  session.chosenPiece.kind,
                  session.chosenPiece.punct,
                  session.chosenPiece.rotation
              )
            : []
    )

    // Where a mark lies on a space's top surface, on screen.
    function surface(coords: AxialCoordinates, height: number): Point {
        return view.project(view.plan(coords), view.surface(height))
    }

    // The connection that won, marked on its spaces' top dots.
    const connection = $derived(session.winningConnection)

    function topHeight(coords: AxialCoordinates): number {
        return session.gameState.board.heightAt(coords)
    }

    function roleOf(entry: Drawn): 'staged' | 'chosen' | 'movable' | undefined {
        if (entry.kind !== 'piece') return undefined
        if (entry.staged) return 'staged'
        if (session.chosenPiece?.id === entry.piece.id) return 'chosen'
        return session.movablePieces.some((piece) => piece.id === entry.piece.id)
            ? 'movable'
            : undefined
    }

    function chooseDrawn(entry: Drawn) {
        if (entry.kind !== 'piece') return
        if (entry.staged) {
            session.turnStaged()
            return
        }
        session.choosePiece(entry.piece)
    }

    // A tap on nothing you can choose lets go of what is chosen.
    function onBoardClick(event: MouseEvent) {
        const target = event.target
        const choosable = '[role="button"]:not([aria-disabled="true"])'
        if (target instanceof Element && target.closest(choosable)) return
        session.letGo()
    }

    function onKey(event: KeyboardEvent, act: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            act()
        }
    }

    // Once a piece is chosen, the others you could move fade.
    const chosen = $derived(session.chosenPiece !== undefined || session.chosenAt !== undefined)

    // Each piece's shadow at its feet. On the board it is soft; on a piece it falls on that
    // piece's top, across the seam between them, as a dark crease that parts the levels.
    function shadowPath(piece: PlacedPiece): string {
        const below = piece.level > 0 ? -SEAM : 0
        const width = piece.level > 0 ? PIECE_HALF_WIDTH + 0.6 : SPACING * 0.45
        return pathOf(
            outlinePlan(piece.kind, animator.angleOf(piece), width).map((point) =>
                view.project(point, below)
            )
        )
    }

    function relative(cell: AxialCoordinates, punct: AxialCoordinates, height: number): Point {
        const a = view.plan(cell)
        const b = view.plan(punct)
        return view.project({ x: a.x - b.x, y: a.y - b.y }, height)
    }
</script>

<!-- Tapping off the choices is a shortcut for pointers; Undo lets go from the keyboard. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
    class="punct-board"
    viewBox={frame.viewBox}
    width={frame.width}
    height={frame.height}
    role="group"
    aria-label="PÜNCT board"
    onclick={onBoardClick}
    {@attach animator.attach}
>
    <defs>
        <PieceDefs prefix="punct-board" />
        <!-- Seen through each hole: its far wall, in shade under the plate's top, and below it the
             base, lit in the middle. -->
        <linearGradient id="punct-hole-wall" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="var(--punct-hole-wall-top)"></stop>
            <stop offset="0.6" stop-color="var(--punct-hole-wall-bottom)"></stop>
        </linearGradient>
        <radialGradient id="punct-hole-floor" cy="0.6">
            <stop offset="0.3" stop-color="var(--punct-hole-floor)"></stop>
            <stop offset="1" stop-color="var(--punct-hole-floor-edge)"></stop>
        </radialGradient>
        <clipPath id="punct-holes">
            {#each SPACES as coords (coordsKey(coords))}
                {@const center = view.center(coords)}
                <ellipse cx={center.x} cy={center.y} rx={HOLE_RADIUS} ry={HOLE_RADIUS * view.tilt}
                ></ellipse>
            {/each}
        </clipPath>
    </defs>

    <!-- The plate: its shadow on the table, its edge where it faces you, then its top. -->
    <path d={gridPath} class="plate-shadow" transform="translate(3 {view.height(BOARD_DEPTH) + 3})"
    ></path>
    {#each plateSides as side, index (index)}
        <polygon points={pointsAttribute(side.points)} fill={plateSideFill(side.light)}></polygon>
    {/each}
    <path d={gridPath} class="play-area"></path>
    <path d={centrePath} class="centre"></path>
    <path d={gridPath} class="grid"></path>

    {#if session.showCoordinates}
        {#each labels as label (label.key)}
            <text x={label.at.x} y={label.at.y} class="coordinate-label">{label.text}</text>
        {/each}
    {/if}

    {#each SPACES as coords (coordsKey(coords))}
        {@const center = view.center(coords)}
        {@const choosable = session.isChoosableSpace(coords) && topHeight(coords) === 0}
        <ellipse
            cx={center.x}
            cy={center.y}
            rx={HOLE_RADIUS}
            ry={HOLE_RADIUS * view.tilt}
            fill="url(#punct-hole-wall)"
        ></ellipse>
        <polygon
            points={pointsAttribute(view.cell(coords))}
            class="cell"
            class:choosable
            role="button"
            tabindex={choosable ? 0 : -1}
            aria-disabled={!choosable}
            aria-label="space {spaceLabel(coords)}"
            onclick={() => choosable && session.chooseSpace(coords)}
            onkeydown={(event) => choosable && onKey(event, () => session.chooseSpace(coords))}
        ></polygon>
    {/each}

    <!-- The base below each hole, as deep down as the plate is thick, seen through the hole. -->
    <g clip-path="url(#punct-holes)" class="hole-floors">
        {#each SPACES as coords (coordsKey(coords))}
            {@const center = view.center(coords)}
            <ellipse
                cx={center.x}
                cy={center.y + view.height(BOARD_DEPTH)}
                rx={HOLE_RADIUS}
                ry={HOLE_RADIUS * view.tilt}
                fill="url(#punct-hole-floor)"
            ></ellipse>
        {/each}
    </g>

    <!-- Marks for the chosen piece's PÜNCT on empty spaces lie on the board, under the pieces. -->
    <g {@attach animator.marks()}>
        {#each destinationMarks.filter((mark) => mark.onPieceId === undefined && !includesCoords(chosenPieceCells, mark.coords)) as mark (coordsKey(mark.coords))}
            {@const center = view.center(mark.coords)}
            <g class="target-ring">
                {#each ['under', 'over'] as layer (layer)}
                    <ellipse
                        cx={center.x}
                        cy={center.y}
                        rx={HOLE_RADIUS + 3}
                        ry={(HOLE_RADIUS + 3) * view.tilt}
                        class={layer}
                    ></ellipse>
                {/each}
            </g>
        {/each}
    </g>

    {#each drawn as entry (entry.key)}
        {#if entry.kind === 'marker'}
            {@const at = anchor(entry.cells[0], entry.level)}
            <g transform="translate({at.x} {at.y})" class="marker">
                <PunctMarker tone={toneOf(entry.playerId)} />
            </g>
        {:else}
            {@const piece = entry.piece}
            {@const role = roleOf(entry)}
            {@const at = anchor(piece.punct, piece.level)}
            {@const angle = animator.angleOf(piece)}
            {@const drawing = drawPiece(piece.kind, angle, view)}
            <g
                transform="translate({at.x} {at.y})"
                class="piece-place role-{role ?? 'none'}"
                role="button"
                tabindex={role ? 0 : -1}
                aria-disabled={!role}
                aria-label="piece at {spaceLabel(piece.punct)}"
                onclick={() => role && chooseDrawn(entry)}
                onkeydown={(event) => role && onKey(event, () => chooseDrawn(entry))}
            >
                <g {@attach animator.pieceNode(piece.id)}>
                    <path
                        d={shadowPath(piece)}
                        class="shadow"
                        class:crease={piece.level > 0}
                        class:dark={toneOf(piece.playerId) === 'dark'}
                    ></path>
                    <PieceSlab
                        kind={piece.kind}
                        {angle}
                        tone={toneOf(piece.playerId)}
                        seed={piece.id}
                        prefix="punct-board"
                        {view}
                    />
                </g>
                <g {@attach animator.marks()}>
                    {#if role}
                        {#each ['under', 'over'] as layer (layer)}
                            <path
                                d={pathOf(drawing.topOutline)}
                                class="top-ring role-{role} {layer}"
                                class:faded={chosen && role === 'movable'}
                            ></path>
                        {/each}
                    {/if}
                    {#each destinationMarks.filter((mark) => mark.onPieceId === piece.id) as mark (coordsKey(mark.coords))}
                        {@const spot = relative(mark.coords, piece.punct, PIECE_THICKNESS)}
                        <g class="target-ring">
                            {#each ['under', 'over'] as layer (layer)}
                                <ellipse
                                    cx={spot.x}
                                    cy={spot.y}
                                    rx={HOLE_RADIUS}
                                    ry={HOLE_RADIUS * view.tilt}
                                    class={layer}
                                ></ellipse>
                            {/each}
                        </g>
                    {/each}
                    {#if connection}
                        {#each dotsOf(piece.kind, piece.punct, piece.rotation).filter((cell) => includesCoords(connection, cell) && session.gameState.board.topAt(cell)?.piece.id === piece.id) as cell (coordsKey(cell))}
                            {@const spot = relative(cell, piece.punct, PIECE_THICKNESS)}
                            <ellipse
                                cx={spot.x}
                                cy={spot.y}
                                rx={SPACING * 0.1}
                                ry={SPACING * 0.1 * view.tilt}
                                class="win-spot"
                            ></ellipse>
                        {/each}
                    {/if}
                </g>
                {#if session.showLevels && piece.level > 0}
                    {@const badge = view.project(BADGE_OFFSET, PIECE_THICKNESS)}
                    <!-- Over the piece's marks, moving with the piece. -->
                    <g {@attach animator.pieceNode(piece.id)}>
                        <!-- The level, on a badge at the near right of the PÜNCT, as TZAAR's
                             counts: set ten times larger and scaled down, as small text is
                             snapped to whole pixels. -->
                        <g transform="translate({badge.x} {badge.y})" class="level-badge">
                            <circle r={BADGE_RADIUS}></circle>
                            <text transform="scale(0.1)" font-size={BADGE_RADIUS * 13.7} dy="0.36em"
                                >{piece.level + 1}</text
                            >
                        </g>
                    </g>
                {/if}
            </g>
        {/if}
    {/each}

    {#if animator.flier}
        {@const flier = animator.flier}
        {@const at = view.project(flier.plan, flier.height)}
        <g transform="translate({at.x} {at.y})" class="flier">
            <path
                d={shadowPath(flier.piece)}
                class="shadow"
                transform="translate(0 {view.height(flier.height - flier.groundHeight)})"
            ></path>
            <PieceSlab
                kind={flier.piece.kind}
                angle={flier.angle}
                tone={toneOf(flier.piece.playerId)}
                seed={flier.piece.id}
                prefix="punct-board"
                {view}
            />
        </g>
    {/if}

    <!-- Click areas for the chosen piece's PÜNCT on top of pieces, or under the piece itself,
         stand above everything, nearer ones last. -->
    <g {@attach animator.marks()}>
        {#each destinationMarks
            .filter((mark) => mark.onPieceId !== undefined || includesCoords(chosenPieceCells, mark.coords))
            .toSorted((a, b) => view.center(a.coords).y - view.center(b.coords).y) as mark (coordsKey(mark.coords))}
            {@const spot = surface(mark.coords, mark.height)}
            {#if mark.onPieceId === undefined}
                <g class="target-ring">
                    {#each ['under', 'over'] as layer (layer)}
                        <ellipse
                            cx={spot.x}
                            cy={spot.y}
                            rx={HOLE_RADIUS + 3}
                            ry={(HOLE_RADIUS + 3) * view.tilt}
                            class={layer}
                        ></ellipse>
                    {/each}
                </g>
            {/if}
            <ellipse
                cx={spot.x}
                cy={spot.y}
                rx={SPACING * 0.42}
                ry={SPACING * 0.42 * view.tilt}
                class="target-hit"
                role="button"
                tabindex="0"
                aria-label="move to {spaceLabel(mark.coords)}"
                onclick={() => session.chooseSpace(mark.coords)}
                onkeydown={(event) => onKey(event, () => session.chooseSpace(mark.coords))}
            ></ellipse>
        {/each}
    </g>
</svg>

<style>
    .punct-board {
        overflow: visible;
        user-select: none;
    }

    .play-area {
        fill: var(--punct-play);
        stroke: var(--punct-play);
        stroke-width: 1;
    }

    .centre {
        fill: var(--punct-centre);
    }

    .grid {
        fill: none;
        stroke: var(--punct-grid);
        stroke-width: 0.8;
    }

    .coordinate-label {
        fill: var(--punct-label);
        font-size: 25px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
    }

    .plate-shadow {
        fill: rgb(20 40 28 / 0.22);
    }

    .hole-floors {
        pointer-events: none;
    }

    .cell {
        fill: transparent;
        outline: none;
    }

    .cell.choosable {
        cursor: pointer;
    }

    .piece-place {
        outline: none;
    }

    .piece-place:not(.role-none) {
        cursor: pointer;
    }

    .shadow.crease {
        fill: rgb(30 34 40 / 0.62);
        stroke: none;
    }

    .shadow.crease.dark {
        fill: rgb(0 0 0 / 0.9);
    }

    .shadow {
        fill: rgb(20 30 25 / 0.28);
        stroke: rgb(20 30 25 / 0.12);
        stroke-width: 3;
        pointer-events: none;
    }

    .marker,
    .flier {
        pointer-events: none;
    }

    /* Choice marks are two-tone, as in every title: a dark band under a cyan core. */
    .under {
        stroke: rgb(0 0 0 / 0.8);
    }

    .top-ring {
        fill: none;
        stroke-linejoin: round;
        pointer-events: none;
    }

    .top-ring.under {
        stroke-width: 4.3;
    }

    .top-ring.over {
        stroke: var(--punct-mark);
        stroke-width: 2.5;
    }

    .top-ring.role-chosen.under,
    .top-ring.role-staged.under {
        stroke-width: 5.3;
    }

    .top-ring.role-chosen.over,
    .top-ring.role-staged.over {
        stroke-width: 3.5;
    }

    .top-ring.faded {
        opacity: 0.4;
    }

    .target-ring {
        pointer-events: none;
    }

    .target-ring .under {
        fill: rgb(94 240 255 / 0.14);
        stroke: #000;
        stroke-width: 3.8;
        stroke-dasharray: 3 6;
        stroke-dashoffset: -1;
        stroke-linecap: square;
    }

    .target-ring .over {
        fill: none;
        stroke: var(--punct-mark);
        stroke-width: 2;
        stroke-dasharray: 5 4;
    }

    .target-hit {
        fill: transparent;
        cursor: pointer;
        outline: none;
    }

    .level-badge {
        pointer-events: none;
    }

    .level-badge circle {
        fill: #ffffff;
        stroke: #000000;
        stroke-width: 1.2;
    }

    .level-badge text {
        fill: #000000;
        font-weight: 700;
        text-anchor: middle;
        font-variant-numeric: tabular-nums;
    }

    .win-spot {
        fill: var(--punct-win);
        stroke: rgb(0 0 0 / 0.6);
        stroke-width: 1.2;
        pointer-events: none;
    }
</style>
