<script lang="ts">
    import { Color, type AxialCoordinates, type Point } from '@tabletop/common'
    import { CENTRE_SPACES, dotsOf, isCentre, SPACES, type PlacedPiece } from '@tabletop/punct'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import {
        coordsKey,
        HOLE_RADIUS,
        PIECE_THICKNESS,
        pointsAttribute,
        SPACING,
        VIEW
    } from '$lib/board/geometry.js'
    import { BOARD_LABELS, spaceLabel } from '$lib/board/coordinates.js'
    import { drawOrder } from '$lib/board/drawOrder.js'
    import { drawPiece, outlinePlan, pathOf, type Tone } from '$lib/board/pieceShape.js'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
    import PieceSlab from './PieceSlab.svelte'
    import PunctMarker from './PunctMarker.svelte'

    const session = getGameSession()
    const view = VIEW
    const frame = view.frame(BOARD_LABELS.map((label) => label.at))
    const animator = new BoardAnimator(session)

    // The printed board: a honeycomb cell round every hole, the pale area ending at the outer
    // cells' edges, the central hexagon's cells tinted.
    const cellPath = (coords: AxialCoordinates) =>
        `M ${pointsAttribute(view.cell(coords)).replaceAll(' ', ' L ')} Z`
    const gridPath = SPACES.map(cellPath).join(' ')
    const centrePath = CENTRE_SPACES.map(cellPath).join(' ')

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
        return drawOrder(pieces)
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
        return view.project(view.plan(coords), height * PIECE_THICKNESS)
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

    function shadowPath(piece: PlacedPiece): string {
        return pathOf(
            outlinePlan(piece.kind, animator.angleOf(piece), SPACING * 0.45).map((point) =>
                view.project(point, 0)
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
    <path d={gridPath} class="play-area"></path>
    <path d={centrePath} class="centre"></path>
    <path d={gridPath} class="grid"></path>

    {#if session.showCoordinates}
        {#each BOARD_LABELS as label (label.key)}
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
            class="hole"
            class:centre-hole={isCentre(coords)}
        ></ellipse>
        <path
            d="M {center.x - HOLE_RADIUS} {center.y} A {HOLE_RADIUS} {HOLE_RADIUS *
                view.tilt} 0 0 1 {center.x + HOLE_RADIUS} {center.y} A {HOLE_RADIUS} {HOLE_RADIUS *
                view.tilt *
                0.7} 0 0 0 {center.x - HOLE_RADIUS} {center.y} Z"
            class="hole-wall"
        ></path>
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
                    <path d={shadowPath(piece)} class="shadow"></path>
                    <PieceSlab
                        kind={piece.kind}
                        {angle}
                        tone={toneOf(piece.playerId)}
                        seed={piece.id}
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
        stroke-width: 1;
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

    .hole {
        fill: var(--punct-hole);
    }

    .hole-wall {
        fill: var(--punct-hole-wall);
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

    .win-spot {
        fill: var(--punct-win);
        stroke: rgb(0 0 0 / 0.6);
        stroke-width: 1.2;
        pointer-events: none;
    }
</style>
