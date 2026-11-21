<script lang="ts">
    import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import { pieceColor, pointKey } from '@tabletop/lyngk'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import { PIECE_RADIUS } from '$lib/board/geometry.js'
    import { boardLines } from '$lib/board/boardLines.js'
    import { bolts as boltsOf, BOLT_SHAPE_SECONDS } from '$lib/board/marks.js'
    import { topFaceY } from '$lib/board/pieceGeometry.js'
    import { PIECE_STYLES } from '$lib/board/pieceStyle.js'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
    import { prefersReducedMotion } from 'svelte/motion'
    import StackShape from './StackShape.svelte'
    import PieceDefs from './PieceDefs.svelte'

    const session = getGameSession()

    const view = $derived(session.view)
    const frame = $derived(view.frame())
    const outline = $derived(view.playAreaOutline())
    const lines = $derived(boardLines(view))

    const animator = new BoardAnimator(session)
    // Back to front, so a nearer stack covers the one behind it.
    const stacks = $derived(
        animator.stacks.toSorted((a, b) => view.center(a.coords).y - view.center(b.coords).y)
    )

    const radius = PIECE_RADIUS
    // Marks sit on the top face's rim, outside its groove, so they never reach a neighbour.
    const RING_SCALE = 0.89
    // Coordinate labels sit on the alphabetic baseline, lowered by a fraction of their size to
    // centre on their point, which every browser draws alike.
    const LABEL_SIZE = 15

    type Role = 'landing' | 'link' | 'chosen' | 'movable'

    // A LYNGK-point is marked with a spot only; it is a stack of the mover's color, so it can
    // still be tapped to pick it up instead.
    function roleOf(coords: AxialCoordinates): Role | undefined {
        if (includesCoords(session.landings, coords)) return 'landing'
        if (session.chosenFrom && sameCoordinates(session.chosenFrom, coords)) return 'chosen'
        if (includesCoords(session.links, coords)) return 'link'
        if (includesCoords(session.movable, coords)) return 'movable'
        return undefined
    }

    const bolts = $derived(boltsOf(view, session.gameState.board, session.chainLinks, radius))

    function stackId({ q, r }: AxialCoordinates): string {
        return `lyngk-stack-${q}_${r}`
    }

    function isClickable(coords: AxialCoordinates): boolean {
        return includesCoords(session.landings, coords) || includesCoords(session.movable, coords)
    }

    function describe(coords: AxialCoordinates): string {
        const name = session.notation.name(coords)
        if (includesCoords(session.landings, coords)) return `land on ${name}`
        if (session.chosenFrom && sameCoordinates(session.chosenFrom, coords))
            return `put back ${name}`
        if (includesCoords(session.movable, coords)) return `move ${name}`
        const stack = session.gameState.board
            .piecesAt(coords)
            .map((piece) => PIECE_STYLES[pieceColor(piece)].name)
            .join(' ')
        return `${name} ${stack}`
    }

    // A tap on nothing you can choose lets go of what is chosen.
    function onBoardClick(event: MouseEvent) {
        if (!(event.target instanceof Element)) return
        if (event.target.closest('[role="button"]:not([aria-disabled="true"])')) return
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
        class="lyngk-board"
        viewBox={frame.viewBox}
        width={frame.width}
        height={frame.height}
        role="group"
        aria-label="LYNGK board"
        {@attach animator.attach}
    >
        <defs><PieceDefs prefix="lyngk-board" {radius} /></defs>
        <polygon points={outline} class="play-area"></polygon>

        <g class="lines">
            {#each lines as line, index (index)}
                <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}></line>
            {/each}
        </g>

        {#if session.showCoordinates}
            {#each session.notation.labels as label (label.key)}
                <text
                    x={label.at.x}
                    y={label.at.y}
                    dy={LABEL_SIZE * 0.35}
                    font-size={LABEL_SIZE}
                    class="coordinate-label">{label.text}</text
                >
            {/each}
        {/if}

        <!-- While the players set the board, every empty point takes a piece. -->
        {#each session.placeable as coords (pointKey(coords))}
            {@const center = view.center(coords)}
            <ellipse
                cx={center.x}
                cy={center.y}
                rx={radius}
                ry={radius * view.tilt}
                class="vacant"
                role="button"
                tabindex="0"
                aria-label="place on {session.notation.name(coords)}"
                onclick={() => session.choosePoint(coords)}
                onkeydown={(event) => onKey(event, () => session.choosePoint(coords))}
            ></ellipse>
        {/each}

        {#each stacks as point (point.key)}
            {@const center = view.center(point.coords)}
            {@const clickable = isClickable(point.coords)}
            <g
                id={stackId(point.coords)}
                transform="translate({center.x} {center.y})"
                class="stack"
                class:clickable
                role="button"
                tabindex={clickable ? 0 : -1}
                aria-disabled={!clickable}
                aria-label={describe(point.coords)}
                onclick={() => clickable && session.choosePoint(point.coords)}
                onkeydown={(event) =>
                    clickable && onKey(event, () => session.choosePoint(point.coords))}
            >
                <g {@attach animator.stack(point.key, 'whole')}>
                    <StackShape
                        pieces={point.pieces}
                        {radius}
                        prefix="lyngk-board"
                        turned={view.turned}
                        parts={{
                            body: animator.stack(point.key, 'body'),
                            shadow: animator.stack(point.key, 'shadow')
                        }}
                    />
                    <!-- Marks sit on the top face, in front of the stacks behind and behind the ones in
                     front. They fade with the move, and leave with the stack when it lifts off. -->
                    {#key session.gameState}
                        {@const role = roleOf(point.coords)}
                        {@const faceY = topFaceY(view, point.pieces.length, radius)}
                        {#if role}
                            <g class="marks" {@attach animator.mark()}>
                                {#if role !== 'link' && !(role === 'movable' && session.chosenFrom)}
                                    <g class="ring role-{role}">
                                        {#each ['under', 'over'] as layer (layer)}
                                            <ellipse
                                                cy={faceY}
                                                rx={radius * RING_SCALE}
                                                ry={radius * RING_SCALE * view.tilt}
                                                class={layer}
                                            ></ellipse>
                                        {/each}
                                    </g>
                                {/if}
                                {#if role === 'landing' || role === 'link'}
                                    <ellipse
                                        cy={faceY}
                                        rx={radius * 0.2}
                                        ry={radius * 0.2 * view.tilt}
                                        class="spot role-{role}"
                                    ></ellipse>
                                {/if}
                            </g>
                        {/if}
                    {/key}
                </g>
            </g>
        {/each}

        <!-- Lightning runs between top faces, above every stack. Each path fades on its own, so the
         layers of one bolt never show through each other as a group would. -->
        {#key session.gameState}
            <g class="bolts" aria-hidden="true">
                {#each bolts as bolt (bolt.key)}
                    {#each ['halo', 'body', 'core'] as layer (layer)}
                        <path d={bolt.shapes[0]} class="bolt {layer}" {@attach animator.mark()}>
                            {#if !prefersReducedMotion.current}
                                <animate
                                    attributeName="d"
                                    values={bolt.shapes.join(';')}
                                    dur="{BOLT_SHAPE_SECONDS * bolt.shapes.length}s"
                                    calcMode="discrete"
                                    repeatCount="indefinite"
                                ></animate>
                            {/if}
                        </path>
                    {/each}
                {/each}
            </g>
        {/key}

        {#each animator.fliers as flier (flier.key)}
            {@const center = view.center(flier.from)}
            <g transform="translate({center.x} {center.y})" class="flier">
                <g {@attach animator.flierNode(flier.key, 'whole')}>
                    <StackShape
                        parts={{
                            body: animator.flierNode(flier.key, 'body'),
                            shadow: animator.flierNode(flier.key, 'shadow')
                        }}
                        pieces={flier.pieces}
                        {radius}
                        prefix="lyngk-board"
                        turned={view.turned}
                    />
                </g>
            </g>
        {/each}
        <!-- A lone flier passes behind the stacks nearer the viewer than its place on the board. -->
        {#if animator.fliers.length === 1}
            {@const flier = animator.fliers[0]}
            <g class="occluders" aria-hidden="true">
                {#each stacks as point (point.key)}
                    {#if !flier.passes.includes(point.key)}
                        <use
                            href="#{stackId(point.coords)}"
                            {@attach animator.occluder(view.center(point.coords).y)}
                        ></use>
                    {/if}
                {/each}
            </g>
        {/if}
    </svg>
</div>

<style>
    .lyngk-board {
        overflow: visible;
        user-select: none;
    }

    .play-area {
        fill: var(--lyngk-play);
        stroke: var(--lyngk-play-edge);
        stroke-width: 2;
        stroke-linejoin: round;
    }

    .lines line {
        stroke: var(--lyngk-line);
        stroke-opacity: var(--lyngk-line-opacity);
        stroke-width: 1.6;
    }

    .vacant {
        fill: transparent;
        cursor: pointer;
    }

    .coordinate-label {
        fill: var(--lyngk-label);
        font-weight: 600;
        letter-spacing: 0.6px;
        text-anchor: middle;
        pointer-events: none;
    }

    .tap-off {
        display: contents;
    }

    .stack {
        outline: none;
    }

    .stack.clickable {
        cursor: pointer;
    }

    /* A stack with nothing to choose lets taps through to the one behind it, which a tall
       stack in front may half cover. */
    .stack:not(.clickable) {
        pointer-events: none;
    }

    .marks,
    .bolts {
        pointer-events: none;
    }

    /* Two-tone, a dark band under a bright core, so a ring reads on every disc color. */
    .ring ellipse {
        fill: none;
    }

    .ring {
        transition: opacity 0.2s;
    }

    .ring .under {
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 4.6;
    }

    .ring .over {
        stroke: var(--lyngk-mark);
        stroke-width: 2.4;
    }

    .ring.role-chosen .under {
        stroke-width: 5.6;
    }

    .ring.role-chosen .over {
        stroke-width: 3.4;
    }

    /* Landings: thick cyan dashes, each outlined in black so they read on every disc. The
       black dashes are shorter but square-capped, so they overhang each cyan dash by the
       outline width at both ends; a 10-unit period keeps a gap between outlines. */
    .ring.role-landing .over {
        stroke-width: 3.6;
        stroke-dasharray: 6 4;
    }

    .ring.role-landing .under {
        stroke: #000;
        stroke-width: 6;
        stroke-dasharray: 2.4 7.6;
        stroke-dashoffset: -1.8;
        stroke-linecap: square;
    }

    /* LYNGK chains: a wide translucent halo under a bright jagged bolt between discs of the
       claimed color. */
    .bolt {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .bolt.halo {
        stroke: var(--lyngk-bolt-glow);
        stroke-width: 8;
        stroke-opacity: 0.35;
    }

    .bolt.body {
        stroke: var(--lyngk-bolt);
        stroke-width: 3;
    }

    .bolt.core {
        stroke: #ffffff;
        stroke-width: 1.2;
    }

    .spot {
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 1.4;
    }

    .spot.role-landing {
        fill: var(--lyngk-mark);
    }

    .spot.role-link {
        fill: var(--lyngk-link-mark);
    }

    .flier,
    .occluders {
        pointer-events: none;
    }
</style>
