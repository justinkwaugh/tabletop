<svelte:options namespace="svg" />

<script lang="ts">
    import {
        PIECE_MODEL,
        RISE,
        stackDiscs,
        TILT,
        type PieceModel
    } from '$lib/board/pieceGeometry.js'
    import {
        bandPath,
        creaseColor,
        ellipsePath,
        lens,
        lookBox,
        pieceDrawing,
        SHADE_LEVELS,
        wallBand,
        type Ellipse
    } from '$lib/board/pieceShape.js'
    import { lookUrl } from '$lib/board/looks.js'
    import { seedOf, type Tone } from '$lib/board/pieceStyle.js'
    import { sideSpeckPaths, topSpeckPaths, wallSpeckPaths } from '$lib/board/specks.js'

    // A stack standing on its space, seen from the near side of the table, bottom piece first.
    // Each whole piece is an image of its colour's look, pre-rendered by
    // scripts/render-looks.mjs, with its own specks drawn over it, kept inside it by clips; the
    // hole, which shows down through the stack, is drawn over the top piece. The gradients and
    // the clips come from a PieceDefs with the same prefix and radius in the same SVG.
    let {
        tones,
        seedKeys,
        radius,
        prefix,
        catchLight = 0,
        model = PIECE_MODEL,
        turned = false
    }: {
        // Bottom to top, one per piece; each piece's specks are seeded by its key, so they go
        // with it as it moves.
        tones: readonly Tone[]
        seedKeys: readonly string[]
        radius: number
        prefix: string
        // How bright a black piece's top edge shows under another black piece; 0 for none.
        catchLight?: number
        model?: PieceModel
        // On a board seen from the far side, the specks on a top turn half round with it, and
        // the side you see is the other half of the side.
        turned?: boolean
    } = $props()

    const uid = $props.id()
    const throughId = `dvonn-through-${uid}`
    const openingId = `dvonn-opening-${uid}`
    const MID_LEVEL = (SHADE_LEVELS - 1) / 2

    const box = $derived(lookBox(radius))
    const drawing = $derived(pieceDrawing(radius, model))
    const pieces = $derived(
        stackDiscs(
            tones.length,
            radius,
            tones.map((tone) => tone === 'red'),
            model
        ).map((disc, index) => {
            const tone = tones[index]
            const seed = seedOf(`${seedKeys[index]}:${tone}`)
            const top = index === tones.length - 1
            return {
                ...disc,
                tone,
                seed,
                crease: creaseColor(tone),
                sideSpecks: sideSpeckPaths(radius, tone, seed, disc.side, turned),
                // Only the top piece's top shows.
                topSpecks: top ? topSpeckPaths(radius, tone, seed, turned) : [],
                top,
                catch: catchLight > 0 && tone === 'black' && tones[index + 1] === 'black'
            }
        })
    )
    const top = $derived(pieces.at(-1))

    const shift = (ellipse: Ellipse, by: number): Ellipse => ({ ...ellipse, y: ellipse.y + by })

    // Down the hole every piece shows its true thickness, even where the stack's bands are
    // thinned, so a tall stack shows only pieces there and a short one the board below.
    const hole = $derived.by(() => {
        if (!top) return undefined
        const pitch = drawing.height + model.gap * radius * RISE
        const opening = shift(drawing.opening, top.base)
        // Walls whose top lies below the opening's near edge are out of sight.
        const walls = pieces
            .toReversed()
            .map((piece, index) => {
                const offset = top.base + index * pitch
                const upper = shift(drawing.opening, offset)
                return {
                    offset,
                    band: wallBand(upper, shift(drawing.bottomOpening, offset)),
                    tone: piece.tone,
                    seen: upper.y - upper.ry < opening.y + opening.ry,
                    specks: wallSpeckPaths(radius, piece.tone, piece.seed, turned)
                }
            })
            .filter((wall) => wall.seen)
        const bottom = shift(drawing.bottomOpening, top.base + (pieces.length - 1) * pitch)
        return {
            opening,
            // The far walls and the creases between them, all the way down.
            shadow: wallBand(opening, bottom),
            walls,
            through: lens(opening, bottom)
        }
    })

    // Everything but where the board shows through the hole.
    const outside = $derived(
        hole?.through
            ? `M ${-radius * 3} ${-radius * 6} H ${radius * 3} V ${radius * 3} H ${-radius * 3} Z ${hole.through}`
            : undefined
    )
</script>

{#if outside}
    <clipPath id={throughId}>
        <path d={outside} clip-rule="evenodd"></path>
    </clipPath>
{/if}
<g clip-path={outside ? `url(#${throughId})` : undefined}>
    {#each pieces as piece, index (index)}
        {#if piece.full}
            <g transform="translate(0 {piece.base})">
                <image
                    href={lookUrl({ tone: piece.tone })}
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
                    <!-- The top in the shadow of the piece resting on it: the crease between
                         them. -->
                    <ellipse
                        cy={drawing.rim.y}
                        rx={drawing.rim.rx}
                        ry={drawing.rim.ry}
                        fill={piece.crease}
                    ></ellipse>
                    {#if piece.catch}
                        <path
                            d="M {-radius} {drawing.rim.y + radius * 0.04} A {radius} {radius *
                                TILT} 0 0 0 {radius} {drawing.rim.y + radius * 0.04}"
                            class="catch"
                            stroke-opacity={catchLight}
                        ></path>
                    {/if}
                {/if}
            </g>
        {:else}
            <path
                d={bandPath(piece.base, piece.side, radius)}
                fill="url(#{prefix}-{piece.tone}-side-{MID_LEVEL})"
                stroke={piece.crease}
                stroke-width={Math.min(0.6, piece.side * 0.3)}
            ></path>
            <g transform="translate(0 {piece.base})">
                {#each piece.sideSpecks as speck (speck.fill)}
                    <path d={speck.d} fill={speck.fill} class="speck"></path>
                {/each}
            </g>
        {/if}
    {/each}
</g>
{#if top && hole}
    <clipPath id={openingId}>
        <path d={ellipsePath(hole.opening)}></path>
    </clipPath>
    <g clip-path="url(#{openingId})">
        <path d={hole.shadow} class="hole-shadow"></path>
        {#each hole.walls as wall, index (index)}
            <path d={wall.band} fill="url(#{prefix}-{wall.tone}-wall)"></path>
            <g transform="translate(0 {wall.offset})">
                {#each wall.specks as speck (speck.fill)}
                    <path d={speck.d} fill={speck.fill} class="wall-speck"></path>
                {/each}
            </g>
        {/each}
    </g>
{/if}

<style>
    .speck {
        opacity: 0.9;
    }

    /* Inside the hole, in shadow. */
    .wall-speck {
        opacity: 0.75;
    }

    .catch {
        fill: none;
        stroke: #ffffff;
        stroke-width: 0.8;
    }

    .hole-shadow {
        fill: rgb(0 0 0 / 0.85);
    }
</style>
