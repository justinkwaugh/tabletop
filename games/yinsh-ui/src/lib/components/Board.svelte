<script lang="ts">
    import { addAxial, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import { AXES, POINTS, pointName } from '@tabletop/yinsh'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { includesCoords } from '$lib/model/session.svelte.js'
    import {
        boardOutline,
        coordsKey,
        pointCenter,
        ringSlots,
        viewBox
    } from '$lib/board/geometry.js'
    import { boardLabels } from '$lib/board/coordinates.js'
    import {
        MARKER_RADIUS,
        MARKER_SIDE,
        RING_INNER,
        RING_OUTER,
        RING_SIDE
    } from '$lib/board/pieceGeometry.js'
    import { BoardAnimator, type DrawnPiece } from '$lib/animators/boardAnimator.svelte.js'
    import { dropIn } from '$lib/board/dropIn.js'
    import RingShape from './RingShape.svelte'
    import MarkerShape from './MarkerShape.svelte'

    const session = getGameSession()

    const frame = viewBox()
    const outline = boardOutline()
    const labels = boardLabels(POINTS)

    // Each line runs as far as consecutive points go.
    // Each line runs as far as consecutive points go, then a short whisker on past its end
    // points, out over the edge of the board as on the real one.
    const WHISKER = 0.15
    const beyond = (coords: AxialCoordinates, step: AxialCoordinates) => {
        const from = pointCenter(coords)
        const to = pointCenter(addAxial(coords, step))
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
        animator.pieces.toSorted((a, b) => pointCenter(a.coords).y - pointCenter(b.coords).y)
    )

    const sides = $derived(
        session.gameState.players.map((player) => ({
            playerId: player.playerId,
            removed: animator.ringsRemoved[player.playerId] ?? 0,
            slots: ringSlots(player.playerId === session.topPlayerId ? 'top' : 'bottom').slice(
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

    const marks = $derived(
        POINTS.flatMap((coords) => {
            const role = roleOf(coords)
            return role ? [{ coords, role, center: pointCenter(coords) }] : []
        })
    )

    const clickable = $derived(POINTS.filter((coords) => session.isClickable(coords)))

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
</script>

{#snippet drawn(piece: DrawnPiece)}
    {@const center = pointCenter(piece.coords)}
    <g transform="translate({center.x} {center.y})" class="piece">
        <g {@attach animator.node(piece.key)}>
            {#if piece.kind === 'ring'}
                <RingShape
                    tone={session.toneOfPlayer(piece.playerId)}
                    seedKey={coordsKey(piece.coords)}
                />
            {:else if piece.flip}
                {#each [{ face: 'front', playerId: piece.playerId }, { face: 'back', playerId: piece.flip.toPlayerId }] as side (side.face)}
                    <g
                        {@attach animator.flipFace(
                            `${piece.key}:${side.face}`,
                            piece.flip.angle,
                            side.face === 'back'
                        )}
                    >
                        <g transform="rotate({-piece.flip.angle})">
                            <MarkerShape
                                tone={session.toneOfPlayer(side.playerId)}
                                seedKey={coordsKey(piece.coords)}
                            />
                        </g>
                    </g>
                {/each}
            {:else}
                <MarkerShape
                    tone={session.toneOfPlayer(piece.playerId)}
                    seedKey={coordsKey(piece.coords)}
                />
            {/if}
        </g>
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
        <filter id="yinsh-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4"></feGaussianBlur>
        </filter>
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
                <circle r={RING_OUTER} class="slot"></circle>
                <circle r={RING_INNER} class="slot"></circle>
                {#if index < side.removed}
                    <RingShape
                        tone={session.toneOfPlayer(side.playerId)}
                        seedKey="slot-{side.playerId}-{index}"
                    />
                {/if}
            </g>
        {/each}
    {/each}

    <g class="shadows" filter="url(#yinsh-shadow)">
        {#each pieces as piece (piece.key)}
            {@const center = pointCenter(piece.coords)}
            <g transform="translate({center.x} {center.y})">
                <g {@attach animator.node(`${piece.key}:shadow`)}>
                    {#if piece.kind === 'ring'}
                        <circle
                            cx="1.5"
                            cy={RING_SIDE + 2}
                            r={RING_MARK}
                            stroke-width={RING_OUTER - RING_INNER}
                            class="shadow-ring"
                        ></circle>
                    {:else}
                        <circle cx="1.2" cy={MARKER_SIDE + 1.6} r={MARKER_RADIUS} class="shadow"
                        ></circle>
                    {/if}
                </g>
            </g>
        {/each}
    </g>

    <!-- A marker turning over is drawn above the ring in flight: it pops up and turns as the
         ring slides beneath it. -->
    {#each pieces.filter((piece) => !piece.flip) as piece (piece.key)}
        {@render drawn(piece)}
    {/each}

    <!-- Rule E2: the marker goes into the chosen ring before it moves. A staged preview, so a
         local transition; the animator owns the motion once the move is committed. -->
    {#if session.chosenFrom}
        {@const center = pointCenter(session.chosenFrom)}
        {#key coordsKey(session.chosenFrom)}
            <g transform="translate({center.x} {center.y})" class="preview">
                <g class="drop" in:dropIn|global>
                    <MarkerShape tone={myTone} seedKey={coordsKey(session.chosenFrom)} />
                </g>
            </g>
        {/key}
    {/if}

    {#key session.gameState}
        <g class="marks" {@attach animator.marks()}>
            {#each marks as mark (coordsKey(mark.coords))}
                {#if mark.role === 'place'}
                    <!-- Every vacant point takes a ring, so none is marked. -->
                {:else if mark.role === 'destination'}
                    <circle
                        cx={mark.center.x}
                        cy={mark.center.y}
                        r="5.5"
                        class="spot role-destination"
                    ></circle>
                {:else}
                    {@const radius =
                        mark.role === 'settle' || mark.role === 'anchor' || mark.role === 'row'
                            ? MARKER_MARK
                            : RING_MARK}
                    <g class="ring role-{mark.role}">
                        {#each ['under', 'over'] as layer (layer)}
                            <circle cx={mark.center.x} cy={mark.center.y} r={radius} class={layer}
                            ></circle>
                        {/each}
                    </g>
                {/if}
            {/each}
        </g>
    {/key}

    {#if animator.flier}
        {@const center = pointCenter(animator.flier.at)}
        <g transform="translate({center.x} {center.y})" class="flier">
            <g {@attach animator.flierNode()}>
                <circle
                    cx="1.5"
                    cy={RING_SIDE + 2}
                    r={RING_MARK}
                    stroke-width={RING_OUTER - RING_INNER}
                    class="shadow-ring"
                    filter="url(#yinsh-shadow)"
                ></circle>
                <RingShape
                    tone={session.toneOfPlayer(animator.flier.playerId)}
                    seedKey={coordsKey(animator.flier.at)}
                />
            </g>
        </g>
    {/if}

    {#each pieces.filter((piece) => piece.flip) as piece (piece.key)}
        {@render drawn(piece)}
    {/each}

    <g class="targets">
        {#each clickable as coords (coordsKey(coords))}
            {@const center = pointCenter(coords)}
            <circle
                cx={center.x}
                cy={center.y}
                r={RING_OUTER}
                class="target"
                role="button"
                tabindex="0"
                aria-label={describe(coords)}
                onclick={() => session.choosePoint(coords)}
                onkeydown={(event) => onKey(event, () => session.choosePoint(coords))}
            ></circle>
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

    .slot {
        fill: none;
        stroke: var(--yinsh-slot);
        stroke-width: 1.4;
    }

    .shadow {
        fill: rgb(0 0 0 / 0.35);
    }

    .shadow-ring {
        fill: none;
        stroke: rgb(0 0 0 / 0.35);
    }

    .piece,
    .flier,
    .preview,
    .marks {
        pointer-events: none;
    }

    /* Two-tone, a dark band under a bright core, so a mark reads on white and black alike. */
    .ring circle {
        fill: none;
    }

    .ring .under {
        stroke: rgb(0 0 0 / 0.8);
        stroke-width: 4.6;
    }

    .ring .over {
        stroke: var(--yinsh-mark);
        stroke-width: 2.4;
    }

    .ring.role-chosen .under,
    .ring.role-anchor .under {
        stroke-width: 5.6;
    }

    .ring.role-chosen .over,
    .ring.role-anchor .over {
        stroke-width: 3.4;
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
