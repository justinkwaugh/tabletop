<svelte:options namespace="svg" />

<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import type { PieceColor } from '@tabletop/lyngk'
    import { VIEW } from '$lib/board/geometry.js'
    import { discBases, THICKNESS } from '$lib/board/pieceGeometry.js'
    import { discDrawing, TOP_RADIUS, troughColors } from '$lib/board/pieceShape.js'
    import { faceSpecks, pieceSeed, PIECE_STYLES, sideSpecks } from '$lib/board/pieceStyle.js'

    // A stack standing on its point, seen from the near side of the table, bottom disc first. The
    // gradients come from a PieceDefs with the same prefix in the same SVG.
    let {
        stack,
        radius,
        prefix,
        ids,
        seedKey = 'icon',
        baseLevel = 0,
        parts
    }: {
        stack: readonly PieceColor[]
        radius: number
        prefix: string
        // Each piece's identity, bottom to top, which seeds its specks; without them, the point
        // and level the stack's specks are seeded for.
        ids?: readonly number[]
        seedKey?: string
        baseLevel?: number
        // The shadow stays on the board while the body moves.
        parts?: { body?: Attachment<SVGGElement>; shadow?: Attachment<SVGGElement> }
    } = $props()

    const disc = $derived(discDrawing(VIEW, radius))
    const side = $derived(VIEW.height(THICKNESS * radius))
    const pieces = $derived(
        discBases(VIEW, stack.length, radius).map((base, index) => {
            const color = stack[index]
            const seed = pieceSeed(ids?.[index], seedKey, baseLevel + index, color)
            return {
                base,
                color,
                speck: PIECE_STYLES[color].speck,
                speckAlt: PIECE_STYLES[color].speckAlt ?? PIECE_STYLES[color].speck,
                trough: troughColors(color),
                specks: faceSpecks(color, seed),
                sideSpecks: sideSpecks(color, seed),
                top: index === stack.length - 1
            }
        })
    )

    function speckEllipse(r: number, stretch: number) {
        return { rx: r * radius * stretch, ry: r * radius }
    }
</script>

<g {@attach parts?.shadow}>
    {#if pieces.length > 0}
        <ellipse
            rx={radius * 1.12}
            ry={radius * 1.12 * VIEW.tilt}
            cy={1}
            fill="url(#{prefix}-shadow)"
        ></ellipse>
        <ellipse rx={radius} ry={radius * VIEW.tilt} fill="url(#{prefix}-contact)"></ellipse>
    {/if}
</g>
<g {@attach parts?.body}>
    {#each pieces as piece, index (index)}
        <g transform="translate(0 {piece.base})">
            {#each disc.slices as slice, sliceIndex (sliceIndex)}
                <ellipse
                    cy={slice.y}
                    rx={slice.rx}
                    ry={slice.ry}
                    fill="url(#{prefix}-{piece.color}-side-{slice.level})"
                ></ellipse>
            {/each}
            {#each piece.sideSpecks as speck, s (s)}
                {@const shape = speckEllipse(speck.r, speck.stretch)}
                <ellipse
                    cx={speck.x * radius}
                    cy={-side * (1 - speck.v) +
                        radius * VIEW.tilt * Math.sqrt(1 - speck.x * speck.x)}
                    rx={shape.rx * Math.sqrt(1 - speck.x * speck.x)}
                    ry={Math.min(shape.ry, side * 0.2)}
                    fill={speck.alt ? piece.speckAlt : piece.speck}
                    class="speck"
                ></ellipse>
            {/each}
            <ellipse
                cy={disc.top.y}
                rx={disc.top.rx}
                ry={disc.top.ry}
                fill="url(#{prefix}-{piece.color}-face)"
            ></ellipse>
            <ellipse
                cy={disc.trough.y}
                rx={disc.trough.rx}
                ry={disc.trough.ry}
                fill={piece.trough.floor}
            ></ellipse>
            <path d={disc.farWall} fill={piece.trough.farWall}></path>
            <path d={disc.nearWall} fill={piece.trough.nearWall}></path>
            <ellipse
                cy={disc.centre.y}
                rx={disc.centre.rx}
                ry={disc.centre.ry}
                fill="url(#{prefix}-{piece.color}-face)"
            ></ellipse>
            {#if piece.top}
                {#each piece.specks as speck, s (s)}
                    {@const shape = speckEllipse(speck.r, speck.stretch)}
                    <ellipse
                        transform="translate({speck.x * radius * TOP_RADIUS} {disc.top.y +
                            speck.y *
                                radius *
                                TOP_RADIUS *
                                VIEW.tilt}) scale(1 {VIEW.tilt}) rotate({speck.angle})"
                        rx={shape.rx}
                        ry={shape.ry}
                        fill={speck.alt ? piece.speckAlt : piece.speck}
                        class="speck"
                    ></ellipse>
                {/each}
            {:else}
                <!-- The top in the shadow of the disc resting on it: the crease between them. -->
                <ellipse
                    cy={disc.top.y}
                    rx={disc.top.rx}
                    ry={disc.top.ry}
                    fill={piece.trough.crease}
                ></ellipse>
            {/if}
        </g>
    {/each}
</g>

<style>
    .speck {
        opacity: 0.9;
    }
</style>
