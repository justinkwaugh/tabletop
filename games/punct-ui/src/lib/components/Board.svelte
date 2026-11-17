<script lang="ts">
    import { Color, type AxialCoordinates } from '@tabletop/common'
    import { CENTRE_SPACES, SPACES, spaceKey, type PlacedPiece } from '@tabletop/punct'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { Hover } from '$lib/animators/stagedMotion.svelte.js'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
    import { BOARD_DEPTH, HOLE_RADIUS, pointsAttribute, SPACING } from '$lib/board/geometry.js'
    import { boardLabels, LABEL_FONT_SIZE, spaceLabel } from '$lib/board/coordinates.js'
    import { sceneOrder } from '$lib/board/drawOrder.js'
    import {
        anchorOf,
        BADGE_FONT_SIZE,
        BADGE_RADIUS,
        BADGE_TEXT_SCALE,
        badgeAt,
        CENTRED_BASELINE,
        onTopOf,
        plateSideFill,
        shadowPath
    } from '$lib/board/drawing.js'
    import { destinationMarks, winningDots } from '$lib/board/marks.js'
    import { holeBox, holeUrl } from '$lib/board/looks.js'
    import { drawPiece, pathOf, silhouetteOf, type Tone } from '$lib/board/pieceShape.js'
    import PieceDefs from './PieceDefs.svelte'
    import PieceSlab from './PieceSlab.svelte'
    import MovingPiece from './MovingPiece.svelte'
    import PunctMarker from './PunctMarker.svelte'

    const session = getGameSession()
    const view = $derived(session.view)
    const labels = $derived(boardLabels(view))
    const frame = $derived(view.frame(labels.map((label) => label.at)))
    const animator = new BoardAnimator(session)

    // The printed board: the pale area a honeycomb cell round every hole, the central hexagon's
    // cells tinted; lines from hole to hole.
    const cellPath = (coords: AxialCoordinates) =>
        `M ${pointsAttribute(view.cell(coords)).replaceAll(' ', ' L ')} Z`
    const gridPath = $derived(SPACES.map(cellPath).join(' '))
    const centrePath = $derived(CENTRE_SPACES.map(cellPath).join(' '))
    const gridLines = $derived(view.gridLines())
    const plateSides = $derived(view.plateSides())
    const holes = $derived(SPACES.map((coords) => view.center(coords)))
    const hole = { href: holeUrl(), ...holeBox() }

    const hover = $derived(animator.staged.hover)
    // The draw order is worked out again only when the hover's place in it changes, never at each
    // frame of its motion.
    const hoverPiece = $derived(hover?.piece)
    const hoverCells = $derived(hover?.cells)
    const hoverAloft = $derived(hover?.aloft ?? false)
    const hidden = $derived(
        new Set([
            ...(hoverPiece ? [hoverPiece.id] : []),
            ...animator.fliers.map((flier) => flier.piece.id)
        ])
    )
    const marker = $derived.by(() => {
        const staged = session.staged
        if (staged?.from === undefined || hoverPiece === undefined) return undefined
        return {
            at: staged.from,
            level: session.gameState.board.heightAt(staged.from, staged.id),
            playerId: staged.playerId
        }
    })
    const drawn = $derived(
        sceneOrder(
            {
                pieces: animator.pieces,
                hidden,
                hover: hoverPiece &&
                    hoverCells && { piece: hoverPiece, cells: hoverCells, aloft: hoverAloft },
                marker
            },
            view
        )
    )

    const marks = $derived(
        destinationMarks(
            session.gameState.board,
            session.chosenPiece,
            session.destinations,
            session.stagedCells,
            view
        )
    )
    // Once a space is chosen, the other destinations dim; once a piece is, the other movable ones.
    const destinationsDimmed = $derived(session.chosenAt !== undefined)
    const chosen = $derived(session.chosenPiece !== undefined || session.chosenAt !== undefined)
    const connection = $derived(session.winningConnection)
    const emptyChoices = $derived(
        SPACES.filter(
            (coords) =>
                session.isChoosableSpace(coords) && session.gameState.board.heightAt(coords) === 0
        )
    )

    function toneOf(playerId: string): Tone {
        return session.gameState.getPlayerState(playerId).color === Color.White ? 'light' : 'dark'
    }

    function roleOf(piece: PlacedPiece): 'chosen' | 'movable' | undefined {
        if (session.chosenPiece?.id === piece.id) return 'chosen'
        return session.movablePieces.some((movable) => movable.id === piece.id)
            ? 'movable'
            : undefined
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
</script>

<!-- Tapping off the choices is a shortcut for pointers; Undo lets go from the keyboard. -->
<div class="tap-off" role="presentation" onclick={onBoardClick}>
    <svg
        class="punct-board"
        viewBox={frame.viewBox}
        width={frame.width}
        height={frame.height}
        role="group"
        aria-label="PÜNCT board"
        {@attach animator.attach}
    >
        <defs>
            <PieceDefs prefix="punct-board" />
        </defs>

        <!-- The plate: its shadow on the table, its edge where it faces you, then its top. -->
        <path
            d={gridPath}
            class="plate-shadow"
            transform="translate(3 {view.height(BOARD_DEPTH) + 3})"
        ></path>
        {#each plateSides as side, index (index)}
            <polygon points={pointsAttribute(side.points)} fill={plateSideFill(side.light)}
            ></polygon>
        {/each}
        <path d={gridPath} class="play-area"></path>
        <path d={centrePath} class="centre"></path>
        <path d={gridLines} class="grid"></path>

        {#if session.showCoordinates}
            {#each labels as label (label.key)}
                <text
                    x={label.at.x}
                    y={label.at.y}
                    dy={LABEL_FONT_SIZE * CENTRED_BASELINE}
                    font-size={LABEL_FONT_SIZE}
                    class="coordinate-label">{label.text}</text
                >
            {/each}
        {/if}

        <!-- The holes, cut through to the base below. -->
        {#each holes as center, index (index)}
            <image
                href={hole.href}
                x={center.x + hole.x}
                y={center.y + hole.y}
                width={hole.width}
                height={hole.height}
                class="hole"
            ></image>
        {/each}

        <!-- Spaces you can choose; a tap anywhere else on the board lets go. -->
        {#each emptyChoices as coords (spaceKey(coords))}
            <polygon
                points={pointsAttribute(view.cell(coords))}
                class="cell"
                role="button"
                tabindex="0"
                aria-label="space {spaceLabel(coords)}"
                onclick={() => session.chooseSpace(coords)}
                onkeydown={(event) => onKey(event, () => session.chooseSpace(coords))}
            ></polygon>
        {/each}

        <!-- Marks for the chosen piece's PÜNCT on empty spaces lie on the board, under the pieces. -->
        {#each marks.onBoard as mark (spaceKey(mark.coords))}
            {@const center = view.center(mark.coords)}
            <g class="target-ring" class:faded={destinationsDimmed} {@attach animator.mark()}>
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

        <!-- The piece you place or move, hovering until you drop it; tapping it turns it. -->
        {#snippet hovering(hover: Hover)}
            {@const turnable = session.staged?.id === hover.piece.id}
            <MovingPiece
                pose={hover.pose}
                tone={toneOf(hover.piece.playerId)}
                {view}
                prefix="punct-board"
                label="piece at {spaceLabel(hover.piece.punct)}"
                {turnable}
                onTurn={() => session.turnStaged()}
            >
                {#snippet ring()}
                    {#if turnable}
                        <g {@attach animator.mark()} {@attach hover.pose.ring(view)}>
                            {#each ['under', 'over'] as layer (layer)}
                                <path data-part="ring" class="top-ring role-staged {layer}"></path>
                            {/each}
                        </g>
                    {/if}
                {/snippet}
            </MovingPiece>
        {/snippet}

        {#each drawn as entry (entry.key)}
            {#if entry.kind === 'marker'}
                {@const at = anchorOf(view, entry.cells[0], entry.level)}
                <g transform="translate({at.x} {at.y})" class="marker">
                    <PunctMarker tone={toneOf(entry.playerId)} />
                </g>
            {:else if entry.kind === 'hover'}
                {#if hover}
                    {@render hovering(hover)}
                {/if}
            {:else}
                {@const piece = entry.piece}
                {@const role = roleOf(piece)}
                {@const at = anchorOf(view, piece.punct, piece.level)}
                {@const angle = piece.rotation + view.turnSteps}
                {@const drawing = drawPiece(piece.kind, angle, view)}
                <g
                    transform="translate({at.x} {at.y})"
                    class="piece-place role-{role ?? 'none'}"
                    role="button"
                    tabindex={role ? 0 : -1}
                    aria-disabled={!role}
                    aria-label="piece at {spaceLabel(piece.punct)}"
                    onclick={() => role && session.choosePiece(piece)}
                    onkeydown={(event) => role && onKey(event, () => session.choosePiece(piece))}
                >
                    <path
                        d={shadowPath(piece.kind, angle, piece.level > 0, view)}
                        class="shadow"
                        class:crease={piece.level > 0}
                        class:dark={toneOf(piece.playerId) === 'dark'}
                        {@attach animator.pieceShadow(piece.id)}
                    ></path>
                    <g {@attach animator.pieceNode(piece.id)}>
                        <g class="piece-look">
                            <PieceSlab
                                kind={piece.kind}
                                {angle}
                                tone={toneOf(piece.playerId)}
                                seed={piece.id}
                                prefix="punct-board"
                                {view}
                            />
                        </g>
                        <path d={silhouetteOf(drawing)} class="piece-hit"></path>
                    </g>
                    {#if role}
                        {@const ring = pathOf(drawing.topOutline)}
                        <g {@attach animator.mark()}>
                            {#each ['under', 'over'] as layer (layer)}
                                <path
                                    d={ring}
                                    class="top-ring role-{role} {layer}"
                                    class:faded={chosen && role === 'movable'}
                                ></path>
                            {/each}
                        </g>
                    {/if}
                    {#each marks.onPieces.get(piece.id) ?? [] as mark (spaceKey(mark.coords))}
                        {@const spot = onTopOf(view, mark.coords, piece.punct)}
                        <g
                            class="target-ring"
                            class:faded={destinationsDimmed}
                            {@attach animator.mark()}
                        >
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
                        {#each winningDots(session.gameState.board, piece, connection) as cell (spaceKey(cell))}
                            {@const spot = onTopOf(view, cell, piece.punct)}
                            <ellipse
                                cx={spot.x}
                                cy={spot.y}
                                rx={SPACING * 0.1}
                                ry={SPACING * 0.1 * view.tilt}
                                class="win-spot"
                            ></ellipse>
                        {/each}
                    {/if}
                    {#if session.showLevels && piece.level > 0}
                        {@const badge = badgeAt(view)}
                        <!-- Over the piece's marks, moving with the piece. -->
                        <g {@attach animator.pieceNode(piece.id)}>
                            <g transform="translate({badge.x} {badge.y})" class="level-badge">
                                <circle r={BADGE_RADIUS}></circle>
                                <text
                                    transform="scale({BADGE_TEXT_SCALE})"
                                    font-size={BADGE_FONT_SIZE}
                                    dy={BADGE_FONT_SIZE * CENTRED_BASELINE}>{piece.level + 1}</text
                                >
                            </g>
                        </g>
                    {/if}
                </g>
            {/if}
        {/each}

        {#if hover?.aloft}
            {@render hovering(hover)}
        {/if}

        {#each animator.fliers as flier (flier.piece.id)}
            <MovingPiece
                pose={flier.pose}
                tone={toneOf(flier.piece.playerId)}
                {view}
                prefix="punct-board"
            />
        {/each}

        <!-- Click areas for the chosen piece's PÜNCT on top of pieces, or under the piece itself,
             stand above everything, nearer ones last. -->
        {#each marks.raised as mark (spaceKey(mark.coords))}
            {@const spot = view.project(view.plan(mark.coords), view.surface(mark.height))}
            {#if mark.onPieceId === undefined}
                <g class="target-ring" class:faded={destinationsDimmed} {@attach animator.mark()}>
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
    </svg>
</div>

<style>
    .tap-off {
        display: contents;
    }

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
        font-weight: 600;
        letter-spacing: 1px;
        text-anchor: middle;
        pointer-events: none;
    }

    .plate-shadow {
        fill: rgb(20 40 28 / 0.22);
    }

    .hole {
        pointer-events: none;
    }

    .cell {
        fill: transparent;
        outline: none;
        cursor: pointer;
    }

    .piece-place {
        outline: none;
    }

    .piece-place:not(.role-none) {
        cursor: pointer;
    }

    .piece-look {
        pointer-events: none;
    }

    .piece-hit {
        fill: transparent;
    }

    .shadow {
        fill: rgb(20 30 25 / 0.28);
        stroke: rgb(20 30 25 / 0.12);
        stroke-width: 3;
        pointer-events: none;
    }

    .shadow.crease {
        fill: rgb(30 34 40 / 0.62);
        stroke: none;
    }

    .shadow.crease.dark {
        fill: rgb(0 0 0 / 0.9);
    }

    .marker {
        pointer-events: none;
    }

    /* Choice marks are two-tone: a dark band under a cyan core. */
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

    .target-ring.faded {
        opacity: 0.65;
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

    /* Cyan with a dark edge, as the spots in the other GIPF project games: gold vanished on yellow
       pieces. */
    .win-spot {
        fill: var(--punct-mark);
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 1.4;
        pointer-events: none;
    }
</style>
