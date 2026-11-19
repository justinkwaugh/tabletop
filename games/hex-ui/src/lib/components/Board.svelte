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
            <path d={TILE_PATH}></path>
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
    <g transform={layout.transform}>
        <!-- Rounded tiles on a dark ground, which shows as grooves between them. -->
        <path d={layout.outline} class="ground"></path>
        {#each layout.bands as band (band.edge)}
            <path d={band.path} class="band {band.color}"></path>
        {/each}
        <!-- Grooves between the bands and the cells, between the bands, and round the board, as
             wide as those between tiles. -->
        <path d={layout.seams} class="seam" stroke-width={TILE_INSET * 2}></path>
        <path d={layout.outline} class="seam" stroke-width={TILE_INSET * 2}></path>
        {#each layout.grid.cells as cell (cell)}
            {@const at = layout.center(cell)}
            <path d={TILE_PATH} transform="translate({at.x} {at.y})" class="tile"></path>
        {/each}

        {#each animator.stones as stone (stone.id)}
            {@const at = layout.center(stone.cell)}
            {@const growth = animator.growing.get(stone.id)}
            <g transform="translate({at.x} {at.y})" class="stone">
                {#if growth === undefined}
                    <path d={TILE_PATH} class="fill {stone.color}"></path>
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
            <path d={TILE_PATH} transform="translate({at.x} {at.y})" class="fill ghost {hoverColor}"
            ></path>
        {/if}

        {#each animator.stones as stone (stone.id)}
            {@const mark = animator.marks.get(stone.id)}
            {#if mark}
                {@const at = layout.center(stone.cell)}
                <g transform="translate({at.x} {at.y})">
                    <g {@attach animator.mark(stone.id)} class="mark {mark}">
                        <path d={LAST_MOVE.path} stroke-width={LAST_MOVE.width}></path>
                    </g>
                </g>
            {/if}
        {/each}

        {#if animator.win}
            <!-- The winning chain's line, edge to edge: a pale tint of the winner's colour on a
                 white edge. -->
            {@const { line, color } = animator.win}
            <g class="win-line {color}">
                <path d={line.d} class="under" {@attach animator.line('under')}></path>
                <path d={line.d} class="over" {@attach animator.line('over')}></path>
            </g>
        {/if}

        <g class="targets">
            {#each layout.grid.cells as cell (cell)}
                {@const open = session.placeable.has(cell)}
                {@const at = layout.center(cell)}
                <path
                    d={HEX_PATH}
                    transform="translate({at.x} {at.y})"
                    class="target"
                    class:open
                    role="button"
                    tabindex={open ? 0 : -1}
                    aria-label={open ? `place on ${cell}` : undefined}
                    aria-hidden={!open}
                    onclick={() => place(cell)}
                    onkeydown={(event) => onKey(event, cell)}
                    onpointerenter={(event) => onPointerEnter(event, cell)}
                    onpointerleave={() => (hovered = undefined)}
                ></path>
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
    .ground,
    .seam,
    .tile,
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

    .ground {
        fill: var(--hex-groove);
    }

    .seam {
        fill: none;
        stroke: var(--hex-groove);
        stroke-linejoin: round;
        stroke-linecap: round;
    }

    .tile {
        fill: var(--hex-cell);
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

    .win-line {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        pointer-events: none;
    }

    .win-line .under {
        stroke-width: 9.5;
        stroke: #ffffff;
    }

    .win-line .over {
        stroke-width: 6.5;
    }

    .win-line.blue .over {
        stroke: var(--hex-blue-tint);
    }

    .win-line.red .over {
        stroke: var(--hex-red-tint);
    }

    .target {
        fill: transparent;
        outline: none;
        pointer-events: none;
    }

    .target.open {
        cursor: pointer;
        pointer-events: all;
    }

    .target:focus-visible {
        stroke: var(--hex-mark);
        stroke-width: 2;
    }
</style>
