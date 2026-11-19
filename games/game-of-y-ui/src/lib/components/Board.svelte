<script lang="ts">
    import { neighborsOf, POINTS, type Stone } from '@tabletop/game-of-y'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardView, LABEL_SIZE, linesOf, STONE_RADIUS } from '$lib/board/geometry.js'
    import { EDGE_LOOK, stoneBox, stoneLook, woodLook } from '$lib/board/looks.js'
    import { LOOK_URLS } from '$lib/board/lookUrls.js'
    import { domeHeight, domeRing } from '$lib/board/stoneShape.js'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
    import { keepStonesDecoded } from '$lib/board/decodedStones.js'
    import { stoneOffsets } from '$lib/board/jitter.js'

    const session = getGameSession()

    // Seen from the near side of the table, or flat from straight above.
    const layout = $derived(boardView(session.flatBoard))

    const animator = new BoardAnimator(session)

    const linePath = $derived(
        linesOf(neighborsOf, layout.tilt)
            .map(
                ([a, b]) =>
                    `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
            )
            .join(' ')
    )

    // How far a loose stone may sit off its point, seen from above.
    const LOOSE_REACH = 10

    const offsets = $derived(
        session.looseStones ? stoneOffsets(animator.stones, LOOSE_REACH) : new Map()
    )

    // Where a stone rests on screen: on its point, or a little off it when stones lie loose.
    function restingAt(stone: Stone) {
        const at = layout.center(stone.point)
        const offset = offsets.get(stone.id)
        return offset ? { x: at.x + offset.x, y: at.y + offset.y * layout.tilt } : at
    }

    // Back to front, so a nearer stone covers the one behind it.
    const stones = $derived(
        animator.stones
            .map((stone) => ({ stone, at: restingAt(stone) }))
            .toSorted((a, b) => a.at.y - b.at.y || a.at.x - b.at.x)
    )

    const look = $derived(stoneBox(layout.tilt))
    const wood = $derived(layout.woodBox)
    // Rings painted on the stone's top dome, following its curve: a band 0.15 of the radius wide
    // round a line 0.48 out; the winning chain's cyan band lies on a wider dark one.
    const RING_LINE = STONE_RADIUS * 0.48
    const RING_HALF = STONE_RADIUS * 0.075
    const RING_MIDDLE = $derived(-domeHeight(RING_LINE) * layout.rise)
    const LAST_RING = $derived(domeRing(RING_LINE - RING_HALF, RING_LINE + RING_HALF, layout.tilt))
    const WON_RING = $derived({
        under: domeRing(RING_LINE - RING_HALF * 1.5, RING_LINE + RING_HALF * 1.5, layout.tilt),
        over: domeRing(RING_LINE - RING_HALF, RING_LINE + RING_HALF, layout.tilt)
    })

    let hovered: string | undefined = $state()
    const hoverColor = $derived(session.myPlayer ? session.colorOf(session.myPlayer.id) : undefined)

    function onPointerEnter(event: PointerEvent, point: string) {
        // A tap fires enter and leave round its click; only a real pointer hovers.
        if (event.pointerType === 'touch') return
        hovered = point
    }

    function onKey(event: KeyboardEvent, point: string) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            place(point)
        }
    }

    // The faint stone under the pointer goes as the real one drops in.
    function place(point: string) {
        hovered = undefined
        session.placeStone(point)
    }
</script>

{#snippet stoneDrawing(stone: Stone, ghost: boolean)}
    <g {@attach ghost ? undefined : animator.stone(stone.id, 'shadow')}>
        <ellipse
            cx="3"
            cy="3"
            rx={STONE_RADIUS + 3}
            ry={(STONE_RADIUS + 3) * layout.tilt}
            fill="url(#y-stone-shadow)"
        ></ellipse>
    </g>
    <g {@attach ghost ? undefined : animator.stone(stone.id, 'body')}>
        <image
            href={LOOK_URLS[stoneLook(stone.color, layout.flat)]}
            x={look.x}
            y={look.y}
            width={look.width}
            height={look.height}
        ></image>
        {#if !ghost}
            {@const ring = animator.rings.get(stone.id)}
            {#if ring}
                <!-- Scaled about the ring's middle as it grows in and shrinks away. -->
                <g transform="translate(0 {RING_MIDDLE})">
                    <g {@attach animator.ring(stone.id)}>
                        <g transform="translate(0 {-RING_MIDDLE})" class="mark {ring}">
                            {#if ring === 'won'}
                                <path d={WON_RING.under} class="under"></path>
                                <path d={WON_RING.over} class="over"></path>
                            {:else}
                                <!-- The latest stone carries a ring in the other stone's colour. -->
                                <path d={LAST_RING} class="on-{stone.color}"></path>
                            {/if}
                        </g>
                    </g>
                </g>
            {/if}
        {/if}
    </g>
{/snippet}

<svg
    class="y-board"
    viewBox={layout.viewBox}
    width={layout.frame.width}
    height={layout.frame.height}
    role="group"
    aria-label="Game of Y board"
    {@attach animator.attach}
    {@attach keepStonesDecoded}
>
    <defs>
        <clipPath id="y-wood-clip">
            <path d={layout.outline}></path>
        </clipPath>
        <clipPath id="y-slab-clip">
            <path d={layout.slab}></path>
        </clipPath>
        <!-- Soft shadows as gradients rather than a blur filter: WebKit leaves the pixels of a
             removed piece under a filter on screen until something else repaints there. -->
        <radialGradient id="y-stone-shadow">
            <stop offset="0.55" stop-color="#2a1a08" stop-opacity="0.42"></stop>
            <stop offset="1" stop-color="#2a1a08" stop-opacity="0"></stop>
        </radialGradient>
        <!-- The edge lit from the left, turning into shade towards the right. -->
        <linearGradient id="y-edge-light" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#fff" stop-opacity="0.16"></stop>
            <stop offset="0.45" stop-color="#fff" stop-opacity="0"></stop>
            <stop offset="1" stop-color="#2a1404" stop-opacity="0.22"></stop>
        </linearGradient>
    </defs>

    <!-- The board's shadow on the table, in a few soft steps. -->
    <g class="board-shadow">
        {#each [10, 6, 3] as reach (reach)}
            <path
                d={layout.slab}
                transform="translate({reach * 0.5} {reach * 0.7})"
                fill="#3a2410"
                fill-opacity="0.07"
                stroke="#3a2410"
                stroke-opacity="0.07"
                stroke-width={reach}
                stroke-linejoin="round"
            ></path>
        {/each}
    </g>
    {#if !layout.flat}
        <image
            href={LOOK_URLS[EDGE_LOOK]}
            x={layout.edgeBox.x}
            y={layout.edgeBox.y}
            width={layout.edgeBox.width}
            height={layout.edgeBox.height}
            clip-path="url(#y-slab-clip)"
            preserveAspectRatio="none"
            class="wood"
        ></image>
        <path d={layout.slab} fill="url(#y-edge-light)" class="wood"></path>
    {/if}
    <image
        href={LOOK_URLS[woodLook(layout.flat)]}
        x={wood.x}
        y={wood.y}
        width={wood.width}
        height={wood.height}
        clip-path="url(#y-wood-clip)"
        preserveAspectRatio="none"
        class="wood"
    ></image>
    <path d={layout.outline} class="rim"></path>
    <path d={linePath} class="lines"></path>

    {#if session.showCoordinates}
        {#each layout.labels as label (label.key)}
            <text x={label.at.x} y={label.at.y} dy={LABEL_SIZE * 0.35} class="coordinate-label"
                >{label.text}</text
            >
        {/each}
    {/if}

    {#each stones as { stone, at } (stone.id)}
        <g transform="translate({at.x} {at.y})" class="stone">
            {@render stoneDrawing(stone, false)}
        </g>
    {/each}

    {#if hovered && hoverColor && session.placeable.has(hovered) && !session.updatingVisibleState}
        {@const at = layout.center(hovered)}
        <g transform="translate({at.x} {at.y})" class="ghost">
            {@render stoneDrawing({ id: -1, point: hovered, color: hoverColor }, true)}
        </g>
    {/if}

    <g class="targets">
        {#each POINTS as point (point)}
            {#if session.placeable.has(point)}
                {@const at = layout.center(point)}
                <ellipse
                    cx={at.x}
                    cy={at.y}
                    rx={STONE_RADIUS}
                    ry={STONE_RADIUS * layout.tilt}
                    class="target"
                    role="button"
                    tabindex="0"
                    aria-label="place on {point}"
                    onclick={() => place(point)}
                    onkeydown={(event) => onKey(event, point)}
                    onpointerenter={(event) => onPointerEnter(event, point)}
                    onpointerleave={() => (hovered = undefined)}
                ></ellipse>
            {/if}
        {/each}
    </g>
</svg>

<style>
    .y-board {
        overflow: visible;
        user-select: none;
    }

    .board-shadow,
    .wood,
    .rim,
    .lines,
    .stone,
    .ghost {
        pointer-events: none;
    }

    /* The crisp arris round the top catching the light. */
    .rim {
        fill: none;
        stroke: #f6deaa;
        stroke-opacity: 0.7;
        stroke-width: 1;
    }

    .lines {
        fill: none;
        stroke: var(--y-line);
        stroke-width: 1.3;
        stroke-linecap: round;
    }

    /* Centred by `dy` on the alphabetic baseline, and spaced in user units: WebKit misplaces a
       central baseline and Safari em lengths under the board's zoom. */
    /* Printed on the rim of the board, in a dark ink sunk a little into the wood. */
    .coordinate-label {
        fill: var(--y-label);
        fill-opacity: 0.82;
        font-size: 17px;
        font-weight: 600;
        letter-spacing: 0.68px;
        text-anchor: middle;
        pointer-events: none;
    }

    .ghost {
        opacity: 0.5;
    }

    /* The winning chain's rings are two-tone, a dark band under a bright core. */
    .mark {
        pointer-events: none;
        fill-rule: evenodd;
    }

    .mark .on-black {
        fill: #f1eee7;
    }

    .mark .on-white {
        fill: #1b1b1d;
    }

    .mark.won .under {
        fill: rgb(0 0 0 / 0.8);
    }

    .mark.won .over {
        fill: var(--y-mark);
    }

    .target {
        fill: transparent;
        cursor: pointer;
        outline: none;
    }

    .target:focus-visible {
        stroke: var(--y-mark);
        stroke-width: 1.6;
    }
</style>
