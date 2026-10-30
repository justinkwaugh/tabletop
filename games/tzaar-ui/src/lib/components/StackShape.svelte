<svelte:options namespace="svg" />

<script lang="ts">
    import type { Snippet } from 'svelte'
    import { PIECE_MODEL, stackDiscs, TILT, type PieceModel } from '$lib/board/pieceGeometry.js'
    import {
        bandPath,
        bandSurface,
        creaseColor,
        isMetal,
        isSeen,
        pieceDrawing,
        SHADE_LEVELS,
        slopeAt
    } from '$lib/board/pieceShape.js'
    import {
        seedOf,
        sideSpecks,
        SPECK_COLORS,
        topSpecks,
        type ShapePiece
    } from '$lib/board/pieceStyle.js'

    // A stack standing on its space, seen from the near side of the table, bottom piece first.
    // The gradients come from a PieceDefs with the same prefix in the same SVG.
    let {
        pieces,
        radius,
        prefix,
        showCount = true,
        onTop,
        model = PIECE_MODEL
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
    } = $props()

    const MID_LEVEL = (SHADE_LEVELS - 1) / 2
    // Flecks stay off slopes steeper than this, where they would smear.
    const STEEPEST_FLECKED = 0.8

    const drawing = $derived(pieceDrawing(radius, model))
    const discs = $derived(
        stackDiscs(pieces.length, radius, model).map((disc, index) => {
            const piece = pieces[index]
            const seed = seedOf(`${piece.seedKey}:${piece.tone}`)
            return {
                ...disc,
                ...piece,
                speck: SPECK_COLORS[piece.tone],
                seed,
                sideSpecks: sideSpecks(piece.tone, seed, model.thickness),
                top: index === pieces.length - 1
            }
        })
    )
    const top = $derived(discs.at(-1))

    const bands = $derived(
        top
            ? drawing.top.map((band) => ({
                  ...band,
                  surface: bandSurface(top.tone, top.kind, band)
              }))
            : []
    )

    // The top's flecks, each where it lies on the top, leaving out metal, steep slopes and what
    // the top hides from you.
    const topFlecks = $derived.by(() => {
        if (!top) return []
        return topSpecks(top.tone, top.seed)
            .filter((speck) => {
                const distance = Math.hypot(speck.x, speck.y)
                return (
                    !isMetal(top.kind, distance) &&
                    slopeAt(distance, model) < STEEPEST_FLECKED &&
                    isSeen(speck.x, speck.y, model)
                )
            })
            .map((speck) => ({
                ...speck,
                at: {
                    x: speck.x * radius,
                    y: drawing.surface(Math.hypot(speck.x, speck.y)) + speck.y * radius * TILT
                }
            }))
    })
</script>

{#each discs as disc, index (index)}
    {#if disc.full}
        <g transform="translate(0 {disc.base})">
            {#each drawing.side as slice, s (s)}
                <ellipse
                    cy={slice.y}
                    rx={slice.rx}
                    ry={slice.ry}
                    fill="url(#{prefix}-{disc.tone}-side-{slice.level})"
                ></ellipse>
            {/each}
            {#each disc.sideSpecks as speck, s (s)}
                <ellipse
                    cx={speck.x * radius}
                    cy={-drawing.height * (1 - speck.v) +
                        radius * TILT * Math.sqrt(1 - speck.x * speck.x)}
                    rx={speck.r * radius * speck.stretch * Math.sqrt(1 - speck.x * speck.x)}
                    ry={Math.min(speck.r * radius, drawing.height * 0.2)}
                    fill={disc.speck}
                    class="speck"
                ></ellipse>
            {/each}
            {#if !disc.top}
                <!-- The top in the shadow of the piece resting on it: the crease between them. -->
                <ellipse
                    cy={drawing.face.y}
                    rx={drawing.face.rx}
                    ry={drawing.face.ry}
                    fill={creaseColor(disc.tone)}
                ></ellipse>
            {/if}
        </g>
    {:else}
        <path
            d={bandPath(disc.base, disc.side, radius)}
            fill="url(#{prefix}-{disc.tone}-side-{MID_LEVEL})"
            stroke={creaseColor(disc.tone)}
            stroke-width={Math.min(0.6, disc.side * 0.3)}
        ></path>
        {#each disc.sideSpecks as speck, s (s)}
            <ellipse
                cx={speck.x * radius}
                cy={disc.base -
                    disc.side * (1 - speck.v) +
                    radius * TILT * Math.sqrt(1 - speck.x * speck.x)}
                rx={speck.r * radius * speck.stretch * Math.sqrt(1 - speck.x * speck.x)}
                ry={Math.min(speck.r * radius, disc.side * 0.35)}
                fill={disc.speck}
                class="speck"
            ></ellipse>
        {/each}
    {/if}
{/each}

{#if top}
    <g transform="translate(0 {top.base})">
        {#each bands as band, b (b)}
            <ellipse
                cy={band.outer.y}
                rx={band.outer.rx}
                ry={band.outer.ry}
                fill="url(#{prefix}-{band.surface}-far-{band.farLevel})"
            ></ellipse>
        {/each}
        {#each bands.toReversed() as band, b (b)}
            <path d={band.near} fill="url(#{prefix}-{band.surface}-near-{band.nearLevel})"></path>
        {/each}
        {#each topFlecks as speck, s (s)}
            <ellipse
                transform="translate({speck.at.x} {speck.at
                    .y}) scale(1 {TILT}) rotate({speck.angle})"
                rx={speck.r * radius * speck.stretch}
                ry={speck.r * radius}
                fill={top.speck}
                class="speck"
            ></ellipse>
        {/each}
        {@render onTop?.()}
        {#if showCount && pieces.length > 1}
            <!-- The count on a badge on the near side of the top, inside the stack's own outline,
                 clear of the type's markings. -->
            <g transform="translate({radius * 0.6} {drawing.face.y + radius * 0.42 * TILT})">
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
