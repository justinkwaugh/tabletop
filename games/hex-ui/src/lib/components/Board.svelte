<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        HEX_PATH,
        LABEL_SIZE,
        LAST_MOVE,
        isIsolated,
        makeBoardView,
        SPREAD_PATH,
        SPACING,
        TILE_INSET,
        TILE_PATH
    } from '$lib/board/geometry.js'
    import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'

    const session = getGameSession()
    // Full screen draws a second board in its dialog; each names its own clips.
    const uid = $props.id()

    // Seen across, as HexWiki draws it, or turned a quarter to stand upright.
    const layout = $derived(makeBoardView(session.gameState.board.size, session.upright))

    const animator = new BoardAnimator(session)

    // Trial looks, chosen in the harness by ?look=A|B|C|D: A lines, B tiles, C lines on a slab,
    // D tiles on a slab.
    const look =
        (typeof location === 'undefined'
            ? null
            : new URL(location.href).searchParams.get('look')) ?? 'B'
    const tiles = look === 'B' || look === 'D'
    const slab = look === 'C' || look === 'D'
    const CELL = tiles ? TILE_PATH : HEX_PATH

    let hovered: string | undefined = $state()
    const hoverColor = $derived(session.myPlayer ? session.colorOf(session.myPlayer.id) : undefined)

    function onPointerEnter(event: PointerEvent, cell: string) {
        // A tap fires enter and leave round its click; only a real pointer hovers.
        if (event.pointerType === 'touch') return
        hovered = cell
    }

    function onKey(event: KeyboardEvent, cell: string) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            place(cell)
        }
    }

    // The faint fill under the pointer goes as the real one flows in.
    function place(cell: string) {
        hovered = undefined
        session.placeStone(cell)
    }
</script>

<svg
    class="hex-board"
    viewBox={layout.viewBox}
    width={layout.frame.width}
    height={layout.frame.height}
    role="group"
    aria-label="Hex board"
    {@attach animator.attach}
>
    <defs>
        <clipPath id="hex-cell-{uid}">
            <path d={CELL}></path>
        </clipPath>
        <!-- Blurred and cut back to a hard edge, discs that meet run together. Sized to a cell. -->
        <filter
            id="hex-goo-{uid}"
            filterUnits="userSpaceOnUse"
            x={-SPACING}
            y={-SPACING}
            width={SPACING * 2}
            height={SPACING * 2}
            color-interpolation-filters="sRGB"
        >
            <feGaussianBlur stdDeviation="3"></feGaussianBlur>
            <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10"></feColorMatrix>
        </filter>
    </defs>
    {#if slab}
        <!-- The board's shadow on the table, then its side below its top. -->
        {#each [14, 8, 4] as reach (reach)}
            <g transform="translate({reach * 0.4} {reach * 0.9})">
                <path
                    d={layout.outline}
                    transform={layout.transform}
                    class="slab-shadow"
                    stroke-width={reach}
                ></path>
            </g>
        {/each}
        <g transform="translate(0 7)">
            <path d={layout.outline} transform={layout.transform} class="slab-side"></path>
        </g>
    {/if}
    <g transform={layout.transform}>
        {#if tiles}
            <path d={layout.outline} class="tile-ground"></path>
            {#each layout.bands as band (band.edge)}
                <path d={band.path} class="band {band.color}"></path>
            {/each}
            <!-- Grooves between the bands and the cells, between the bands, and round the board,
                 as wide as those between tiles. -->
            <path d={layout.seams} class="seam" stroke-width={TILE_INSET * 2}></path>
            <path d={layout.outline} class="seam" stroke-width={TILE_INSET * 2}></path>
        {:else}
            {#each layout.bands as band (band.edge)}
                <path d={band.path} class="band {band.color}"></path>
            {/each}
            <path d={layout.outline} class="rim"></path>
        {/if}
        {#if tiles}
            {#each layout.grid.cells as cell (cell)}
                {@const at = layout.center(cell)}
                <path d={TILE_PATH} transform="translate({at.x} {at.y})" class="tile"></path>
            {/each}
        {:else}
            <path d={layout.lines} class="ground"></path>
        {/if}

        {#each animator.stones as stone (stone.id)}
            {@const at = layout.center(stone.cell)}
            {@const growth = animator.growing.get(stone.id)}
            <g transform="translate({at.x} {at.y})" class="stone">
                {#if growth === undefined}
                    <path d={CELL} class="fill {stone.color}"></path>
                {:else}
                    <g clip-path="url(#hex-cell-{uid})">
                        {#if isIsolated(growth)}
                            <!-- Spreading from the centre, a rounded hexagon, crisp: with nothing
                                 to run into, it needs no goo. -->
                            <path
                                d={SPREAD_PATH}
                                class="fill {stone.color}"
                                {@attach animator.front(stone.id, 0)}
                            ></path>
                        {:else}
                            <!-- Discs of fill that run together like a liquid where they meet. -->
                            <g filter="url(#hex-goo-{uid})">
                                {#each growth.origins as origin, index (index)}
                                    <circle
                                        cx={origin.x}
                                        cy={origin.y}
                                        r="0"
                                        class="fill {stone.color}"
                                        {@attach animator.front(stone.id, index)}
                                    ></circle>
                                {/each}
                            </g>
                        {/if}
                    </g>
                {/if}
            </g>
        {/each}

        {#if hovered && hoverColor && session.placeable.has(hovered) && !session.updatingVisibleState}
            {@const at = layout.center(hovered)}
            <path d={CELL} transform="translate({at.x} {at.y})" class="fill ghost {hoverColor}"
            ></path>
        {/if}

        {#if !tiles}
            <path d={layout.lines} class="lines"></path>
        {/if}

        {#each animator.stones as stone (stone.id)}
            {@const mark = animator.marks.get(stone.id)}
            {#if mark}
                {@const at = layout.center(stone.cell)}
                <g transform="translate({at.x} {at.y})">
                    <g {@attach animator.mark(stone.id)} class="mark {mark}">
                        {#if mark === 'won'}
                            <circle r={SPACING * 0.19} class="under"></circle>
                            <circle r={SPACING * 0.13} class="over"></circle>
                        {:else}
                            <path d={LAST_MOVE.path} stroke-width={LAST_MOVE.width}></path>
                        {/if}
                    </g>
                </g>
            {/if}
        {/each}

        <g class="targets">
            {#each layout.grid.cells as cell (cell)}
                {#if session.placeable.has(cell)}
                    {@const at = layout.center(cell)}
                    <path
                        d={HEX_PATH}
                        transform="translate({at.x} {at.y})"
                        class="target"
                        role="button"
                        tabindex="0"
                        aria-label="place on {cell}"
                        onclick={() => place(cell)}
                        onkeydown={(event) => onKey(event, cell)}
                        onpointerenter={(event) => onPointerEnter(event, cell)}
                        onpointerleave={() => (hovered = undefined)}
                    ></path>
                {/if}
            {/each}
        </g>
    </g>

    {#if session.showCoordinates}
        {#each layout.labels as label (label.key)}
            <text x={label.at.x} y={label.at.y} dy={LABEL_SIZE * 0.35} class="coordinate-label"
                >{label.text}</text
            >
        {/each}
    {/if}
</svg>

<style>
    .hex-board {
        overflow: visible;
        user-select: none;
    }

    .band,
    .rim,
    .ground,
    .lines,
    .stone,
    .ghost,
    .mark {
        pointer-events: none;
    }

    .band.red,
    .fill.red {
        fill: var(--hex-red);
    }

    .band.blue,
    .fill.blue {
        fill: var(--hex-blue);
    }

    .rim {
        fill: none;
        stroke: var(--hex-line);
        stroke-width: 1.2;
        stroke-linejoin: round;
    }

    .slab-shadow {
        fill: rgb(40 30 15 / 0.07);
        stroke: rgb(40 30 15 / 0.07);
        stroke-linejoin: round;
        pointer-events: none;
    }

    .slab-side {
        fill: #3b3732;
        stroke: #3b3732;
        stroke-width: 2.4;
        stroke-linejoin: round;
        pointer-events: none;
    }

    .tile-ground {
        fill: #44403a;
        pointer-events: none;
    }

    .seam {
        fill: none;
        stroke: #44403a;
        stroke-linejoin: round;
        stroke-linecap: round;
        pointer-events: none;
    }

    .tile {
        fill: var(--hex-cell);
        pointer-events: none;
    }

    .ground {
        fill: var(--hex-cell);
    }

    .lines {
        fill: none;
        stroke: var(--hex-line);
        stroke-width: 1.2;
        stroke-linejoin: round;
    }

    .ghost {
        opacity: 0.45;
    }

    /* Centred by `dy` on the alphabetic baseline, and spaced in user units: WebKit misplaces a
       central baseline and Safari em lengths under the board's zoom. */
    .coordinate-label {
        fill: var(--hex-label);
        font-size: 17px;
        font-weight: 600;
        letter-spacing: 0.68px;
        text-anchor: middle;
        pointer-events: none;
    }

    /* The latest move's hexagon outline is white; the winning chain's marks are two-tone, a dark
       band under a bright core. */
    .mark.last {
        fill: none;
        stroke: #fbfaf6;
        stroke-linejoin: round;
    }

    .mark.won .under {
        fill: rgb(0 0 0 / 0.8);
    }

    .mark.won .over {
        fill: var(--hex-mark);
    }

    .target {
        fill: transparent;
        cursor: pointer;
        outline: none;
    }

    .target:focus-visible {
        stroke: var(--hex-mark);
        stroke-width: 2;
    }
</style>
