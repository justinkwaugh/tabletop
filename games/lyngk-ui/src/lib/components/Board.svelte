<script lang="ts">
    import { addAxial, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import { POINTS } from '@tabletop/lyngk'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import { coordsKey, PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import { topFaceY } from '$lib/board/pieceGeometry.js'
    import { PIECE_STYLES } from '$lib/board/pieceStyle.js'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
    import { boltPath } from '$lib/board/lightning.js'
    import { prefersReducedMotion } from 'svelte/motion'
    import StackShape from './StackShape.svelte'
    import PieceDefs from './PieceDefs.svelte'

    const session = getGameSession()

    const frame = VIEW.frame()
    const outline = VIEW.playAreaOutline()

    const AXES: AxialCoordinates[] = [
        { q: 0, r: 1 },
        { q: 1, r: 0 },
        { q: 1, r: -1 }
    ]

    // Each line runs as far as consecutive points go, and on a little past its last points, as
    // on the printed board: a fraction of the step between points.
    const WHISKER = 0.25
    const lines = AXES.flatMap((axis) =>
        POINTS.filter(
            (point) => !includesCoords(POINTS, addAxial(point, { q: -axis.q, r: -axis.r }))
        ).flatMap((start) => {
            let end = start
            while (includesCoords(POINTS, addAxial(end, axis))) end = addAxial(end, axis)
            if (sameCoordinates(start, end)) return []
            const [from, to] = [VIEW.center(start), VIEW.center(end)]
            const next = VIEW.center(addAxial(start, axis))
            const step = { x: (next.x - from.x) * WHISKER, y: (next.y - from.y) * WHISKER }
            return [
                {
                    from: { x: from.x - step.x, y: from.y - step.y },
                    to: { x: to.x + step.x, y: to.y + step.y }
                }
            ]
        })
    )

    const animator = new BoardAnimator(session)
    // Back to front, so a nearer stack covers the one behind it.
    const stacks = $derived(
        animator.stacks.toSorted((a, b) => VIEW.center(a.coords).y - VIEW.center(b.coords).y)
    )

    const radius = PIECE_RADIUS
    // Marks sit on the top face's rim, outside its groove, so they never reach a neighbour.
    const RING_SCALE = 0.89

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

    function faceCenter(coords: AxialCoordinates) {
        const center = VIEW.center(coords)
        const height = session.gameState.board.stackAt(coords).length
        return { x: center.x, y: center.y + topFaceY(VIEW, height, radius) }
    }

    // Each bolt steps through seeded shapes in place, so it flickers but never vanishes. Six
    // keep the loop from showing: every step is to a fresh shape, including the one back to the
    // first.
    const BOLT_SHAPE_SECONDS = 1 / 3.6
    const BOLT_SHAPES = 6
    const bolts = $derived(
        session.chainLinks.map(([a, b], index) => ({
            key: `${coordsKey(a)}|${coordsKey(b)}`,
            shapes: Array.from({ length: BOLT_SHAPES }, (_, variant) =>
                boltPath(faceCenter(a), faceCenter(b), index * 97 + (variant + 1) * 13)
            )
        }))
    )

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
            .stackAt(coords)
            .map((color) => PIECE_STYLES[color].name)
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
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
    class="lyngk-board"
    viewBox={frame.viewBox}
    width={frame.width}
    height={frame.height}
    role="group"
    aria-label="LYNGK board"
    onclick={onBoardClick}
    {@attach animator.attach}
>
    <defs><PieceDefs prefix="lyngk-board" /></defs>
    <polygon points={outline} class="play-area"></polygon>

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

    {#each stacks as point (coordsKey(point.coords))}
        {@const center = VIEW.center(point.coords)}
        {@const clickable = isClickable(point.coords)}
        {@const key = coordsKey(point.coords)}
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
            <g {@attach animator.stack(key, 'whole')}>
                <StackShape
                    stack={point.stack}
                    ids={point.ids}
                    {radius}
                    prefix="lyngk-board"
                    seedKey={key}
                    parts={{
                        body: animator.stack(key, 'body'),
                        shadow: animator.stack(key, 'shadow')
                    }}
                />
                <!-- Marks sit on the top face, in front of the stacks behind and behind the ones in
                     front. They fade with the move, and leave with the stack when it lifts off. -->
                {#key session.gameState}
                    {@const role = roleOf(point.coords)}
                    {@const faceY = topFaceY(VIEW, point.stack.length, radius)}
                    {#if role}
                        <g class="marks" {@attach animator.mark()}>
                            {#if role !== 'link' && !(role === 'movable' && session.chosenFrom)}
                                <g class="ring role-{role}">
                                    {#each ['under', 'over'] as layer (layer)}
                                        <ellipse
                                            cy={faceY}
                                            rx={radius * RING_SCALE}
                                            ry={radius * RING_SCALE * VIEW.tilt}
                                            class={layer}
                                        ></ellipse>
                                    {/each}
                                </g>
                            {/if}
                            {#if role === 'landing' || role === 'link'}
                                <ellipse
                                    cy={faceY}
                                    rx={radius * 0.2}
                                    ry={radius * 0.2 * VIEW.tilt}
                                    class="spot role-{role}"
                                ></ellipse>
                            {/if}
                        </g>
                    {/if}
                {/key}
            </g>
        </g>
    {/each}

    <!-- Lightning runs between top faces, above every stack. -->
    {#key session.gameState}
        {#if bolts.length > 0}
            <g class="bolts marks" aria-hidden="true" {@attach animator.mark()}>
                {#each bolts as bolt (bolt.key)}
                    {#each ['glow', 'body', 'core'] as layer (layer)}
                        <path d={bolt.shapes[0]} class="bolt {layer}">
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
        {/if}
    {/key}

    {#if animator.flier}
        {@const center = VIEW.center(animator.flier.from)}
        <g transform="translate({center.x} {center.y})" class="flier">
            <g {@attach animator.flierNode('whole')}>
                <StackShape
                    parts={{
                        body: animator.flierNode('body'),
                        shadow: animator.flierNode('shadow')
                    }}
                    stack={animator.flier.stack}
                    ids={animator.flier.ids}
                    {radius}
                    prefix="lyngk-board"
                    seedKey={coordsKey(animator.flier.landsOn)}
                    baseLevel={animator.flier.baseLevel}
                />
            </g>
        </g>
        <g class="occluders" aria-hidden="true">
            {#each stacks as point (coordsKey(point.coords))}
                {#if !animator.flier.passes.includes(coordsKey(point.coords))}
                    <use
                        href="#{stackId(point.coords)}"
                        {@attach animator.occluder(VIEW.center(point.coords).y)}
                    ></use>
                {/if}
            {/each}
        </g>
    {/if}
</svg>

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

    .coordinate-label {
        fill: var(--lyngk-label);
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
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

    .marks {
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

    /* LYNGK chains: a soft glow under a bright jagged bolt between discs of the claimed color. */
    .bolt {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .bolt.glow {
        stroke: var(--lyngk-bolt-glow);
        stroke-width: 7;
        opacity: 0.45;
        filter: blur(2px);
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
