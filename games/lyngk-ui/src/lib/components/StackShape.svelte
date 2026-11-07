<svelte:options namespace="svg" />

<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { JOKER_COUNT, jokerNumber, PieceColor } from '@tabletop/lyngk'
    import { VIEW } from '$lib/board/geometry.js'
    import { discBases } from '$lib/board/pieceGeometry.js'
    import { creaseColor, lookBox, topEllipse, type Look } from '$lib/board/pieceShape.js'
    import { lookUrl } from '$lib/board/looks.js'
    import { pieceSeed } from '$lib/board/pieceStyle.js'
    import { sideSpeckPaths, topSpeckPaths } from '$lib/board/specks.js'

    // A stack standing on its point, seen from the near side of the table, bottom disc first. Each
    // disc is an image of its look, pre-rendered by scripts/render-looks.mjs, with its own specks
    // drawn over it, kept inside it by clips; a joker's are in its look. The shadow's gradients and the clips come
    // from a PieceDefs with the same prefix and radius in the same SVG.
    let {
        stack,
        radius,
        prefix,
        ids,
        seedKey = 'icon',
        baseLevel = 0,
        turned = false,
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
        // On a board seen from the far side, the specks on a top turn half round with it, and
        // the side you see is the other half of the side.
        turned?: boolean
        // The shadow stays on the board while the body moves.
        parts?: { body?: Attachment<SVGGElement>; shadow?: Attachment<SVGGElement> }
    } = $props()

    const box = $derived(lookBox(VIEW, radius))
    const top = $derived(topEllipse(VIEW, radius))
    const pieces = $derived(
        discBases(VIEW, stack.length, radius).map((base, index) => {
            const color = stack[index]
            const seed = pieceSeed(ids?.[index], seedKey, baseLevel + index, color)
            const isTop = index === stack.length - 1
            // A joker's many flecks are drawn into its look, one for each of the three, picked by
            // its number (by its seed where it has none); other pieces' few specks are drawn over
            // theirs.
            const id = ids?.[index]
            const look: Look =
                color === PieceColor.Joker
                    ? {
                          color,
                          joker: {
                              number:
                                  (id === undefined ? undefined : jokerNumber(id)) ??
                                  (seed >>> 0) % JOKER_COUNT,
                              turned
                          }
                      }
                    : { color }
            const specked = color !== PieceColor.Joker
            return {
                base,
                look,
                crease: creaseColor(color),
                // Only the top disc's top shows.
                topSpecks: specked && isTop ? topSpeckPaths(VIEW, radius, color, seed, turned) : [],
                sideSpecks: specked ? sideSpeckPaths(VIEW, radius, color, seed, turned) : [],
                top: isTop
            }
        })
    )
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
            <image
                href={lookUrl(piece.look)}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
            ></image>
            <g clip-path="url(#{prefix}-side-clip)">
                {#each piece.sideSpecks as speck (speck.fill)}
                    <path d={speck.d} fill={speck.fill} class="speck"></path>
                {/each}
            </g>
            {#if piece.top}
                <g clip-path="url(#{prefix}-top-clip)">
                    {#each piece.topSpecks as speck (speck.fill)}
                        <path d={speck.d} fill={speck.fill} class="speck"></path>
                    {/each}
                </g>
            {:else}
                <!-- The top in the shadow of the disc resting on it: the crease between them. -->
                <ellipse cy={top.y} rx={top.rx} ry={top.ry} fill={piece.crease}></ellipse>
            {/if}
        </g>
    {/each}
</g>

<style>
    .speck {
        opacity: 0.9;
    }
</style>
