<svelte:options namespace="svg" />

<script lang="ts">
    import type { BoardView } from '$lib/board/geometry.js'
    import { markOf, pieceDrawing, topBands, type Disc } from '$lib/board/pieceShape.js'
    import { liftOffCrease, liftOffDisc, type PieceParts } from '$lib/animators/drop.js'

    // A stack of discs standing on its point, seen from the near side of the table. The
    // gradients come from a PieceDefs with the same prefix in the same SVG. Each disc is drawn on
    // its own node, centred on its base, so it can drop or lift off on its own; DVONN's hole and
    // PÜNCT's notches are cut through it, so what lies under or behind shows.
    let {
        discs,
        radius,
        prefix,
        view,
        parts
    }: {
        discs: readonly Disc[]
        radius: number
        prefix: string
        view: BoardView
        parts?: PieceParts
    } = $props()

    const id = $props.id()
    const drawing = $derived(pieceDrawing(view, discs.length, radius))
    const tops = $derived(discs.map((each) => topBands(view, each.kind, radius, each.tone)))
    const marks = $derived(discs.map((each) => markOf(view, each.kind, radius, each.tone)))
    const reach = $derived(radius * 1.3)
</script>

{#each drawing.bases as base, index (index)}
    {@const tone = discs[index].tone}
    {@const mark = marks[index]}
    {@const cut = mark?.kind === 'hole' || mark?.kind === 'cuts' || mark?.kind === 'notches'}
    <g transform="translate(0 {base})">
        <g {@attach parts?.disc(index)} out:liftOffDisc={{ parts }}>
            {#if cut}
                <mask
                    id="{id}-cut-{index}"
                    maskUnits="userSpaceOnUse"
                    x={-reach}
                    y={-reach * 2}
                    width={reach * 2}
                    height={reach * 3}
                >
                    <rect
                        x={-reach}
                        y={-reach * 2}
                        width={reach * 2}
                        height={reach * 3}
                        fill="white"
                    ></rect>
                    {#if mark?.kind === 'hole'}
                        <path d={mark.through} fill="black"></path>
                    {:else if mark?.kind === 'cuts' || mark?.kind === 'notches'}
                        {#each mark.through as through, cutIndex (cutIndex)}
                            <path d={through} fill="black"></path>
                        {/each}
                    {/if}
                </mask>
            {/if}
            <g mask={cut ? `url(#${id}-cut-${index})` : undefined}>
                {#each drawing.slices as slice, sliceIndex (sliceIndex)}
                    <ellipse
                        cy={slice.y}
                        rx={slice.rx}
                        ry={slice.ry}
                        fill="url(#{prefix}-{tone}-side-{slice.level})"
                    ></ellipse>
                {/each}
                {#each tops[index] as band, bandIndex (bandIndex)}
                    <ellipse
                        cy={band.outer.y}
                        rx={band.outer.rx}
                        ry={band.outer.ry}
                        fill={band.color}
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
                {#each tops[index].toReversed() as band, bandIndex (bandIndex)}
                    <path d={band.near} fill={band.color}></path>
                    {#if band.steep > 0}
                        <path
                            d={band.near}
                            fill="url(#{prefix}-{tone}-near-wall)"
                            fill-opacity={band.steep}
                        ></path>
                    {/if}
                {/each}
                {#if mark?.kind === 'hole'}
                    <path d={mark.wall} class="hole-wall {tone}"></path>
                {:else if mark?.kind === 'carved'}
                    <clipPath id="{id}-carved-{index}">
                        <path d={mark.clip}></path>
                    </clipPath>
                    <g clip-path="url(#{id}-carved-{index})">
                        {#each mark.cells as cell, cellIndex (cellIndex)}
                            <path d={cell.d} fill={cell.fill} fill-opacity={cell.opacity}></path>
                        {/each}
                    </g>
                {/if}
            </g>
            <!-- Inside ZÈRTZ's notches, their curve, seen only through the cut. -->
            {#if mark?.kind === 'notches'}
                <clipPath id="{id}-outline-{index}">
                    <path d={mark.outline}></path>
                </clipPath>
                <g clip-path="url(#{id}-outline-{index})">
                    <clipPath id="{id}-notch-{index}">
                        {#each mark.clip as clip, clipIndex (clipIndex)}
                            <path d={clip}></path>
                        {/each}
                    </clipPath>
                    <!-- Unclipped and edged, the backing covers the cut's soft edge. -->
                    {#each mark.backings as backing, backingIndex (backingIndex)}
                        <path d={backing} class="notch-backing {tone}"></path>
                    {/each}
                    <g clip-path="url(#{id}-notch-{index})">
                        {#each mark.cells as cell, cellIndex (cellIndex)}
                            <path d={cell.d} fill={cell.fill} fill-opacity={cell.opacity}></path>
                        {/each}
                    </g>
                </g>
            {/if}
            <!-- Inside a notch cut through the disc, the part of its inner wall that faces you,
                 seen only through the cut. -->
            {#if mark?.kind === 'cuts'}
                <clipPath id="{id}-cuts-{index}">
                    {#each mark.through as through, cutIndex (cutIndex)}
                        <path d={through}></path>
                    {/each}
                </clipPath>
                <g clip-path="url(#{id}-cuts-{index})">
                    {#each mark.walls as wall, wallIndex (wallIndex)}
                        <path d={wall} class="cut-wall {tone}"></path>
                    {/each}
                </g>
            {/if}
            {#if index < drawing.bases.length - 1}
                <g {@attach parts?.crease(index)} out:liftOffCrease={{ parts }}>
                    <ellipse
                        cy={drawing.crease.y}
                        rx={drawing.crease.rx}
                        ry={drawing.crease.ry}
                        class="crease {tone}"
                    ></ellipse>
                </g>
            {/if}
        </g>
    </g>
{/each}

<style>
    .crease.light {
        fill: #5e5644;
    }

    .crease.dark {
        fill: #000;
    }

    .notch-floor.light {
        fill: #cfc6a6;
    }

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

    .notch-floor.dark {
        fill: #161415;
    }

    .hole-wall.light {
        fill: #a39878;
    }

    .hole-wall.dark {
        fill: #070606;
    }

    .cut-wall.light {
        fill: #a89d7c;
    }

    .cut-wall.dark {
        fill: #0b0a0a;
    }
</style>
