<script lang="ts">
    import {
        Color,
        coordinatesToNumber,
        sameCoordinates,
        type AxialCoordinates
    } from '@tabletop/common'
    import { CENTRE, type Entry } from '@tabletop/gipf-potentials'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { DOT_RADIUS, includesCoords, PIECE_RADIUS } from '$lib/board/geometry.js'
    import type { BoardDisc } from '$lib/board/boardChange.js'
    import { turnOf, type Disc } from '$lib/board/pieceShape.js'
    import { gridLines } from '$lib/board/boardLines.js'
    import { pushArrow, stackOutline, topRing, type RingArc } from '$lib/board/marks.js'
    import { BoardAnimator, type DrawnStack } from '$lib/animators/boardAnimator.svelte.js'
    import PieceDefs from './PieceDefs.svelte'
    import StandingStack from './StandingStack.svelte'
    import StagedPiece from './StagedPiece.svelte'

    const session = getGameSession()

    const view = $derived(session.view)
    const geometry = $derived(view.geometry)
    const frame = $derived(view.frame())
    const playArea = $derived(view.playAreaOutline())

    const lines = $derived(gridLines(view))

    const animator = new BoardAnimator(session)
    let hoveredDot: number | undefined = $state()
    let hoveredTarget: number | undefined = $state()

    function toneOf(playerId: string): Disc['tone'] {
        return session.gameState.getPlayerState(playerId).color === Color.White ? 'light' : 'dark'
    }

    function toned(discs: readonly BoardDisc[]): Disc[] {
        return discs.map((disc) => ({
            tone: toneOf(disc.playerId),
            kind: disc.kind,
            turn: turnOf(disc.kind, disc.id, view.turned)
        }))
    }

    const preview = $derived.by(() => {
        if (animator.entering || animator.pushedIn) return undefined
        if (animator.returned) return { ...animator.returned, drops: false }
        const dot = session.chosenDot
        if (dot === undefined || session.stagedDiscs.length === 0) return undefined
        return { dot, discs: session.stagedDiscs, drops: true }
    })

    type Drawn =
        | { kind: 'stack'; key: number; coords: AxialCoordinates; stack: DrawnStack }
        | {
              kind: 'entering' | 'preview'
              key: string
              coords: AxialCoordinates
              discs: BoardDisc[]
              drops: boolean
          }

    // Drawn at its dot's depth: the line it pushes moves with it, so the order holds as it slides.
    const drawOrder: Drawn[] = $derived.by(() => {
        const drawn: Drawn[] = animator.stacks.map((stack) => ({
            kind: 'stack',
            key: stack.key,
            coords: stack.coords,
            stack
        }))
        const incoming = animator.entering ?? preview
        if (incoming) {
            drawn.push({
                kind: animator.entering ? 'entering' : 'preview',
                key: `incoming-${coordinatesToNumber(incoming.dot)}-${incoming.discs.map((disc) => disc.kind).join()}`,
                coords: incoming.dot,
                discs: incoming.discs,
                drops: preview?.drops ?? false
            })
        }
        return drawn.toSorted((a, b) => view.center(a.coords).y - view.center(b.coords).y)
    })

    // Not on the real board: a reminder of TAMSK's extra move.
    const centre = $derived(view.center(CENTRE))
    const STATION_RADIUS = PIECE_RADIUS + 4
    const STATION_INNER = PIECE_RADIUS * 0.4
    const SPOT_RADIUS = PIECE_RADIUS * 0.13

    const TOGGLE_RADIUS = PIECE_RADIUS * 0.66

    const chosen = $derived(session.chosenFrom !== undefined || session.chosenDot !== undefined)

    function onBoardClick(event: MouseEvent) {
        const target = event.target
        const choosable = '[role="button"]:not([aria-disabled="true"])'
        if (target instanceof Element && target.closest(choosable)) return
        session.letGo()
    }

    function isChosenTo(coords: AxialCoordinates) {
        return session.chosenTo !== undefined && sameCoordinates(session.chosenTo, coords)
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

    function stackRole(coords: AxialCoordinates): string | undefined {
        const role = rowRole(coords)
        if (role) return role
        if (session.chosenFrom && sameCoordinates(session.chosenFrom, coords)) return 'chosen'
        return includesCoords(session.movable, coords) ? 'movable' : undefined
    }

    function chooseStack(coords: AxialCoordinates) {
        if (rowRole(coords)) {
            const inChosenRow = session.chosenRow && includesCoords(session.chosenRow.reach, coords)
            if (inChosenRow && includesCoords(session.rowKeepable, coords)) {
                session.toggleKeep(coords)
            } else {
                session.chooseRowAt(coords)
            }
            return
        }
        session.chooseFrom(coords)
    }

    function onKey(event: KeyboardEvent, act: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            act()
        }
    }

    function stackHeight(coords: AxialCoordinates): number {
        return (
            animator.stacks.find((stack) => sameCoordinates(stack.coords, coords))?.discs.length ??
            0
        )
    }

    function ring(discs: readonly BoardDisc[], radius: number, cy: number): RingArc[] {
        const [top] = toned(discs.slice(-1))
        return topRing(view, top, radius, cy)
    }

    // Bodies only: a shadow drawn twice shows darker.
    const occluding = $derived(
        animator.flier
            ? animator.stacks.filter((stack) => !animator.flier?.passes.includes(stack.key))
            : []
    )
</script>

<!-- Tapping off the choices is a shortcut for pointers; Undo lets go from the keyboard. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
    class="gp-board"
    viewBox={frame.viewBox}
    width={frame.width}
    height={frame.height}
    role="group"
    aria-label="GIPF board"
    onclick={onBoardClick}
    {@attach animator.attach}
>
    <defs>
        <PieceDefs prefix="gp-board" />
    </defs>

    <polygon points={playArea} class="play-area"></polygon>

    <g class="lines">
        {#each lines as line, index (index)}
            <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}></line>
        {/each}
    </g>

    {#if session.centreMark}
        <g transform="translate({centre.x} {centre.y})" class="station">
            <ellipse rx={STATION_RADIUS} ry={STATION_RADIUS * view.tilt}></ellipse>
            <ellipse rx={STATION_INNER} ry={STATION_INNER * view.tilt} class="hub"></ellipse>
        </g>
    {/if}

    {#if session.showCoordinates}
        {#each session.notation.labels as label (label.key)}
            <text x={label.at.x} y={label.at.y} class="coordinate-label">{label.text}</text>
        {/each}
    {/if}

    {#each geometry.dots as coords (coordinatesToNumber(coords))}
        {@const center = view.center(coords)}
        {@const entry = includesCoords(session.entryDots, coords)}
        <g
            transform="translate({center.x} {center.y})"
            class="dot"
            class:entry
            role="button"
            tabindex={entry ? 0 : -1}
            aria-disabled={!entry}
            aria-label="dot {session.notation.name(coords)}"
            onclick={() => session.chooseDot(coords)}
            onkeydown={(event) => onKey(event, () => session.chooseDot(coords))}
            onpointerenter={(event) => {
                if (event.pointerType !== 'touch') hoveredDot = coordinatesToNumber(coords)
            }}
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
                class:faded={chosen && !isChosenDot(coords)}
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
        {#each session.moveTargets as coords (coordinatesToNumber(coords))}
            {@const center = view.center(coords)}
            {#if stackHeight(coords) === 0}
                <g
                    class="target-ring"
                    class:hovered={hoveredTarget === coordinatesToNumber(coords)}
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
            {/if}
        {/each}
    </g>

    {#each drawOrder as drawn (drawn.key)}
        {@const center = view.center(drawn.coords)}
        {#if drawn.kind === 'stack'}
            {@const stack = drawn.stack}
            {@const role = stackRole(stack.coords)}
            {@const faceY = view.topFace(stack.discs.length)}
            {@const target = includesCoords(session.moveTargets, stack.coords)}
            <g
                transform="translate({center.x} {center.y})"
                class="stack role-{role ?? 'none'}"
                role="button"
                tabindex={role ? 0 : -1}
                aria-disabled={!role}
                aria-label="stack {session.notation.name(stack.coords)}"
                onclick={() => role && chooseStack(stack.coords)}
                onkeydown={(event) => role && onKey(event, () => chooseStack(stack.coords))}
            >
                <g {@attach animator.stack(drawn.key, 'whole')}>
                    <StandingStack
                        discs={toned(stack.discs)}
                        {view}
                        bodyId="gp-stack-{stack.key}"
                        body={animator.stack(drawn.key, 'body')}
                        shadow={animator.stack(drawn.key, 'shadow')}
                        parts={animator.parts(drawn.key)}
                    />
                </g>
                {#if role || target}
                    <g {@attach animator.marks()}>
                        {#if target}
                            {#each ['under', 'over'] as layer (layer)}
                                {#each ring(stack.discs, PIECE_RADIUS - 3, faceY) as arc, index (index)}
                                    <path
                                        d={arc.d}
                                        pathLength={arc.length}
                                        class="top-ring role-target {layer}"
                                        class:hovered={hoveredTarget === drawn.key}
                                        class:chosen={isChosenTo(stack.coords)}
                                        class:faded={session.chosenTo !== undefined &&
                                            !isChosenTo(stack.coords)}
                                    ></path>
                                {/each}
                            {/each}
                            {#if isChosenTo(stack.coords)}
                                <ellipse
                                    cy={faceY}
                                    rx={SPOT_RADIUS}
                                    ry={SPOT_RADIUS * view.tilt}
                                    class="mark-spot role-cover"
                                ></ellipse>
                            {/if}
                        {:else if role === 'row' || role === 'movable' || role === 'chosen'}
                            {#each role === 'row' ? ['over'] : ['under', 'over'] as layer (layer)}
                                {#each ring(stack.discs, PIECE_RADIUS - 3, faceY) as arc, index (index)}
                                    <path
                                        d={arc.d}
                                        pathLength={arc.length}
                                        class="top-ring role-{role} {layer}"
                                        class:faded={chosen && role === 'movable'}
                                    ></path>
                                {/each}
                            {/each}
                        {:else}
                            {#if includesCoords(session.rowKeepable, stack.coords)}
                                {#each ring(stack.discs, TOGGLE_RADIUS, faceY) as arc, index (index)}
                                    <path
                                        d={arc.d}
                                        pathLength={arc.length}
                                        class="toggle-ring role-{role}"
                                    ></path>
                                {/each}
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
                    <StandingStack
                        discs={toned(drawn.discs)}
                        {view}
                        shadow={animator.enteringShadow()}
                        parts={animator.enteringParts}
                    />
                </g>
            </g>
        {:else}
            <g transform="translate({center.x} {center.y})" class="entering">
                <StagedPiece
                    discs={toned(drawn.discs)}
                    {view}
                    drops={drawn.drops}
                    lifts={() => animator.entering === undefined && !animator.pushedIn}
                />
            </g>
        {/if}
    {/each}

    {#if animator.flier}
        {@const flier = animator.flier}
        {@const center = view.center(flier.coords)}
        <g transform="translate({center.x} {center.y})" class="flier">
            <g {@attach animator.flierNode('whole')}>
                <StandingStack
                    discs={toned([flier.disc])}
                    {view}
                    body={animator.flierNode('body')}
                    shadow={animator.flierNode('shadow')}
                />
            </g>
        </g>
        {#each occluding as stack (stack.key)}
            {@const center = view.center(stack.coords)}
            <use
                href="#gp-stack-{stack.key}"
                transform="translate({center.x} {center.y})"
                {@attach animator.occluder(stack)}
            ></use>
        {/each}
    {/if}

    <!-- Above the pieces, nearer ones last; tapping the staged stack is tapping its dot. -->
    {#snippet pushTarget(entry: Entry, part: 'area' | 'arrow')}
        {@const center = view.center(entry.line[0])}
        {@const key = coordinatesToNumber(entry.line[0])}
        <g
            class="target"
            role="button"
            tabindex={part === 'area' ? 0 : -1}
            aria-label={part === 'area'
                ? `push to ${session.notation.name(entry.line[0])}`
                : undefined}
            aria-hidden={part === 'arrow' ? 'true' : undefined}
            onclick={() => session.push(entry.line[0])}
            onkeydown={(event) => onKey(event, () => session.push(entry.line[0]))}
            onpointerenter={(event) => {
                if (event.pointerType !== 'touch') hoveredTarget = key
            }}
            onpointerleave={() => (hoveredTarget = undefined)}
            onfocus={() => (hoveredTarget = key)}
            onblur={() => (hoveredTarget = undefined)}
        >
            {#if part === 'area'}
                <path
                    d={stackOutline(view, stackHeight(entry.line[0]))}
                    transform="translate({center.x} {center.y})"
                    class="target-hit"
                ></path>
            {:else}
                {#each ['under', 'over'] as layer (layer)}
                    <path d={pushArrow(view, entry.dot, entry.line[0])} class="arrow {layer}"
                    ></path>
                {/each}
            {/if}
        </g>
    {/snippet}
    <g {@attach animator.marks()}>
        {#each session.targets as entry (coordinatesToNumber(entry.line[0]))}
            {@render pushTarget(entry, 'area')}
        {/each}
        {#if preview && session.chosenDot !== undefined}
            {@const dot = session.chosenDot}
            {@const center = view.center(dot)}
            <path
                d={stackOutline(view, preview.discs.length)}
                transform="translate({center.x} {center.y})"
                class="target-hit target"
                role="button"
                tabindex="-1"
                aria-label="stack on {session.notation.name(dot)}"
                onclick={() => session.chooseDot(dot)}
                onkeydown={(event) => onKey(event, () => session.chooseDot(dot))}
            ></path>
        {/if}
        {#each session.targets as entry (coordinatesToNumber(entry.line[0]))}
            {@render pushTarget(entry, 'arrow')}
        {/each}
        {#each session.moveTargets.toSorted((a, b) => view.center(a).y - view.center(b).y) as coords (coordinatesToNumber(coords))}
            {@const center = view.center(coords)}
            {@const key = coordinatesToNumber(coords)}
            <path
                d={stackOutline(view, stackHeight(coords))}
                transform="translate({center.x} {center.y})"
                class="target-hit target"
                role="button"
                tabindex="0"
                aria-label="move to {session.notation.name(coords)}"
                onclick={() => session.movePotential(coords)}
                onkeydown={(event) => onKey(event, () => session.movePotential(coords))}
                onpointerenter={(event) => {
                    if (event.pointerType !== 'touch') hoveredTarget = key
                }}
                onpointerleave={() => (hoveredTarget = undefined)}
                onfocus={() => (hoveredTarget = key)}
                onblur={() => (hoveredTarget = undefined)}
            ></path>
        {/each}
    </g>
</svg>

<style>
    .gp-board {
        overflow: visible;
        user-select: none;
    }

    .play-area {
        fill: var(--gp-play);
    }

    .lines line {
        stroke: var(--gp-line);
        stroke-width: 1.6;
    }

    .station ellipse {
        fill: none;
        stroke: var(--gp-line);
        stroke-width: 1.6;
    }

    .station ellipse.hub {
        fill: var(--gp-play);
    }

    .coordinate-label {
        fill: var(--gp-label);
        font-size: 17px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
    }

    .dot,
    .stack {
        outline: none;
    }

    .dot-core {
        fill: var(--gp-line);
    }

    .dot.entry {
        cursor: pointer;
    }

    .dot-hit {
        fill: transparent;
    }

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
        stroke: var(--gp-mark);
        stroke-width: 2;
    }

    .dot-ring.hovered .under {
        fill: rgb(94 240 255 / 0.3);
    }

    .dot-ring.faded,
    .top-ring.faded {
        opacity: 0.4;
    }

    .dot-ring.chosen .under {
        fill: rgb(94 240 255 / 0.38);
        stroke-width: 5.3;
    }

    .dot-ring.chosen .over {
        stroke-width: 3.5;
    }

    /* A stack with nothing to choose lets clicks through to the dot or target behind it. */
    .stack.role-none {
        pointer-events: none;
    }

    .stack:not(.role-none) {
        cursor: pointer;
    }

    .top-ring {
        fill: none;
        stroke-width: 2.5;
        pointer-events: none;
    }

    .top-ring.role-row {
        stroke: var(--gp-row);
        stroke-opacity: 0.6;
        stroke-dasharray: 5 4;
    }

    .top-ring.role-movable.over,
    .top-ring.role-target.over {
        stroke: var(--gp-mark);
    }

    .top-ring.role-movable.under {
        stroke-width: 4.3;
    }

    .top-ring.role-chosen.over {
        stroke: var(--gp-mark);
        stroke-width: 3.5;
    }

    .top-ring.role-chosen.under {
        stroke-width: 5.3;
    }

    .top-ring.role-target.over {
        stroke-dasharray: 5 4;
    }

    .top-ring.role-target.under {
        stroke: #000;
        stroke-width: 4.3;
        stroke-dasharray: 2.5 6.5;
        stroke-dashoffset: -1.25;
        stroke-linecap: square;
    }

    .top-ring.role-target.chosen.over,
    .top-ring.role-target.hovered.over {
        stroke-dasharray: none;
        stroke-width: 3.5;
    }

    .top-ring.role-target.chosen.under,
    .top-ring.role-target.hovered.under {
        stroke: rgb(0 0 0 / 0.8);
        stroke-dasharray: none;
        stroke-width: 5.3;
        stroke-linecap: butt;
    }

    .toggle-ring {
        fill: none;
        stroke-width: 3;
        pointer-events: none;
    }

    .toggle-ring.role-removing {
        stroke: var(--gp-row);
    }

    .toggle-ring.role-keeping {
        stroke: var(--gp-keep);
    }

    .mark-spot {
        stroke: rgb(0 0 0 / 0.35);
        stroke-width: 1;
        pointer-events: none;
    }

    .mark-spot.role-removing {
        fill: var(--gp-row);
    }

    .mark-spot.role-keeping {
        fill: var(--gp-keep);
    }

    .mark-spot.role-cover {
        fill: var(--gp-mark);
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 1.5;
    }

    .entering,
    .flier {
        pointer-events: none;
    }

    use {
        pointer-events: none;
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
        stroke: var(--gp-mark);
        stroke-width: 3.5;
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
        stroke: var(--gp-mark);
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
