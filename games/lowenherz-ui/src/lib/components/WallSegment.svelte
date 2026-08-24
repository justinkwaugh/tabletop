<script lang="ts">
    import { CELL_SIZE, scaled } from '$lib/model/boardMetrics.js'
    // A single boundary-wall segment (one square edge long), drawn as a thin base
    // bar with irregular black squares strung along it - a hand-built look, like the
    // rampart frame's crenellations, but for player-placed walls on the board itself.
    // Rendered as a child of a zero-size anchor div placed at the wall's start corner
    // (see RealBoard.svelte), so all coordinates here are relative to that corner.
    // hideStartJunction/hideEndJunction suppress the octagon-with-inset look at
    // whichever endpoint touches the board's outer boundary (the rampart frame) -
    // there's no other wall there to blend with, just the board's edge, so it's
    // drawn as a plain crenellation square instead (see RealBoard's
    // wallJunctionVisibility()).
    let {
        orientation,
        hideStartJunction = false,
        hideEndJunction = false
    }: { orientation: 'horizontal' | 'vertical'; hideStartJunction?: boolean; hideEndJunction?: boolean } =
        $props()

    // One wall spans one square edge, so this IS the cell size - it was a hardcoded 44 that
    // silently became two thirds of an edge when the board scaled up. Everything else here is a
    // ratio of it, so the crenellations keep their proportions at any scale.
    const LENGTH = CELL_SIZE
    const BASE_THICKNESS = scaled(3)
    const AVG_SQUARE = scaled(8)
    const SIZE_JITTER = scaled(1)
    const ROTATION_JITTER = 1 // degrees, not pixels
    const INTERIOR_COUNT = 3

    // The two endpoint "squares" are really junction markers (see buildSquares'
    // comment) - drawn as octagons instead, with a smaller yellowish octagon inset,
    // so every wall junction on the board reads as a distinct fitting rather than
    // just another crenellation square.
    const OCTAGON_CLIP =
        'polygon(29.3% 0%, 70.7% 0%, 100% 29.3%, 100% 70.7%, 70.7% 100%, 29.3% 100%, 0% 70.7%, 0% 29.3%)'
    const INNER_OCTAGON_SCALE = 0.55
    const INNER_OCTAGON_COLOR = '#d9b44a'

    type Square = { pos: number; size: number; rotation: number }

    // The two endpoints are always plain, unrotated, average-size squares - not
    // randomized - so that two wall segments sharing a corner (the far end of one is
    // always the near end of its neighbor, since walls are laid out on a grid) get
    // overlapping squares there, blending into one smooth joint instead of a gap.
    // The 3 interior squares are otherwise evenly spaced, only occasionally nudged a
    // single pixel off their exact spot - not the earlier free-running jitter.
    function buildSquares(): Square[] {
        const squares: Square[] = [{ pos: 0, size: AVG_SQUARE, rotation: 0 }]

        for (let i = 1; i <= INTERIOR_COUNT; i++) {
            const evenPos = (LENGTH * i) / (INTERIOR_COUNT + 1)
            const pixelNudge = Math.round(Math.random() * 2 - 1) * SIZE_JITTER // mostly 0
            squares.push({
                pos: evenPos + pixelNudge,
                size: AVG_SQUARE + (Math.random() * 2 - 1) * SIZE_JITTER,
                rotation: (Math.random() * 2 - 1) * ROTATION_JITTER
            })
        }

        squares.push({ pos: LENGTH, size: AVG_SQUARE, rotation: 0 })
        return squares
    }

    // Computed once, on mount - not reactive - so re-renders of the surrounding board
    // (knights placed, regions tinted, etc.) never reshuffle already-drawn walls.
    const squares = buildSquares()
</script>

{#if orientation === 'horizontal'}
    <div
        class="absolute bg-[#3f463f]"
        style="left:0; top:{-BASE_THICKNESS / 2}px; width:{LENGTH}px; height:{BASE_THICKNESS}px;"
    ></div>
    {#each squares as square, i (i)}
        {@const isJunction =
            (i === 0 && !hideStartJunction) || (i === squares.length - 1 && !hideEndJunction)}
        {#if isJunction}
            <div
                class="absolute bg-[#3f463f]"
                style="
                    left:{square.pos - square.size / 2}px;
                    top:{-square.size / 2}px;
                    width:{square.size}px;
                    height:{square.size}px;
                    clip-path: {OCTAGON_CLIP};
                "
            ></div>
            <div
                class="absolute"
                style="
                    left:{square.pos - (square.size * INNER_OCTAGON_SCALE) / 2}px;
                    top:{-(square.size * INNER_OCTAGON_SCALE) / 2}px;
                    width:{square.size * INNER_OCTAGON_SCALE}px;
                    height:{square.size * INNER_OCTAGON_SCALE}px;
                    background-color: {INNER_OCTAGON_COLOR};
                    clip-path: {OCTAGON_CLIP};
                "
            ></div>
        {:else}
            <div
                class="absolute bg-[#3f463f]"
                style="
                    left:{square.pos - square.size / 2}px;
                    top:{-square.size / 2}px;
                    width:{square.size}px;
                    height:{square.size}px;
                    transform: rotate({square.rotation}deg);
                "
            ></div>
        {/if}
    {/each}
{:else}
    <div
        class="absolute bg-[#3f463f]"
        style="top:0; left:{-BASE_THICKNESS / 2}px; height:{LENGTH}px; width:{BASE_THICKNESS}px;"
    ></div>
    {#each squares as square, i (i)}
        {@const isJunction =
            (i === 0 && !hideStartJunction) || (i === squares.length - 1 && !hideEndJunction)}
        {#if isJunction}
            <div
                class="absolute bg-[#3f463f]"
                style="
                    top:{square.pos - square.size / 2}px;
                    left:{-square.size / 2}px;
                    width:{square.size}px;
                    height:{square.size}px;
                    clip-path: {OCTAGON_CLIP};
                "
            ></div>
            <div
                class="absolute"
                style="
                    top:{square.pos - (square.size * INNER_OCTAGON_SCALE) / 2}px;
                    left:{-(square.size * INNER_OCTAGON_SCALE) / 2}px;
                    width:{square.size * INNER_OCTAGON_SCALE}px;
                    height:{square.size * INNER_OCTAGON_SCALE}px;
                    background-color: {INNER_OCTAGON_COLOR};
                    clip-path: {OCTAGON_CLIP};
                "
            ></div>
        {:else}
            <div
                class="absolute bg-[#3f463f]"
                style="
                    top:{square.pos - square.size / 2}px;
                    left:{-square.size / 2}px;
                    width:{square.size}px;
                    height:{square.size}px;
                    transform: rotate({square.rotation}deg);
                "
            ></div>
        {/if}
    {/each}
{/if}
