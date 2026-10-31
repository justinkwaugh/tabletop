<script lang="ts">
    import {
        addAxial,
        Color,
        sameCoordinates,
        scaleAxial,
        type AxialCoordinates
    } from '@tabletop/common'
    import { AXES, PieceKind } from '@tabletop/matrx'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import {
        coordsKey,
        DOT_RADIUS,
        PIECE_RADIUS,
        RESERVE_DOT_RADIUS,
        RESERVE_LINE_WIDTH
    } from '$lib/board/geometry.js'
    import type { BoardDisc } from '$lib/board/boardChange.js'
    import { markGaps, turnOf, type Disc } from '$lib/board/pieceShape.js'
    import { BoardAnimator, type DrawnStack } from '$lib/animators/boardAnimator.svelte.js'
    import PieceDefs from './PieceDefs.svelte'
    import StandingStack from './StandingStack.svelte'
    import StagedPiece from './StagedPiece.svelte'

    const session = getGameSession()

    const view = $derived(session.view)
    const geometry = $derived(view.geometry)
    const frame = $derived(view.frame())
    const playArea = $derived(view.playAreaOutline())

    // Lines run dot to dot across the play area; the board's rim has no line between dots.
    const lines = $derived(
        AXES.flatMap((axis) =>
            geometry.points
                .filter((point) => !geometry.isPoint(addAxial(point, scaleAxial(axis, -1))))
                .flatMap((start) => {
                    const points = [start]
                    while (geometry.isPoint(addAxial(points[points.length - 1], axis))) {
                        points.push(addAxial(points[points.length - 1], axis))
                    }
                    const crossesPlay = points.some((point) => geometry.isSpot(point))
                    const end = points[points.length - 1]
                    return crossesPlay ? [{ from: view.center(start), to: view.center(end) }] : []
                })
        )
    )

    const animator = new BoardAnimator(session)
    let hoveredDot: string | undefined = $state()
    let hoveredTarget: string | undefined = $state()

    function toneOf(playerId: string): Disc['tone'] {
        return session.gameState.getPlayerState(playerId).color === Color.White ? 'light' : 'dark'
    }

    function toned(discs: readonly BoardDisc[]): Disc[] {
        return discs.map((disc) => ({
            tone: toneOf(disc.playerId),
            kind: disc.kind,
            turn: turnOf(disc.kind, disc.id)
        }))
    }

    // Each player's GIPF pieces in reserve wait on their own dot, White's near the bottom left.
    const reserves = $derived(
        session.gameState.turnManager.turnOrder.map((playerId, seat) => {
            const staged =
                session.myPlayer?.id === playerId && session.stagedKind === PieceKind.Gipf
            const count = session.gameState.getPlayerState(playerId).gipfPieces - (staged ? 1 : 0)
            return {
                playerId,
                at: view.reserveDot(seat),
                line: view.reserveLine(seat),
                discs: toned(
                    Array<BoardDisc>(Math.max(0, count)).fill({ playerId, kind: PieceKind.Gipf })
                )
            }
        })
    )

    // The stack you are about to bring in drops onto the dot you chose, until it goes in. A stack
    // Undo took back out stands there already.
    const preview = $derived.by(() => {
        if (animator.entering || animator.pushedIn) return undefined
        if (animator.returned) return { ...animator.returned, drops: false }
        const dot = session.chosenDot
        if (dot === undefined || session.stagedDiscs.length === 0) return undefined
        return { dot, discs: session.stagedDiscs, drops: true }
    })

    type Drawn =
        | { kind: 'stack'; key: string; coords: AxialCoordinates; stack: DrawnStack }
        | {
              kind: 'entering' | 'preview'
              key: string
              coords: AxialCoordinates
              discs: BoardDisc[]
              drops: boolean
          }

    // Far stacks first, so nearer stacks stand in front of them. The stack coming in is drawn at
    // its dot's depth: the line it pushes moves with it, so the order holds as it slides.
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
                key: `incoming-${coordsKey(incoming.dot)}-${incoming.discs.map((disc) => disc.kind).join()}`,
                coords: incoming.dot,
                discs: incoming.discs,
                drops: preview?.drops ?? false
            })
        }
        return drawn.toSorted((a, b) => view.center(a.coords).y - view.center(b.coords).y)
    })

    const SPOT_RADIUS = PIECE_RADIUS * 0.13
    const TOGGLE_RADIUS = PIECE_RADIUS * 0.66
    // A dashed ring's dashes and the gaps between them, as in its stroke-dasharray.
    const DASH = 5
    const DASH_GAP = 4

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
            if (inChosenRow && includesCoords(session.rowPairs, coords)) {
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

    // Everything a stack of the given height standing on a spot would cover, for clicks.
    function outline(discs: number): string {
        const r = PIECE_RADIUS
        const ry = r * view.tilt
        const top = view.topFace(Math.max(discs, 2))
        return `M ${-r} ${top} A ${r} ${ry} 0 0 1 ${r} ${top} L ${r} 0 A ${r} ${ry} 0 0 1 ${-r} 0 Z`
    }

    // A ring round a stack's top face, broken where it would cover the top disc's mark, as arcs.
    // Each arc's length is given in dash-and-gap units (DASH, DASH_GAP), so a dashed ring has
    // whole dashes evenly spaced, and a broken one a dash at each end of every arc.
    function topRing(
        discs: readonly BoardDisc[],
        radius: number,
        cy: number
    ): { d: string; length: number }[] {
        const rx = radius
        const ry = radius * view.tilt
        const [top] = toned(discs.slice(-1))
        const gaps = markGaps(top, radius / PIECE_RADIUS).toSorted((a, b) => a[0] - b[0])
        const point = (angle: number) => ({
            x: rx * Math.cos(angle),
            y: cy - ry * Math.sin(angle)
        })
        const at = (angle: number) => `${point(angle).x} ${point(angle).y}`
        const arcLength = (from: number, to: number) =>
            Array.from({ length: 48 }, (_, step) => {
                const a = point(from + ((to - from) * step) / 48)
                const b = point(from + ((to - from) * (step + 1)) / 48)
                return Math.hypot(b.x - a.x, b.y - a.y)
            }).reduce((sum, length) => sum + length, 0)
        const period = DASH + DASH_GAP
        if (gaps.length === 0) {
            const dashes = Math.max(1, Math.round(arcLength(0, 2 * Math.PI) / period))
            return [
                {
                    d: `M ${-rx} ${cy} A ${rx} ${ry} 0 1 0 ${rx} ${cy} A ${rx} ${ry} 0 1 0 ${-rx} ${cy}`,
                    length: dashes * period
                }
            ]
        }
        return gaps.map(([, end], index) => {
            const [next] = gaps[(index + 1) % gaps.length]
            const start = next + (index === gaps.length - 1 ? 2 * Math.PI : 0)
            const large = start - end > Math.PI ? 1 : 0
            const dashes = Math.max(1, Math.round((arcLength(end, start) + DASH_GAP) / period))
            return {
                d: `M ${at(end)} A ${rx} ${ry} 0 ${large} 0 ${at(start)}`,
                length: dashes * period - DASH_GAP
            }
        })
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

    // The flier passes in front of every stack it is nearer than; nearer stacks are copied over
    // it, shown only while it is behind them.
    const occluding = $derived(
        animator.flier
            ? animator.stacks.filter((stack) => !animator.flier?.passes.includes(stack.key))
            : []
    )
</script>

<svg
    class="matrx-board"
    viewBox={frame.viewBox}
    width={frame.width}
    height={frame.height}
    role="group"
    aria-label="MATRX GIPF board"
    {@attach animator.attach}
>
    <defs>
        <PieceDefs prefix="matrx-board" radius={PIECE_RADIUS} {view} />
    </defs>

    <polygon points={playArea} class="play-area"></polygon>

    <g class="lines">
        {#each lines as line, index (index)}
            <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}></line>
        {/each}
        {#each reserves as reserve (reserve.playerId)}
            <line
                x1={reserve.line.from.x}
                y1={reserve.line.from.y}
                x2={reserve.line.to.x}
                y2={reserve.line.to.y}
                style:stroke-width={RESERVE_LINE_WIDTH}
            ></line>
        {/each}
    </g>

    {#each session.notation.labels as label (label.key)}
        <text x={label.at.x} y={label.at.y} class="coordinate-label">{label.text}</text>
    {/each}

    {#each geometry.dots as coords (coordsKey(coords))}
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
                if (event.pointerType !== 'touch') hoveredDot = coordsKey(coords)
            }}
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

    {#each reserves as reserve (reserve.playerId)}
        <g transform="translate({reserve.at.x} {reserve.at.y})" class="reserve-dot">
            <ellipse rx={RESERVE_DOT_RADIUS} ry={RESERVE_DOT_RADIUS * view.tilt} class="dot-core"
            ></ellipse>
            {#if reserve.discs.length > 0}
                <StandingStack discs={reserve.discs} {view} />
            {/if}
        </g>
    {/each}

    <!-- Rings on the board: round the dots you can bring a stack in from, and round the spots
         you can push into or move to, behind whatever stands there. -->
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
        {#each session.moveTargets as coords (coordsKey(coords))}
            {@const center = view.center(coords)}
            {#if stackHeight(coords) === 0}
                <ellipse
                    cx={center.x}
                    cy={center.y}
                    rx={PIECE_RADIUS + 2}
                    ry={(PIECE_RADIUS + 2) * view.tilt}
                    class="target-ring"
                    class:hovered={hoveredTarget === coordsKey(coords)}
                ></ellipse>
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
                <g id="matrx-stack-{stack.key}" {@attach animator.stack(drawn.key, 'whole')}>
                    <StandingStack
                        discs={toned(stack.discs)}
                        {view}
                        body={animator.stack(drawn.key, 'body')}
                        shadow={animator.stack(drawn.key, 'shadow')}
                        parts={animator.parts(drawn.key)}
                    />
                </g>
                <!-- Marks lie on the top face, after the stack and outside the node that moves
                     it: a ring on a stack you can move or a row you can take, a spot on each
                     piece that goes, and on stacks of two in the chosen row a ring for keep or
                     take. The rings break where they would cover the top piece's mark. -->
                {#if role || target}
                    <g {@attach animator.marks()}>
                        {#if target}
                            {#each topRing(stack.discs, PIECE_RADIUS - 3, faceY) as arc, index (index)}
                                <path
                                    d={arc.d}
                                    pathLength={arc.length}
                                    class="top-ring role-target"
                                    class:hovered={hoveredTarget === drawn.key}
                                ></path>
                            {/each}
                        {:else if role === 'row' || role === 'movable' || role === 'chosen'}
                            {#each topRing(stack.discs, PIECE_RADIUS - 3, faceY) as arc, index (index)}
                                <path d={arc.d} pathLength={arc.length} class="top-ring role-{role}"
                                ></path>
                            {/each}
                        {:else}
                            {#if includesCoords(session.rowPairs, stack.coords)}
                                {#each topRing(stack.discs, TOGGLE_RADIUS, faceY) as arc, index (index)}
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
                href="#matrx-stack-{stack.key}"
                transform="translate({center.x} {center.y})"
                {@attach animator.occluder(stack)}
            ></use>
        {/each}
    {/if}

    <!-- Arrows and the targets' click areas stand above the pieces, nearer ones last. -->
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
                onpointerenter={(event) => {
                    if (event.pointerType !== 'touch') hoveredTarget = key
                }}
                onpointerleave={() => (hoveredTarget = undefined)}
                onfocus={() => (hoveredTarget = key)}
                onblur={() => (hoveredTarget = undefined)}
            >
                <path
                    d={outline(stackHeight(entry.line[0]))}
                    transform="translate({center.x} {center.y})"
                    class="target-hit"
                ></path>
                <path d={arrow(entry.dot, entry.line[0])} class="arrow"></path>
            </g>
        {/each}
        {#each session.moveTargets.toSorted((a, b) => view.center(a).y - view.center(b).y) as coords (coordsKey(coords))}
            {@const center = view.center(coords)}
            {@const key = coordsKey(coords)}
            <path
                d={outline(stackHeight(coords))}
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
    .matrx-board {
        overflow: visible;
        user-select: none;
    }

    .play-area {
        fill: var(--matrx-play);
    }

    .lines line {
        stroke: var(--matrx-line);
        stroke-width: 1.6;
    }

    .coordinate-label {
        fill: var(--matrx-label);
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
        fill: var(--matrx-line);
    }

    .dot.entry {
        cursor: pointer;
    }

    .dot-hit {
        fill: transparent;
    }

    .reserve-dot {
        pointer-events: none;
    }

    .dot-ring {
        fill: rgb(240 176 74 / 0.16);
        stroke: var(--matrx-target);
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
        stroke: var(--matrx-row);
        stroke-opacity: 0.6;
        stroke-dasharray: 5 4;
    }

    .top-ring.role-movable {
        stroke: var(--matrx-target);
        stroke-dasharray: 5 4;
    }

    .top-ring.role-chosen {
        stroke: var(--matrx-target);
        stroke-width: 3.5;
    }

    .top-ring.role-target {
        stroke: var(--matrx-target);
        stroke-dasharray: 5 4;
    }

    .top-ring.role-target.hovered {
        stroke-dasharray: none;
        stroke-width: 3.5;
    }

    .toggle-ring {
        fill: none;
        stroke-width: 3;
        pointer-events: none;
    }

    .toggle-ring.role-removing {
        stroke: var(--matrx-row);
    }

    .toggle-ring.role-keeping {
        stroke: var(--matrx-keep);
    }

    .mark-spot {
        stroke: rgb(0 0 0 / 0.35);
        stroke-width: 1;
        pointer-events: none;
    }

    .mark-spot.role-removing {
        fill: var(--matrx-row);
    }

    .mark-spot.role-keeping {
        fill: var(--matrx-keep);
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
        stroke: var(--matrx-target);
        stroke-width: 3.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .target-ring {
        fill: rgb(240 176 74 / 0.14);
        stroke: var(--matrx-target);
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
