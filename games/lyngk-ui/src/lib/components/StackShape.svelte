<svelte:options namespace="svg" />

<script lang="ts">
    import type { PieceColor } from '@tabletop/lyngk'
    import { sideHeight, stackDiscs, TILT } from '$lib/board/pieceGeometry.js'
    import { faceSpecks, pieceSeed, PIECE_STYLES, sideSpecks } from '$lib/board/pieceStyle.js'

    let {
        stack,
        radius,
        seedKey = 'icon',
        baseLevel = 0
    }: {
        stack: readonly PieceColor[]
        radius: number
        // The point and level the stack's specks are seeded for.
        seedKey?: string
        baseLevel?: number
    } = $props()

    const ry = $derived(radius * TILT)
    const side = $derived(sideHeight(radius))
    const pieces = $derived(
        stackDiscs(stack.length, radius).map((disc, index) => {
            const color = stack[index]
            const seed = pieceSeed(seedKey, baseLevel + index, color)
            return {
                ...disc,
                color,
                style: PIECE_STYLES[color],
                specks: faceSpecks(color, seed),
                sideSpecks: sideSpecks(color, seed),
                top: index === stack.length - 1
            }
        })
    )

    // The side band below a face: the lower half of the face ellipse, then the same half one
    // side height lower.
    function sidePath(faceY: number): string {
        const r = radius
        return `M ${-r} ${faceY} L ${-r} ${faceY + side} A ${r} ${ry} 0 0 0 ${r} ${faceY + side} L ${r} ${faceY} A ${r} ${ry} 0 0 1 ${-r} ${faceY} Z`
    }

    function speckEllipse(r: number, stretch: number) {
        return { rx: r * radius * stretch, ry: r * radius }
    }
</script>

{#if pieces.length > 0}
    <ellipse rx={radius * 1.02} ry={ry * 1.05} cy={pieces[0].faceY + side + 1.5} class="shadow"
    ></ellipse>
{/if}
{#each pieces as piece, index (index)}
    <path d={sidePath(piece.faceY)} fill={piece.style.side} stroke={piece.style.edge} class="side"
    ></path>
    {#each piece.sideSpecks as speck, s (s)}
        {@const shape = speckEllipse(speck.r, speck.stretch)}
        <ellipse
            cx={speck.x * radius}
            cy={piece.faceY + ry * Math.sqrt(1 - speck.x * speck.x) + speck.v * side}
            rx={shape.rx}
            ry={Math.min(shape.ry, side * 0.3)}
            fill={piece.style.speck}
            class="speck"
        ></ellipse>
    {/each}
    <ellipse
        rx={radius}
        {ry}
        cy={piece.faceY}
        fill={piece.style.face}
        stroke={piece.style.edge}
        class="face"
    ></ellipse>
    {#if piece.top}
        <!-- The moulded rim and groove the pieces nest by. -->
        <ellipse
            rx={radius * 0.8}
            ry={ry * 0.8}
            cy={piece.faceY + 0.8}
            stroke={piece.style.bevel}
            class="groove"
        ></ellipse>
        <ellipse
            rx={radius * 0.8}
            ry={ry * 0.8}
            cy={piece.faceY}
            stroke={piece.style.groove}
            class="groove"
        ></ellipse>
        <ellipse
            rx={radius * 0.62}
            ry={ry * 0.62}
            cy={piece.faceY}
            stroke={piece.style.groove}
            class="groove inner"
        ></ellipse>
        {#each piece.specks as speck, s (s)}
            {@const shape = speckEllipse(speck.r, speck.stretch)}
            <ellipse
                transform="translate({speck.x * radius} {piece.faceY +
                    speck.y * ry}) scale(1 {TILT}) rotate({speck.angle})"
                rx={shape.rx}
                ry={shape.ry}
                fill={piece.style.speck}
                class="speck"
            ></ellipse>
        {/each}
    {/if}
{/each}

<style>
    .shadow {
        fill: rgb(0 0 0 / 0.25);
    }

    .side,
    .face {
        stroke-width: 0.9;
    }

    .groove {
        fill: none;
        stroke-width: 1.3;
    }

    .groove.inner {
        stroke-width: 0.9;
        opacity: 0.7;
    }

    .speck {
        opacity: 0.9;
    }
</style>
