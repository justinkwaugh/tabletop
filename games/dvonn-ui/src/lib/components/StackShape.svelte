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
        pieceDrawing,
        SHADE_LEVELS,
        wallBand,
        type Ellipse
    } from '$lib/board/pieceShape.js'
    import {
        faceSpecks,
        PIECE_STYLES,
        seedOf,
        sideSpecks,
        wallSpecks,
        type Tone
    } from '$lib/board/pieceStyle.js'

    // A stack standing on its space, seen from the near side of the table, bottom piece first.
    // The gradients come from a PieceDefs with the same prefix in the same SVG.
    let {
        tones,
        seedKeys,
        radius,
        prefix,
        showCount = true,
        catchLight = 0,
        model = PIECE_MODEL
    }: {
        // Bottom to top, one per piece; each piece's specks are seeded by its key, so they go
        // with it as it moves.
        tones: readonly Tone[]
        seedKeys: readonly string[]
        radius: number
        prefix: string
        showCount?: boolean
        // How bright a black piece's top edge shows under another black piece; 0 for none.
        catchLight?: number
        model?: PieceModel
    } = $props()

    const uid = $props.id()
    const throughId = `dvonn-through-${uid}`
    const openingId = `dvonn-opening-${uid}`
    const MID_LEVEL = (SHADE_LEVELS - 1) / 2

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
                style: PIECE_STYLES[tone],
                seed,
                sideSpecks: sideSpecks(tone, seed, model.thickness),
                specks: top ? faceSpecks(tone, seed, model.hole) : [],
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
                const upper = shift(drawing.opening, top.base + index * pitch)
                const lower = shift(drawing.bottomOpening, top.base + index * pitch)
                const depth = lower.y - upper.y
                return {
                    band: wallBand(upper, lower),
                    style: piece.style,
                    seen: upper.y - upper.ry < opening.y + opening.ry,
                    specks: wallSpecks(piece.tone, piece.seed, model.hole, model.thickness).map(
                        (speck) => {
                            const turn = Math.PI * speck.turn
                            return {
                                x: -upper.rx * Math.cos(turn),
                                y: upper.y - upper.ry * Math.sin(turn) + speck.v * depth,
                                rx: speck.r * radius * speck.stretch * Math.sin(turn),
                                ry: Math.min(speck.r * radius, depth * 0.2),
                                alt: speck.alt
                            }
                        }
                    )
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
    // The count sits in the top piece's hole, light on dark so it reads on every color; sized to
    // read on a phone without crowding the hole.
    const countSize = $derived(radius * (tones.length >= 10 ? 0.64 : 0.76))

    function speckAt(x: number, y: number) {
        const distance = Math.hypot(x, y)
        return { x: x * radius, y: drawing.surface(distance) + y * radius * TILT }
    }
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
                {#each drawing.side as slice, s (s)}
                    <ellipse
                        cy={slice.y}
                        rx={slice.rx}
                        ry={slice.ry}
                        fill="url(#{prefix}-{piece.tone}-side-{slice.level})"
                    ></ellipse>
                {/each}
                {#each piece.sideSpecks as speck, s (s)}
                    <ellipse
                        cx={speck.x * radius}
                        cy={-drawing.height * (1 - speck.v) +
                            radius * TILT * Math.sqrt(1 - speck.x * speck.x)}
                        rx={speck.r * radius * speck.stretch * Math.sqrt(1 - speck.x * speck.x)}
                        ry={Math.min(speck.r * radius, drawing.height * 0.2)}
                        fill={speck.alt ? piece.style.speckAlt : piece.style.speck}
                        class="speck"
                    ></ellipse>
                {/each}
                {#if piece.top}
                    {#each drawing.top as slice, s (s)}
                        <ellipse
                            cy={slice.y}
                            rx={slice.rx}
                            ry={slice.ry}
                            fill="url(#{prefix}-{piece.tone}-top-{slice.level})"
                        ></ellipse>
                    {/each}
                {:else}
                    <!-- The top in the shadow of the piece resting on it: the crease between
                         them. -->
                    <ellipse
                        cy={drawing.rim.y}
                        rx={drawing.rim.rx}
                        ry={drawing.rim.ry}
                        fill={creaseColor(piece.tone)}
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
                stroke={creaseColor(piece.tone)}
                stroke-width={Math.min(0.6, piece.side * 0.3)}
            ></path>
            {#each piece.sideSpecks as speck, s (s)}
                <ellipse
                    cx={speck.x * radius}
                    cy={piece.base -
                        piece.side * (1 - speck.v) +
                        radius * TILT * Math.sqrt(1 - speck.x * speck.x)}
                    rx={speck.r * radius * speck.stretch * Math.sqrt(1 - speck.x * speck.x)}
                    ry={Math.min(speck.r * radius, piece.side * 0.35)}
                    fill={speck.alt ? piece.style.speckAlt : piece.style.speck}
                    class="speck"
                ></ellipse>
            {/each}
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
            <path d={wall.band} fill={wall.style.wall}></path>
            {#each wall.specks as speck, s (s)}
                <ellipse
                    cx={speck.x}
                    cy={speck.y}
                    rx={speck.rx}
                    ry={speck.ry}
                    fill={speck.alt ? wall.style.speckAlt : wall.style.speck}
                    class="speck wall-speck"
                ></ellipse>
            {/each}
        {/each}
    </g>
    {#each top.specks as speck, s (s)}
        {@const at = speckAt(speck.x, speck.y)}
        <ellipse
            transform="translate({at.x} {top.base + at.y}) scale(1 {TILT}) rotate({speck.angle})"
            rx={speck.r * radius * speck.stretch}
            ry={speck.r * radius}
            fill={speck.alt ? top.style.speckAlt : top.style.speck}
            class="speck"
        ></ellipse>
    {/each}
    {#if showCount && tones.length > 1}
        <text y={hole.opening.y} font-size={countSize} class="count">{tones.length}</text>
    {/if}
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

    .count {
        fill: #ffffff;
        stroke: #000000;
        stroke-width: 2.4;
        paint-order: stroke;
        stroke-linejoin: round;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
        font-variant-numeric: tabular-nums;
        pointer-events: none;
    }
</style>
