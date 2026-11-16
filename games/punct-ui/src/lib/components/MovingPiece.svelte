<script lang="ts">
    import type { Snippet } from 'svelte'
    import { dishBox, dishUrl } from '$lib/board/looks.js'
    import { SIDE_SPECK_OPACITY, SPECK_FILL, TOP_LOOK } from '$lib/board/pieceColours.js'
    import { SLICE_COUNT, type Tone } from '$lib/board/pieceShape.js'
    import { SPECK_SCALE } from '$lib/board/specks.js'
    import type { BoardView } from '$lib/board/geometry.js'
    import type { PiecePose } from '$lib/animators/piecePose.js'

    // A piece in motion: its pose writes where it is and how it lies (animators/piecePose.ts).
    // With a label it can be tapped, to turn it while it is yours to turn.
    let {
        pose,
        tone,
        view,
        prefix,
        label,
        turnable = false,
        onTurn,
        ring
    }: {
        pose: PiecePose
        tone: Tone
        view: BoardView
        prefix: string
        label?: string
        turnable?: boolean
        onTurn?: () => void
        ring?: Snippet
    } = $props()

    const top = $derived(TOP_LOOK[tone])
    const fill = $derived(SPECK_FILL[tone])
    const dish = dishBox()
    const slices = Array.from({ length: SLICE_COUNT }, (_, index) => index)

    function onKey(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onTurn?.()
        }
    }
</script>

{#snippet body()}
    <g data-part="body" class="piece-look">
        <g data-part="live">
            {#each slices as index (index)}
                <path data-part="slice" stroke="none"></path>
            {/each}
            <path data-part="top" fill={top.fill} stroke={top.stroke} stroke-width={top.strokeWidth}
            ></path>
        </g>
        <image data-part="image"></image>
        <g transform="scale({SPECK_SCALE})">
            <path data-part="side-specks" fill={fill.plain} fill-opacity={SIDE_SPECK_OPACITY}
            ></path>
            <path data-part="side-specks-grey" fill={fill.grey} fill-opacity={SIDE_SPECK_OPACITY}
            ></path>
        </g>
        {#each [`${tone}-insert` as const, tone, tone] as material, index (index)}
            <image data-part="dish" href={dishUrl(material)} width={dish.width} height={dish.height}
            ></image>
        {/each}
        <g transform="scale({SPECK_SCALE})">
            <path data-part="top-specks" fill={fill.plain}></path>
            <path data-part="top-specks-grey" fill={fill.grey}></path>
        </g>
    </g>
    <path data-part="hit" class="piece-hit"></path>
{/snippet}

<g {@attach pose.drawn(view, tone, prefix)}>
    <path class="shadow" class:dark={tone === 'dark'} data-part="shadow"></path>
    {#if label === undefined}
        <g class="piece-place passing" data-part="piece">
            {@render body()}
        </g>
    {:else}
        <g
            class="piece-place"
            class:turnable
            data-part="piece"
            role="button"
            tabindex={turnable ? 0 : -1}
            aria-disabled={!turnable}
            aria-label={label}
            onclick={() => turnable && onTurn?.()}
            onkeydown={(event) => turnable && onKey(event)}
        >
            {@render body()}
            {@render ring?.()}
        </g>
    {/if}
</g>

<style>
    .piece-place {
        outline: none;
    }

    .piece-place.turnable {
        cursor: pointer;
    }

    .piece-place.passing {
        pointer-events: none;
    }

    .piece-look {
        pointer-events: none;
    }

    .piece-hit {
        fill: transparent;
    }

    .shadow {
        fill: rgb(20 30 25 / 0.28);
        stroke: rgb(20 30 25 / 0.12);
        stroke-width: 3;
        pointer-events: none;
    }

    .shadow:global(.crease) {
        fill: rgb(30 34 40 / 0.62);
        stroke: none;
    }

    .shadow.dark:global(.crease) {
        fill: rgb(0 0 0 / 0.9);
    }
</style>
