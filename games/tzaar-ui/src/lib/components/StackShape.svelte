<svelte:options namespace="svg" />

<script lang="ts">
    import type { Snippet } from 'svelte'
    import { PIECE_MODEL, stackDiscs, TILT, type PieceModel } from '$lib/board/pieceGeometry.js'
    import {
        bandPath,
        creaseColor,
        lookBox,
        SHADE_LEVELS,
        topEllipse
    } from '$lib/board/pieceShape.js'
    import { lookUrl } from '$lib/board/looks.js'
    import { seedOf, type ShapePiece } from '$lib/board/pieceStyle.js'
    import { sideSpeckPaths, topSpeckPaths } from '$lib/board/specks.js'

    // A stack standing on its space, seen from the near side of the table, bottom piece first.
    // Each whole piece is an image of its look, pre-rendered by scripts/render-looks.mjs, with its
    // own specks drawn over it, kept inside it by clips. The gradients and the clips come from a
    // PieceDefs with the same prefix and radius in the same SVG.
    let {
        pieces,
        radius,
        prefix,
        showCount = true,
        onTop,
        model = PIECE_MODEL,
        quarterTurns = 0
    }: {
        // Bottom to top; each piece's specks are seeded by its key, so they go with it as it
        // moves.
        pieces: readonly ShapePiece[]
        radius: number
        prefix: string
        showCount?: boolean
        // Drawn on the top piece, its top as the origin, under the count.
        onTop?: Snippet
        model?: PieceModel
        // The board seen this many quarter turns round: the specks on a top turn with it, and the
        // side you see is another part of the side.
        quarterTurns?: number
    } = $props()

    const MID_LEVEL = (SHADE_LEVELS - 1) / 2

    const box = $derived(lookBox(radius))
    const face = $derived(topEllipse(radius))
    const discs = $derived(
        stackDiscs(pieces.length, radius, model).map((disc, index) => {
            const piece = pieces[index]
            const seed = seedOf(`${piece.seedKey}:${piece.tone}`)
            const top = index === pieces.length - 1
            return {
                ...disc,
                piece,
                crease: creaseColor(piece.tone),
                sideSpecks: sideSpeckPaths(radius, piece.tone, seed + quarterTurns, disc.side),
                // Only the top piece's top shows.
                topSpecks: top ? topSpeckPaths(radius, piece, seed, quarterTurns) : [],
                top
            }
        })
    )
    const top = $derived(discs.at(-1))
</script>

{#each discs as disc, index (index)}
    {#if disc.full}
        <g transform="translate(0 {disc.base})">
            <image
                href={lookUrl(disc.piece)}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
            ></image>
            <g clip-path="url(#{prefix}-side-clip)">
                {#each disc.sideSpecks as speck (speck.fill)}
                    <path d={speck.d} fill={speck.fill} class="speck"></path>
                {/each}
            </g>
            {#if disc.top}
                <g clip-path="url(#{prefix}-top-clip)">
                    {#each disc.topSpecks as speck (speck.fill)}
                        <path d={speck.d} fill={speck.fill} class="speck"></path>
                    {/each}
                </g>
            {:else}
                <!-- The top in the shadow of the piece resting on it: the crease between them. -->
                <ellipse cy={face.y} rx={face.rx} ry={face.ry} fill={disc.crease}></ellipse>
            {/if}
        </g>
    {:else}
        <path
            d={bandPath(disc.base, disc.side, radius)}
            fill="url(#{prefix}-{disc.piece.tone}-side-{MID_LEVEL})"
            stroke={disc.crease}
            stroke-width={Math.min(0.6, disc.side * 0.3)}
        ></path>
        <g transform="translate(0 {disc.base})">
            {#each disc.sideSpecks as speck (speck.fill)}
                <path d={speck.d} fill={speck.fill} class="speck"></path>
            {/each}
        </g>
    {/if}
{/each}

{#if top}
    <g transform="translate(0 {top.base})">
        {@render onTop?.()}
        {#if showCount && pieces.length > 1}
            <!-- The count on a badge on the near side of the top, inside the stack's own outline,
                 clear of the type's markings. -->
            <g transform="translate({radius * 0.6} {face.y + radius * 0.42 * TILT})">
                <circle r={radius * 0.27} class="badge"></circle>
                <!-- Set ten times larger and scaled down: text this small is snapped to whole
                     pixels, which pushed the digits off the badge's centre on phones. -->
                <text transform="scale(0.1)" font-size={radius * 3.7} dy="0.36em" class="count"
                    >{pieces.length}</text
                >
            </g>
        {/if}
    </g>
{/if}

<style>
    .speck {
        opacity: 0.9;
    }

    .badge {
        fill: #ffffff;
        stroke: #000000;
        stroke-width: 1.2;
    }

    .count {
        fill: #000000;
        font-weight: 700;
        text-anchor: middle;
        font-variant-numeric: tabular-nums;
        pointer-events: none;
    }
</style>
