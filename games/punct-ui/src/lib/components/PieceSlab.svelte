<script lang="ts">
    import type { PieceKind } from '@tabletop/punct'
    import { VIEW, type BoardView } from '$lib/board/geometry.js'
    import { DISH, dishRings, type DishMaterial } from '$lib/board/dishShape.js'
    import { drawPiece, pathOf, type Tone } from '$lib/board/pieceShape.js'
    import { speckPaths } from '$lib/board/specks.js'

    // One piece standing on whatever is under it, its PÜNCT at the origin: its rounded side as
    // slices, bottom first, each shaded by the gradients in `PieceDefs` under the same prefix;
    // the speckled top with its three dots sunk as flat-bottomed dishes, the PÜNCT's in its
    // smooth insert.
    let {
        kind,
        angle,
        tone,
        seed,
        prefix,
        view = VIEW
    }: {
        kind: PieceKind
        angle: number
        tone: Tone
        seed: number
        prefix: string
        view?: BoardView
    } = $props()

    const drawing = $derived(drawPiece(kind, angle, view))
    // A soft sheen on the PÜNCT's smooth floor, towards the light.
    const sheen = $derived.by(() => {
        const { x, y } = drawing.dots[0]
        const r = DISH.floor
        return {
            cx: x - r * 0.28,
            cy: y + view.height(DISH.depth) - r * view.tilt * 0.22,
            rx: r * 0.55,
            ry: r * view.tilt * 0.4
        }
    })
    const specks = $derived(speckPaths(kind, seed, angle, view))
</script>

<g class="piece {tone}">
    {#each drawing.slices as slice, index (index)}
        <path d={pathOf(slice.points)} fill="url(#{prefix}-{tone}-{slice.shade})" class="slice"
        ></path>
    {/each}
    <path d={specks.side} class="specks side-specks"></path>
    <path d={pathOf(drawing.top)} class="top"></path>
    {#each drawing.dots as dot, index (index)}
        {@const material: DishMaterial = index === 0 ? `${tone}-insert` : tone}
        {#each dishRings(dot, view) as ring, ringIndex (ringIndex)}
            <ellipse
                {...ring}
                fill="url(#{prefix}-dish-{material}-{ringIndex})"
                stroke="url(#{prefix}-dish-{material}-{ringIndex})"
                class="dish-ring"
            ></ellipse>
        {/each}
    {/each}
    <path d={specks.top} class="specks"></path>
    <ellipse {...sheen} fill="url(#{prefix}-sheen)" class="sheen"></ellipse>
</g>

<style>
    .slice {
        stroke: none;
    }

    /* Each ring stroked in its own shading, so no seam of the top shows between rings. */
    .dish-ring {
        stroke-width: 0.35;
    }

    .sheen {
        pointer-events: none;
    }

    /* A light edge round each top, so pieces crossing pieces of their colour part. */
    .light .top {
        fill: rgb(226 230 236);
        stroke: rgb(150 158 170);
        stroke-width: 1;
    }

    .dark .top {
        fill: rgb(44 48 52);
        stroke: rgb(115 122 130);
        stroke-width: 1.3;
    }

    .light .specks {
        fill: #24282d;
    }

    .dark .specks {
        fill: #d6dbe1;
    }

    .side-specks {
        opacity: 0.8;
    }
</style>
