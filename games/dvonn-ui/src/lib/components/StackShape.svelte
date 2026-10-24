<svelte:options namespace="svg" />

<script lang="ts">
    import { HOLE_RATIO, SIDE, stackDiscs, TILT } from '$lib/board/pieceGeometry.js'
    import {
        faceSpecks,
        PIECE_STYLES,
        seedOf,
        sideSpecks,
        type Tone
    } from '$lib/board/pieceStyle.js'

    let {
        tones,
        seedKeys,
        radius,
        showCount = true
    }: {
        // Bottom to top, one per piece; each piece's specks are seeded by its key, so they go
        // with it as it moves.
        tones: readonly Tone[]
        seedKeys: readonly string[]
        radius: number
        showCount?: boolean
    } = $props()

    const uid = $props.id()
    const clipId = `dvonn-hole-${uid}`
    const ry = $derived(radius * TILT)
    const hole = $derived(radius * HOLE_RATIO)
    const holeRy = $derived(hole * TILT)
    const discs = $derived(
        stackDiscs(
            tones.length,
            radius,
            tones.map((tone) => tone === 'red')
        ).map((disc, index) => {
            const tone = tones[index]
            const seed = seedOf(`${seedKeys[index]}:${tone}`)
            return {
                ...disc,
                tone,
                style: PIECE_STYLES[tone],
                sideSpecks: sideSpecks(seed),
                specks: index === tones.length - 1 ? faceSpecks(tone, seed, HOLE_RATIO) : []
            }
        })
    )
    const top = $derived(discs.at(-1))
    // The count sits in the top piece's hole, light on dark so it reads on every color.
    const countSize = $derived(radius * (tones.length >= 10 ? 0.74 : 0.88))

    // The side band below a face: the lower half of the face ellipse, then the same half one
    // side lower.
    function sidePath(faceY: number, side: number): string {
        const r = radius
        return `M ${-r} ${faceY} L ${-r} ${faceY + side} A ${r} ${ry} 0 0 0 ${r} ${faceY + side} L ${r} ${faceY} A ${r} ${ry} 0 0 1 ${-r} ${faceY} Z`
    }

    // Down the hole every piece shows its true thickness, even where the stack's bands are
    // thinned, so a tall stack shows only pieces there and a short one the board below.
    const walls = $derived.by(() => {
        const depth = radius * SIDE
        const faceY = top?.faceY ?? 0
        return discs.toReversed().map((disc, index) => ({
            faceY: faceY + index * depth,
            depth,
            color: disc.style.wall,
            seam: disc.style.seam
        }))
    })

    // Looking down the hole: each disc's inner wall shows between its top opening and the opening
    // one disc lower; below the last one the board shows through.
    function wallBand(faceY: number, depth: number): string {
        const rx = hole
        const r = holeRy
        if (depth >= 2 * r) {
            return `M ${-rx} ${faceY} a ${rx} ${r} 0 1 0 ${2 * rx} 0 a ${rx} ${r} 0 1 0 ${-2 * rx} 0 Z`
        }
        const x = rx * Math.sqrt(1 - (depth / (2 * r)) ** 2)
        const y = faceY + depth / 2
        return `M ${-x} ${y} A ${rx} ${r} 0 1 1 ${x} ${y} A ${rx} ${r} 0 0 0 ${-x} ${y} Z`
    }

    function ringFace(faceY: number): string {
        const r = radius
        const h = hole
        const hy = h * TILT
        return `M ${-r} ${faceY} a ${r} ${ry} 0 1 0 ${2 * r} 0 a ${r} ${ry} 0 1 0 ${-2 * r} 0 Z M ${-h} ${faceY} a ${h} ${hy} 0 1 0 ${2 * h} 0 a ${h} ${hy} 0 1 0 ${-2 * h} 0 Z`
    }
</script>

{#each discs as disc, index (index)}
    <path
        d={sidePath(disc.faceY, disc.side)}
        fill={disc.style.side}
        stroke={disc.style.edge}
        stroke-width={Math.min(0.8, disc.side * 0.25)}
    ></path>
    {#if disc.tone === 'black' && discs[index + 1]?.tone === 'black'}
        <!-- A black piece under another black one catches a little light along its top edge, so
             the two part; a change of color parts pieces already. -->
        <path
            d="M {-radius} {disc.faceY + 0.8} A {radius} {ry} 0 0 0 {radius} {disc.faceY + 0.8}"
            class="catch"
            stroke-width={Math.min(0.9, disc.side * 0.3)}
        ></path>
    {/if}
    {#if disc.side > radius * 0.12}
        {#each disc.sideSpecks as speck, s (s)}
            <ellipse
                cx={speck.x * radius}
                cy={disc.faceY + ry * Math.sqrt(1 - speck.x * speck.x) + speck.v * disc.side}
                rx={speck.r * radius * speck.stretch}
                ry={Math.min(speck.r * radius, disc.side * 0.3)}
                fill={disc.style.speck}
                class="speck"
            ></ellipse>
        {/each}
    {/if}
{/each}
{#if top}
    <clipPath id={clipId}>
        <ellipse rx={hole} ry={holeRy} cy={top.faceY}></ellipse>
    </clipPath>
    <g clip-path="url(#{clipId})">
        {#each walls as wall, index (index)}
            <path
                d={wallBand(wall.faceY, wall.depth)}
                fill={wall.color}
                stroke={wall.seam}
                class="wall"
            ></path>
        {/each}
    </g>
    <path
        d={ringFace(top.faceY)}
        fill={top.style.face}
        fill-rule="evenodd"
        stroke={top.style.edge}
        stroke-width="0.8"
    ></path>
    <!-- The moulded rim the pieces nest by. -->
    <ellipse rx={radius * 0.72} ry={ry * 0.72} cy={top.faceY} stroke={top.style.edge} class="rim"
    ></ellipse>
    {#each top.specks as speck, s (s)}
        <ellipse
            transform="translate({speck.x * radius} {top.faceY +
                speck.y * ry}) scale(1 {TILT}) rotate({speck.angle})"
            rx={speck.r * radius * speck.stretch}
            ry={speck.r * radius}
            fill={top.style.speck}
            class="speck"
        ></ellipse>
    {/each}
    {#if showCount && tones.length > 1}
        <text y={top.faceY} font-size={countSize} class="count">{tones.length}</text>
    {/if}
{/if}

<style>
    .speck {
        opacity: 0.9;
    }

    .catch {
        fill: none;
        stroke: rgb(255 255 255 / 0.32);
    }

    /* The seam between two pieces seen down the hole. */
    .wall {
        stroke-width: 0.7;
        stroke-opacity: 0.8;
    }

    .rim {
        fill: none;
        stroke-width: 0.6;
        opacity: 0.35;
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
