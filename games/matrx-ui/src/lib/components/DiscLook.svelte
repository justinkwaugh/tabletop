<svelte:options namespace="svg" />

<script lang="ts">
    import type { BoardView } from '$lib/board/geometry.js'
    import {
        discLookId,
        markOf,
        pieceDrawing,
        SHADE_LEVELS,
        sideStops,
        topBands,
        type Disc
    } from '$lib/board/pieceShape.js'

    // One disc's look, of one kind and tone, drawn in an SVG under its id: the looks page draws
    // each for scripts/render-looks.mjs to save as an image. The gradients come from the
    // PieceDefs beside it. DVONN's hole and ZÈRTZ's notches are cut out of the drawn disc;
    // PÜNCT's side is built from bands between its notches, and only its top is cut.
    let {
        disc,
        radius,
        prefix,
        view
    }: { disc: Disc; radius: number; prefix: string; view: BoardView } = $props()

    const tone = $derived(disc.tone)
    const lookId = $derived(discLookId(prefix, disc))
    const drawing = $derived(pieceDrawing(view, 1, radius))
    const bands = $derived(topBands(view, disc.kind, radius, disc.tone))
    const mark = $derived(markOf(view, disc.kind, radius, disc.tone))
    const cut = $derived(mark?.kind === 'hole' || mark?.kind === 'notches')
    const reach = $derived(radius * 1.3)
    const levels = Array.from({ length: SHADE_LEVELS }, (_, level) => level)
</script>

{#snippet maskOf(id: string, cuts: readonly string[])}
    <mask
        {id}
        maskUnits="userSpaceOnUse"
        x={-reach}
        y={-reach * 2}
        width={reach * 2}
        height={reach * 3}
    >
        <rect x={-reach} y={-reach * 2} width={reach * 2} height={reach * 3} fill="white"></rect>
        {#each cuts as d, index (index)}
            <path {d} fill="black"></path>
        {/each}
    </mask>
{/snippet}

{#snippet top()}
    {#each bands as band, bandIndex (bandIndex)}
        <ellipse cy={band.outer.y} rx={band.outer.rx} ry={band.outer.ry} fill={band.color}
        ></ellipse>
        {#if band.steep > 0}
            <ellipse
                cy={band.outer.y}
                rx={band.outer.rx}
                ry={band.outer.ry}
                fill="url(#{prefix}-{tone}-far-wall)"
                fill-opacity={band.steep}
            ></ellipse>
        {/if}
    {/each}
    {#each bands.toReversed() as band, bandIndex (bandIndex)}
        <path d={band.near} fill={band.color}></path>
        {#if band.steep > 0}
            <path d={band.near} fill="url(#{prefix}-{tone}-near-wall)" fill-opacity={band.steep}
            ></path>
        {/if}
    {/each}
{/snippet}

<g id={lookId}>
    {#if mark?.kind === 'cuts'}
        <!-- The notches' walls first; the side and the top in front of them hide them. -->
        {#each levels as level (level)}
            <linearGradient
                id="{lookId}-side-{level}"
                gradientUnits="userSpaceOnUse"
                x1={-radius}
                y1="0"
                x2={radius}
                y2="0"
            >
                {#each sideStops(tone, level) as stop (stop.offset)}
                    <stop offset={stop.offset} stop-color={stop.color}></stop>
                {/each}
            </linearGradient>
        {/each}
        {@render maskOf(`${lookId}-top`, mark.topCuts)}
        <clipPath id="{lookId}-outline">
            <path d={mark.outline}></path>
        </clipPath>
        <g clip-path="url(#{lookId}-outline)">
            {#each mark.walls as wall, wallIndex (wallIndex)}
                <path d={wall.d} fill={wall.fill}></path>
            {/each}
        </g>
        {#each mark.side as band, bandIndex (bandIndex)}
            <path d={band.d} fill="url(#{lookId}-side-{band.level})"></path>
        {/each}
        <g mask="url(#{lookId}-top)">
            {@render top()}
        </g>
    {:else}
        {#if mark?.kind === 'hole'}
            {@render maskOf(`${lookId}-cut`, [mark.through])}
        {:else if mark?.kind === 'notches'}
            {@render maskOf(`${lookId}-cut`, mark.through)}
        {/if}
        <g mask={cut ? `url(#${lookId}-cut)` : undefined}>
            {#each drawing.slices as slice, sliceIndex (sliceIndex)}
                <ellipse
                    cy={slice.y}
                    rx={slice.rx}
                    ry={slice.ry}
                    fill="url(#{prefix}-{tone}-side-{slice.level})"
                ></ellipse>
            {/each}
            {@render top()}
            {#if mark?.kind === 'hole'}
                <path d={mark.wall} class="hole-wall {tone}"></path>
            {:else if mark?.kind === 'carved'}
                <clipPath id="{lookId}-carved">
                    <path d={mark.clip}></path>
                </clipPath>
                <g clip-path="url(#{lookId}-carved)">
                    {#each mark.cells as cell, cellIndex (cellIndex)}
                        <path d={cell.d} fill={cell.fill} fill-opacity={cell.opacity}></path>
                    {/each}
                </g>
            {/if}
        </g>
        <!-- Inside ZÈRTZ's notches, their curve, seen only through the cut. -->
        {#if mark?.kind === 'notches'}
            <clipPath id="{lookId}-outline">
                <path d={mark.outline}></path>
            </clipPath>
            <g clip-path="url(#{lookId}-outline)">
                <clipPath id="{lookId}-notch">
                    {#each mark.clip as clip, clipIndex (clipIndex)}
                        <path d={clip}></path>
                    {/each}
                </clipPath>
                <!-- Unclipped and edged, the backing covers the cut's soft edge. -->
                {#each mark.backings as backing, backingIndex (backingIndex)}
                    <path d={backing} class="notch-backing {tone}"></path>
                {/each}
                <g clip-path="url(#{lookId}-notch)">
                    {#each mark.cells as cell, cellIndex (cellIndex)}
                        <path d={cell.d} fill={cell.fill} fill-opacity={cell.opacity}></path>
                    {/each}
                </g>
            </g>
        {/if}
    {/if}
</g>

<style>
    .notch-backing {
        stroke-width: 0.8;
        stroke-linejoin: round;
    }

    /* The top's own colour, where the notch's lips meet it. */
    .notch-backing.light {
        fill: #ece6d0;
        stroke: #ece6d0;
    }

    .notch-backing.dark {
        fill: #2c2829;
        stroke: #2c2829;
    }

    .hole-wall.light {
        fill: #a39878;
    }

    .hole-wall.dark {
        fill: #070606;
    }
</style>
