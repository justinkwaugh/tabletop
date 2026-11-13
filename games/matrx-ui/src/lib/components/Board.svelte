<script lang="ts">
    import {
        addAxial,
        Color,
        coordinatesToNumber,
        sameCoordinates,
        scaleAxial,
        type AxialCoordinates
    } from '@tabletop/common'
    import { AXES, CENTRE, PieceKind, type Entry } from '@tabletop/matrx'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import {
        DOT_RADIUS,
        PIECE_RADIUS,
        RESERVE_DOT_RADIUS,
        RESERVE_LINE_WIDTH,
        SPACING
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

    const reserves = $derived(
        session.gameState.turnManager.turnOrder.map((playerId, seat) => {
            const staged =
                session.myPlayer?.id === playerId && session.stagedKind === PieceKind.Gipf
            const inReserve =
                animator.reserveCounts?.get(playerId) ??
                session.gameState.getPlayerState(playerId).gipfPieces
            const count = inReserve - (staged ? 1 : 0)
            return {
                playerId,
                at: view.reserveDot(seat),
                line: view.reserveLine(seat),
                discs: toned(Array<BoardDisc>(count).fill({ playerId, kind: PieceKind.Gipf }))
            }
        })
    )

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

    const FINE = SPACING / 5
    const FINE_TILE = { width: FINE * Math.sqrt(3), height: FINE }
    const fineLines = [-1, 0, 1].flatMap((k) => {
        const { width, height } = FINE_TILE
        return [
            { x1: (width / 2) * (k + 1), y1: -height, x2: (width / 2) * (k + 1), y2: 2 * height },
            { x1: -width, y1: (k - 1) * height, x2: 2 * width, y2: (k + 2) * height },
            { x1: -width, y1: (k + 2) * height, x2: 2 * width, y2: (k - 1) * height }
        ]
    })
    const tableArea = $derived.by(() => {
        const [x, y, width, height] = frame.viewBox.split(' ').map(Number)
        const spread = 0.3
        return {
            x: x - width * spread,
            y: y - height * spread,
            width: width * (1 + 2 * spread),
            height: height * (1 + 2 * spread)
        }
    })
    const centreTriangles = $derived(
        AXES.flatMap((axis) => [axis, scaleAxial(axis, -1)])
            .map((direction) => view.center(addAxial(CENTRE, direction)))
            .toSorted(
                (a, b) =>
                    Math.atan2(a.y - centre.y, a.x - centre.x) -
                    Math.atan2(b.y - centre.y, b.x - centre.x)
            )
            .map((point) => `${point.x},${point.y}`)
            .join(' ')
    )
    const TOGGLE_RADIUS = PIECE_RADIUS * 0.66
    const DASH = 5
    const DASH_GAP = 4

    const chosen = $derived(session.chosenFrom !== undefined || session.chosenDot !== undefined)

    function onBoardClick(event: MouseEvent) {
        const target = event.target
        const choosable = '[role="button"]:not([aria-disabled="true"])'
        if (target instanceof Element && target.closest(choosable)) return
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

    function outline(discs: number): string {
        const r = PIECE_RADIUS
        const ry = r * view.tilt
        const top = view.topFace(Math.max(discs, 2))
        return `M ${-r} ${top} A ${r} ${ry} 0 0 1 ${r} ${top} L ${r} 0 A ${r} ${ry} 0 0 1 ${-r} 0 Z`
    }

    // In dash-and-gap units: whole dashes round a ring, and a dash at each end of a broken arc.
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

    // The tilt shortens an arrow pointing up or down the screen more than one along a slanted line,
    // so each starts as far from its dot on screen as an upright one does.
    const ARROW_START = DOT_RADIUS * 2 + 12
    const ARROW_REACH = 24
    function arrow(from: AxialCoordinates, to: AxialCoordinates): string {
        const start = view.center(from)
        const end = view.center(to)
        const flat = (x: number, y: number) => `${x} ${y * view.tilt}`
        const [sx, sy, ex, ey] = [start.x, start.y / view.tilt, end.x, end.y / view.tilt]
        const length = Math.hypot(ex - sx, ey - sy)
        const ux = (ex - sx) / length
        const uy = (ey - sy) / length
        const tipX = ex - ux * (PIECE_RADIUS + 2 - ARROW_REACH)
        const tipY = ey - uy * (PIECE_RADIUS + 2 - ARROW_REACH)
        const tail = (ARROW_START * view.tilt) / Math.hypot(ux, uy * view.tilt)
        const baseX = sx + ux * tail
        const baseY = sy + uy * tail
        const wing = 8
        return `M ${flat(baseX, baseY)} L ${flat(tipX, tipY)} M ${flat(tipX - ux * wing - uy * wing, tipY - uy * wing + ux * wing)} L ${flat(tipX, tipY)} L ${flat(tipX - ux * wing + uy * wing, tipY - uy * wing - ux * wing)}`
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
    class="matrx-board"
    viewBox={frame.viewBox}
    width={frame.width}
    height={frame.height}
    role="group"
    aria-label="MATRX GIPF board"
    onclick={onBoardClick}
    {@attach animator.attach}
>
    <defs>
        <PieceDefs prefix="matrx-board" />
        <pattern
            id="matrx-board-fine"
            patternUnits="userSpaceOnUse"
            width={FINE_TILE.width}
            height={FINE_TILE.height}
            patternTransform="translate({centre.x} {centre.y}) scale(1 {view.tilt})"
        >
            {#each fineLines as line, index (index)}
                <line {...line} class="fine-line"></line>
            {/each}
        </pattern>
        <radialGradient id="matrx-board-fade">
            <stop offset="0.7" stop-color="white"></stop>
            <stop offset="1" stop-color="black"></stop>
        </radialGradient>
        <mask id="matrx-board-table-fade">
            <rect {...tableArea} fill="url(#matrx-board-fade)"></rect>
        </mask>
    </defs>

    <rect {...tableArea} class="fine" mask="url(#matrx-board-table-fade)"></rect>
    <polygon points={playArea} class="play-area"></polygon>
    <polygon points={centreTriangles} class="fine"></polygon>

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

    {#each reserves as reserve (reserve.playerId)}
        <g transform="translate({reserve.at.x} {reserve.at.y})" class="reserve-dot">
            <ellipse rx={RESERVE_DOT_RADIUS} ry={RESERVE_DOT_RADIUS * view.tilt} class="dot-core"
            ></ellipse>
            {#if reserve.discs.length > 0}
                <StandingStack
                    discs={reserve.discs}
                    {view}
                    parts={animator.reserveParts(reserve.playerId)}
                    shadow={animator.reserveShadow(reserve.playerId)}
                />
            {/if}
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
                        bodyId="matrx-stack-{stack.key}"
                        body={animator.stack(drawn.key, 'body')}
                        shadow={animator.stack(drawn.key, 'shadow')}
                        parts={animator.parts(drawn.key)}
                    />
                </g>
                {#if role || target}
                    <g {@attach animator.marks()}>
                        {#if target}
                            {#each ['under', 'over'] as layer (layer)}
                                {#each topRing(stack.discs, PIECE_RADIUS - 3, faceY) as arc, index (index)}
                                    <path
                                        d={arc.d}
                                        pathLength={arc.length}
                                        class="top-ring role-target {layer}"
                                        class:hovered={hoveredTarget === drawn.key}
                                    ></path>
                                {/each}
                            {/each}
                        {:else if role === 'row' || role === 'movable' || role === 'chosen'}
                            {#each role === 'row' ? ['over'] : ['under', 'over'] as layer (layer)}
                                {#each topRing(stack.discs, PIECE_RADIUS - 3, faceY) as arc, index (index)}
                                    <path
                                        d={arc.d}
                                        pathLength={arc.length}
                                        class="top-ring role-{role} {layer}"
                                        class:faded={chosen && role === 'movable'}
                                    ></path>
                                {/each}
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
                    d={outline(stackHeight(entry.line[0]))}
                    transform="translate({center.x} {center.y})"
                    class="target-hit"
                ></path>
            {:else}
                {#each ['under', 'over'] as layer (layer)}
                    <path d={arrow(entry.dot, entry.line[0])} class="arrow {layer}"></path>
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
                d={outline(preview.discs.length)}
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

    .fine {
        fill: url(#matrx-board-fine);
        pointer-events: none;
    }

    .fine-line {
        stroke: var(--matrx-fine);
        stroke-width: 0.35;
    }

    .lines line {
        stroke: var(--matrx-line);
        stroke-width: 1.6;
    }

    .station ellipse {
        fill: none;
        stroke: var(--matrx-line);
        stroke-width: 1.6;
    }

    .station ellipse.hub {
        fill: var(--matrx-play);
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
        stroke: var(--matrx-mark);
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
        stroke: var(--matrx-row);
        stroke-opacity: 0.6;
        stroke-dasharray: 5 4;
    }

    .top-ring.role-movable.over,
    .top-ring.role-target.over {
        stroke: var(--matrx-mark);
    }

    .top-ring.role-movable.under {
        stroke-width: 4.3;
    }

    .top-ring.role-chosen.over {
        stroke: var(--matrx-mark);
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

    .top-ring.role-target.hovered.over {
        stroke-dasharray: none;
        stroke-width: 3.5;
    }

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
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .arrow.under {
        stroke-width: 5.3;
    }

    .arrow.over {
        stroke: var(--matrx-mark);
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
        stroke: var(--matrx-mark);
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
