<script lang="ts">
    import { addAxial, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import { AXES, POINTS, pointName } from '@tabletop/yinsh'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import { coordsKey, flatCenter, VIEW } from '$lib/board/geometry.js'
    import { boardLabels } from '$lib/board/coordinates.js'
    import {
        MARKER_HEIGHT,
        MARKER_RADIUS,
        RING_HEIGHT,
        RING_INNER,
        RING_OUTER
    } from '$lib/board/pieceGeometry.js'
    import { BoardAnimator, pieceId, type DrawnPiece } from '$lib/animators/boardAnimator.svelte.js'
    import { dropIn } from '$lib/board/dropIn.js'
    import { ellipsePath, markerDrawing, ringDrawing } from '$lib/board/pieceShape.js'
    import RingShape from './RingShape.svelte'
    import MarkerShape from './MarkerShape.svelte'
    import PieceDefs from './PieceDefs.svelte'
    import PieceShadow from './PieceShadow.svelte'
    import FlippingMarker from './FlippingMarker.svelte'
    import type { Tone } from '$lib/board/pieceStyle.js'

    const session = getGameSession()

    const labels = boardLabels(POINTS)
    const frame = VIEW.frame(labels.map((label) => label.at))
    const outline = VIEW.playAreaOutline()

    // Each line runs as far as consecutive points go, then a short whisker on past its end
    // points, out over the edge of the board as on the real one.
    const WHISKER = 0.15
    const beyond = (coords: AxialCoordinates, step: AxialCoordinates) => {
        const from = VIEW.center(coords)
        const to = VIEW.center(addAxial(coords, step))
        return { x: from.x + (to.x - from.x) * WHISKER, y: from.y + (to.y - from.y) * WHISKER }
    }
    const lines = AXES.flatMap((axis) => {
        const back = { q: -axis.q, r: -axis.r }
        return POINTS.filter((point) => !includesCoords(POINTS, addAxial(point, back))).map(
            (start) => {
                let end = start
                while (includesCoords(POINTS, addAxial(end, axis))) end = addAxial(end, axis)
                return { from: beyond(start, back), to: beyond(end, axis) }
            }
        )
    })

    const animator = new BoardAnimator(session)

    // Back to front, so a nearer piece's side covers the one behind it.
    const pieces = $derived(
        animator.pieces.toSorted((a, b) => flatCenter(a.coords).y - flatCenter(b.coords).y)
    )

    const sides = $derived(
        session.gameState.players.map((player) => ({
            playerId: player.playerId,
            removed: animator.removed[player.playerId] ?? [],
            slots: VIEW.ringSlots(player.playerId === session.topPlayerId ? 'top' : 'bottom').slice(
                0,
                session.gameState.ringsToWin
            )
        }))
    )

    const myTone = $derived(session.myPlayer ? session.toneOfPlayer(session.myPlayer.id) : 'white')

    type Role =
        'place' | 'destination' | 'chosen' | 'movable' | 'settle' | 'anchor' | 'row' | 'remove'

    function roleOf(coords: AxialCoordinates): Role | undefined {
        if (includesCoords(session.placeable, coords)) return 'place'
        if (session.destinations.some((move) => sameCoordinates(move.to, coords)))
            return 'destination'
        if (session.chosenFrom && sameCoordinates(session.chosenFrom, coords)) return 'chosen'
        if (includesCoords(session.movable, coords))
            return session.chosenFrom ? undefined : 'movable'
        if (session.anchor && sameCoordinates(session.anchor, coords)) return 'anchor'
        if (includesCoords(session.rowOptions.settling, coords)) return 'settle'
        if (includesCoords(session.rowOptions.reach, coords)) return 'row'
        if (includesCoords(session.removableRings, coords)) return 'remove'
        return undefined
    }

    const destinations = $derived(session.destinations.map((move) => VIEW.center(move.to)))

    // Far first, so where a nearer ring's click area overlaps the one behind it, the nearer
    // takes the click, as it stands in front.
    const clickable = $derived(
        POINTS.filter((coords) => session.isClickable(coords)).toSorted(
            (a, b) => flatCenter(a).y - flatCenter(b).y
        )
    )

    function describe(coords: AxialCoordinates): string {
        const name = pointName(coords)
        switch (roleOf(coords)) {
            case 'place':
                return `place ${name}`
            case 'destination':
                return `move to ${name}`
            case 'chosen':
                return `put back ${name}`
            case 'remove':
                return `remove ring ${name}`
            case 'settle':
            case 'anchor':
            case 'row':
                return `row ${name}`
            default:
                return `ring ${name}`
        }
    }

    function onKey(event: KeyboardEvent, act: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            act()
        }
    }

    const RING_MARK = (RING_OUTER + RING_INNER) / 2
    const MARKER_MARK = MARKER_RADIUS * 0.62
    // Where each piece's mark lies on screen: a ring's on its top, a marker's on its face, which
    // sits down inside its lip.
    const RING_FACE = -VIEW.height(RING_HEIGHT)
    const MARKER_FACE_AT = markerDrawing(VIEW, MARKER_RADIUS, MARKER_HEIGHT).wall.bottom
    // A ring's silhouette: the click area of every point, so the whole of a ring standing there
    // takes the click.
    const STANDING = ringDrawing(VIEW, RING_OUTER).outline
    // A removed ring's space, painted on the table where the ring will lie.
    const SLOT = [RING_OUTER, RING_INNER]
        .map((r) => ellipsePath({ y: 0, rx: r, ry: r * VIEW.tilt }))
        .join(' ')
    const ON_RING: ReadonlySet<Role> = new Set(['chosen', 'movable', 'remove'])
    const ON_MARKER: ReadonlySet<Role> = new Set(['settle', 'anchor', 'row'])

    function markOn(piece: DrawnPiece): Role | undefined {
        const role = roleOf(piece.coords)
        if (role === undefined) return undefined
        return (piece.kind === 'ring' ? ON_RING : ON_MARKER).has(role) ? role : undefined
    }
    const PREFIX = 'yinsh-board'
</script>

{#snippet ring(tone: Tone, seedKey: string)}
    <RingShape {tone} {seedKey} prefix={PREFIX} />
{/snippet}

{#snippet marker(tone: Tone, seedKey: string)}
    <MarkerShape {tone} {seedKey} prefix={PREFIX} />
{/snippet}

{#snippet ringShadow()}
    <PieceShadow kind="ring" prefix={PREFIX} />
{/snippet}

{#snippet drawn(piece: DrawnPiece)}
    {@const center = VIEW.center(piece.coords)}
    {@const role = markOn(piece)}
    <g transform="translate({center.x} {center.y})" class="piece" id={pieceId(piece.key)}>
        <g {@attach animator.node(piece.key)}>
            {#if piece.kind === 'ring'}
                {@render ring(session.toneOfPlayer(piece.playerId), piece.seed)}
            {:else if piece.flip}
                <FlippingMarker
                    tone={session.toneOfPlayer(piece.playerId)}
                    toTone={session.toneOfPlayer(piece.flip.toPlayerId)}
                    seedKey={piece.seed}
                    prefix={PREFIX}
                    part={animator.flipPart(piece.key)}
                />
            {:else}
                {@render marker(session.toneOfPlayer(piece.playerId), piece.seed)}
            {/if}
        </g>
        {#if piece.kind === 'ring' && session.chosenFrom && sameCoordinates(session.chosenFrom, piece.coords)}
            <!-- Rule E2: the marker goes into the chosen ring before it moves. A staged preview, so
                 a local transition; the animator owns the motion once the move is committed. -->
            {#key coordsKey(session.chosenFrom)}
                <g class="drop" in:dropIn|global>
                    {@render marker(myTone, coordsKey(piece.coords))}
                </g>
                <!-- The marker sits down in the hole, behind the ring's near half. -->
                <RingShape
                    tone={session.toneOfPlayer(piece.playerId)}
                    seedKey={piece.seed}
                    prefix={PREFIX}
                    near
                />
            {/key}
        {/if}
        <!-- Each mark lies on its own piece, after it, so nearer pieces cover it as they cover
             the piece. -->
        {#if role}
            {@const radius = piece.kind === 'ring' ? RING_MARK : MARKER_MARK}
            {#key session.gameState}
                <g class="ring role-{role}" {@attach animator.marks()}>
                    {#each ['under', 'over'] as layer (layer)}
                        <ellipse
                            cy={piece.kind === 'ring' ? RING_FACE : MARKER_FACE_AT}
                            rx={radius}
                            ry={radius * VIEW.tilt}
                            class={layer}
                        ></ellipse>
                    {/each}
                </g>
            {/key}
        {/if}
    </g>
{/snippet}

<svg
    class="yinsh-board"
    viewBox={frame.viewBox}
    width={frame.width}
    height={frame.height}
    role="group"
    aria-label="YINSH board"
    {@attach animator.attach}
>
    <defs>
        <PieceDefs prefix={PREFIX} />
    </defs>

    <polygon points={outline} class="play-area"></polygon>

    <g class="lines">
        {#each lines as line, index (index)}
            <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}></line>
        {/each}
    </g>

    {#if session.showCoordinates}
        {#each labels as label (label.key)}
            <text x={label.at.x} y={label.at.y} class="coordinate-label">{label.text}</text>
        {/each}
    {/if}

    {#each sides as side (side.playerId)}
        {#each side.slots as slot, index (index)}
            <g transform="translate({slot.x} {slot.y})">
                <path d={SLOT} fill-rule="evenodd" class="slot"></path>
                {#if index < side.removed.length}
                    {@render ringShadow()}
                    {@render ring(session.toneOfPlayer(side.playerId), side.removed[index])}
                {/if}
            </g>
        {/each}
    {/each}

    <!-- Destinations are empty points, so their spots lie on the board under every piece. -->
    {#key session.gameState}
        <g class="marks" {@attach animator.marks()}>
            {#each destinations as center, index (index)}
                <ellipse
                    cx={center.x}
                    cy={center.y}
                    rx="5.5"
                    ry={5.5 * VIEW.tilt}
                    class="spot role-destination"
                ></ellipse>
            {/each}
        </g>
    {/key}

    <g class="shadows">
        {#each pieces as piece (piece.key)}
            {@const center = VIEW.center(piece.coords)}
            <g transform="translate({center.x} {center.y})">
                <g {@attach animator.node(`${piece.key}:shadow`)}>
                    {#if piece.kind === 'ring'}
                        {@render ringShadow()}
                    {:else}
                        <PieceShadow kind="marker" prefix={PREFIX} />
                    {/if}
                </g>
            </g>
        {/each}
    </g>

    {#each pieces as piece (piece.key)}
        {@render drawn(piece)}
    {/each}

    <!-- The ring in flight: its node follows the ground, with its shadow; its body rises above.
         While it still stands around the marker it leaves, the marker shows in its hole, in
         front of the far half and behind the near half. -->
    {#if animator.flier}
        {@const flier = animator.flier}
        {@const tone = session.toneOfPlayer(flier.playerId)}
        <g transform="translate({flier.at.x} {flier.at.y})" class="flier">
            <g {@attach animator.flierPart('node')}>
                <g {@attach animator.flierPart('shadow')}>{@render ringShadow()}</g>
                <g {@attach animator.flierPart('body')}>{@render ring(tone, flier.seed)}</g>
            </g>
            {#if flier.leaves}
                <use
                    href="#{pieceId(flier.leaves)}"
                    transform="translate({-flier.at.x} {-flier.at.y})"
                    {@attach animator.flierPart('left')}
                ></use>
                <g {@attach animator.flierPart('nearNode')}>
                    <g {@attach animator.flierPart('nearBody')}>
                        <RingShape {tone} seedKey={flier.seed} prefix={PREFIX} near />
                    </g>
                </g>
            {/if}
        </g>
        <g class="occluders" aria-hidden="true">
            {#each pieces as piece (piece.key)}
                {#if piece.key !== flier.leaves}
                    <use
                        href="#{pieceId(piece.key)}"
                        {@attach animator.occluder(VIEW.center(piece.coords).y)}
                    ></use>
                {/if}
            {/each}
        </g>
    {/if}

    <g class="targets">
        {#each clickable as coords (coordsKey(coords))}
            {@const center = VIEW.center(coords)}
            <path
                d={STANDING}
                transform="translate({center.x} {center.y})"
                class="target"
                role="button"
                tabindex="0"
                aria-label={describe(coords)}
                onclick={() => session.choosePoint(coords)}
                onkeydown={(event) => onKey(event, () => session.choosePoint(coords))}
            ></path>
        {/each}
    </g>
</svg>

<style>
    .yinsh-board {
        overflow: visible;
        user-select: none;
    }

    .play-area {
        fill: var(--yinsh-play);
        stroke: var(--yinsh-play-edge);
        stroke-width: 2;
        stroke-linejoin: round;
    }

    .lines line {
        stroke-linecap: butt;
        stroke: var(--yinsh-line);
        stroke-opacity: var(--yinsh-line-opacity);
        stroke-width: 1.4;
    }

    .coordinate-label {
        fill: var(--yinsh-label);
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
    }

    /* Painted on the table in the board's own pale color, as on the real board. */
    .slot {
        fill: var(--yinsh-play);
        opacity: 0.7;
    }

    .piece,
    .flier,
    .occluders,
    .marks {
        pointer-events: none;
    }

    /* Two-tone, a dark band under a bright core, so a mark reads on white and black alike. */
    .ring ellipse {
        fill: none;
    }

    .ring .under {
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 3.4;
    }

    .ring .over {
        stroke: var(--yinsh-mark);
        stroke-width: 1.8;
    }

    .ring.role-chosen .under,
    .ring.role-anchor .under {
        stroke-width: 4.4;
    }

    .ring.role-chosen .over,
    .ring.role-anchor .over {
        stroke-width: 2.6;
    }

    .ring.role-row .over,
    .ring.role-remove .over {
        stroke-dasharray: 5 3.5;
    }

    .ring.role-remove .over {
        stroke: var(--yinsh-remove);
    }

    /* Each orange dash outlined on its own, as LYNGK's landings are: the black dashes are
       shorter but square-capped, so they overhang each orange dash by the outline width at
       both ends and leave the ring showing between dashes. */
    .ring.role-remove .under {
        stroke: #000;
        stroke-dasharray: 2.8 5.7;
        stroke-dashoffset: -1.1;
        stroke-linecap: square;
    }

    .spot {
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 1.4;
    }

    .spot.role-destination {
        fill: var(--yinsh-mark);
    }

    /* The drop scales about the marker's own middle, not the board's origin. */
    .drop {
        transform-box: fill-box;
        transform-origin: center;
    }

    .target {
        fill: transparent;
        cursor: pointer;
        outline: none;
    }

    .target:focus-visible {
        stroke: var(--yinsh-mark);
        stroke-width: 1.4;
    }
</style>
