<script lang="ts">
    import { coordinatesToNumber, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import { DOTS, type BoardPiece } from '@tabletop/gipf'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CROWN_SCALE, DOT_RADIUS, PIECE_RADIUS, includesCoords } from '$lib/board/geometry.js'
    import { gridLines } from '$lib/board/boardLines.js'
    import { pushArrow, stackOutline } from '$lib/board/marks.js'
    import PieceDefs from './PieceDefs.svelte'
    import StandingPiece from './StandingPiece.svelte'
    import StagedPiece from './StagedPiece.svelte'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'

    const session = getGameSession()

    const view = $derived(session.view)
    const frame = $derived(view.frame())
    const playArea = $derived(view.playAreaOutline())
    const lines = $derived(gridLines(view))

    const animator = new BoardAnimator(session)
    let hoveredDot: number | undefined = $state()
    let hoveredTarget: number | undefined = $state()
    const pieces = $derived(animator.pieces)

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
        | { kind: 'piece'; key: number; coords: AxialCoordinates; piece: BoardPiece }
        | {
              kind: 'entering' | 'preview'
              key: string
              coords: AxialCoordinates
              gipf: boolean
              playerId: string
              drops: boolean
          }

    // Far pieces first. The incoming piece is drawn at its dot's depth, which the pushed line
    // keeps as it slides.
    const drawOrder: Drawn[] = $derived.by(() => {
        const drawn: Drawn[] = pieces.map((piece) => ({
            kind: 'piece',
            key: coordinatesToNumber(piece.coords),
            coords: piece.coords,
            piece
        }))
        const incoming = animator.entering ?? preview
        if (incoming) {
            drawn.push({
                kind: animator.entering ? 'entering' : 'preview',
                // Keyed by dot, so making it a GIPF-piece keeps the piece and drops a disc onto it.
                key: `incoming-${coordinatesToNumber(incoming.dot)}`,
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

    function onBoardClick(event: MouseEvent) {
        const target = event.target
        if (!(target instanceof Element)) return
        if (target.closest('[role="button"]:not([aria-disabled="true"])')) return
        session.letGo()
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

    const standingOutline = $derived(stackOutline(view))
</script>

<!-- Tapping off the choices is a shortcut for pointers; Undo lets go from the keyboard. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
    class="gipf-board"
    viewBox={frame.viewBox}
    width={frame.width}
    height={frame.height}
    role="group"
    aria-label="GIPF board"
    onclick={onBoardClick}
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

    {#if session.showCoordinates}
        {#each session.notation.labels as label (label.key)}
            <text x={label.at.x} y={label.at.y} class="coordinate-label">{label.text}</text>
        {/each}
    {/if}

    {#each DOTS as coords (coordinatesToNumber(coords))}
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
            onpointerenter={() => (hoveredDot = coordinatesToNumber(coords))}
            onpointerleave={() => (hoveredDot = undefined)}
            onfocus={() => (hoveredDot = coordinatesToNumber(coords))}
            onblur={() => (hoveredDot = undefined)}
        >
            {#if entry}
                <ellipse rx={DOT_RADIUS * 2.4} ry={DOT_RADIUS * 2.4 * view.tilt} class="dot-hit"
                ></ellipse>
            {/if}
            <ellipse rx={DOT_RADIUS} ry={DOT_RADIUS * view.tilt} class="dot-core"></ellipse>
        </g>
    {/each}

    <g {@attach animator.marks()}>
        {#each session.entryDots as coords (coordinatesToNumber(coords))}
            {@const center = view.center(coords)}
            <g
                class="dot-ring"
                class:chosen={isChosenDot(coords)}
                class:faded={session.chosenDot !== undefined && !isChosenDot(coords)}
                class:hovered={hoveredDot === coordinatesToNumber(coords)}
            >
                {#each ['under', 'over'] as layer (layer)}
                    <ellipse
                        cx={center.x}
                        cy={center.y}
                        rx={DOT_RADIUS * 2.4}
                        ry={DOT_RADIUS * 2.4 * view.tilt}
                        class={layer}
                    ></ellipse>
                {/each}
            </g>
        {/each}
        {#each session.targets as entry (coordinatesToNumber(entry.line[0]))}
            {@const center = view.center(entry.line[0])}
            <g
                class="target-ring"
                class:hovered={hoveredTarget === coordinatesToNumber(entry.line[0])}
            >
                {#each ['under', 'over'] as layer (layer)}
                    <ellipse
                        cx={center.x}
                        cy={center.y}
                        rx={PIECE_RADIUS + 2}
                        ry={(PIECE_RADIUS + 2) * view.tilt}
                        class={layer}
                    ></ellipse>
                {/each}
            </g>
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
                <!-- Marks sit outside the node that moves the piece, so they stay put. -->
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
            <g
                transform="translate({center.x} {center.y})"
                class="entering"
                class:staged={session.choosesType}
                role="button"
                tabindex={session.choosesType ? 0 : -1}
                aria-disabled={!session.choosesType}
                aria-label={drawn.gipf ? 'make it a single piece' : 'make it a GIPF-piece'}
                onclick={() => session.toggleGipf()}
                onkeydown={(event) => onKey(event, () => session.toggleGipf())}
            >
                <StagedPiece
                    color={colorOf(drawn.playerId)}
                    gipf={drawn.gipf}
                    drops={drawn.drops}
                    lifts={() => animator.entering === undefined && !animator.pushedIn}
                />
            </g>
        {/if}
    {/each}

    <g {@attach animator.marks()}>
        {#each session.targets as entry (coordinatesToNumber(entry.line[0]))}
            {@const center = view.center(entry.line[0])}
            {@const key = coordinatesToNumber(entry.line[0])}
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
                {#each ['under', 'over'] as layer (layer)}
                    <path d={pushArrow(view, entry.dot, entry.line[0])} class="arrow {layer}"
                    ></path>
                {/each}
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

    /* Choice marks are two-tone, as in MATRX GIPF, DVONN and LYNGK: a dark band under a cyan
       core, so they read on the board and on light and dark pieces alike. */
    .under {
        stroke: rgb(0 0 0 / 0.8);
    }

    .dot-ring {
        pointer-events: none;
    }

    .dot-ring .under {
        fill: rgb(94 240 255 / 0.16);
        stroke-width: 3.8;
    }

    .dot-ring .over {
        fill: none;
        stroke: var(--gipf-mark);
        stroke-width: 2;
    }

    .dot-ring.hovered .under {
        fill: rgb(94 240 255 / 0.3);
    }

    .dot-ring.faded {
        opacity: 0.4;
    }

    .dot-ring.chosen .under {
        fill: rgb(94 240 255 / 0.38);
        stroke-width: 5.3;
    }

    .dot-ring.chosen .over {
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

    /* A GIPF-piece's toggle in the chosen row: its crown ring, coloured for keep or take. */
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

    .entering.staged {
        pointer-events: auto;
        cursor: pointer;
        outline: none;
    }

    .target {
        cursor: pointer;
        outline: none;
    }

    .arrow {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .arrow.under {
        stroke-width: 5.3;
    }

    .arrow.over {
        stroke: var(--gipf-mark);
        stroke-width: 3.5;
    }

    .target-ring {
        pointer-events: none;
    }

    /* Each dash outlined on its own, as in DVONN, so what is under shows between dashes: the
       dark dashes are shorter but square-capped, overhanging each cyan one by the band. */
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
        stroke: var(--gipf-mark);
        stroke-width: 2;
        stroke-dasharray: 5 4;
    }

    .target-ring.hovered .under {
        fill: rgb(94 240 255 / 0.3);
        stroke: rgb(0 0 0 / 0.8);
        stroke-dasharray: none;
        stroke-linecap: butt;
    }

    .target-ring.hovered .over {
        stroke-dasharray: none;
    }

    .target-hit {
        fill: transparent;
    }
</style>
