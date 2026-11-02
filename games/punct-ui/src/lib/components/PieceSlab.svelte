<script lang="ts">
    import type { PieceKind } from '@tabletop/punct'
    import { DISH_RADIUS, PUNCT_RADIUS, VIEW, type BoardView } from '$lib/board/geometry.js'
    import { drawPiece, pathOf, type Tone } from '$lib/board/pieceShape.js'
    import { speckPaths } from '$lib/board/specks.js'

    // One piece standing on whatever is under it, its PÜNCT at the origin: the side strips
    // that face the viewer, the speckled top, the two dished minor dots and the PÜNCT's smooth
    // insert.
    let {
        kind,
        angle,
        tone,
        seed,
        view = VIEW
    }: { kind: PieceKind; angle: number; tone: Tone; seed: number; view?: BoardView } = $props()

    const drawing = $derived(drawPiece(kind, angle, view))
    const facing = $derived(new Set(drawing.sides.map((side) => side.edge)))
    const specks = $derived(speckPaths(kind, seed, angle, view, facing))

    // Each side strip shaded by how much it faces the light.
    const SHADES: Record<Tone, { lit: number[]; shaded: number[] }> = {
        light: { lit: [214, 219, 226], shaded: [150, 157, 168] },
        dark: { lit: [46, 50, 54], shaded: [14, 15, 17] }
    }

    function sideFill(light: number): string {
        const { lit, shaded } = SHADES[tone]
        const mix = lit.map((value, index) =>
            Math.round(shaded[index] + (value - shaded[index]) * light)
        )
        return `rgb(${mix.join(' ')})`
    }
</script>

<g class="piece {tone}">
    <path d={pathOf(drawing.base)} class="base"></path>
    {#each drawing.sides as side (side.edge)}
        <path
            d={pathOf(side.points)}
            fill={sideFill(side.light)}
            stroke={sideFill(side.light)}
            class="side"
        ></path>
    {/each}
    <path d={specks.side} class="specks side-specks"></path>
    <path d={pathOf(drawing.top)} class="top"></path>
    {#each drawing.dots.slice(1) as dot, index (index)}
        <ellipse cx={dot.x} cy={dot.y} rx={DISH_RADIUS} ry={DISH_RADIUS * view.tilt} class="dish"
        ></ellipse>
        <path
            d="M {dot.x - DISH_RADIUS} {dot.y} A {DISH_RADIUS} {DISH_RADIUS *
                view.tilt} 0 0 1 {dot.x + DISH_RADIUS} {dot.y} A {DISH_RADIUS} {DISH_RADIUS *
                view.tilt *
                0.55} 0 0 0 {dot.x - DISH_RADIUS} {dot.y} Z"
            class="dish-wall"
        ></path>
    {/each}
    <path d={specks.top} class="specks"></path>
    <ellipse
        cx={drawing.dots[0].x}
        cy={drawing.dots[0].y}
        rx={PUNCT_RADIUS}
        ry={PUNCT_RADIUS * view.tilt}
        class="punct"
    ></ellipse>
    <!-- A catch-light along the far rim of the smooth insert, where its lip meets the light. -->
    <path
        d="M {drawing.dots[0].x - PUNCT_RADIUS * 0.78} {drawing.dots[0].y -
            PUNCT_RADIUS * view.tilt * 0.3} A {PUNCT_RADIUS * 0.82} {PUNCT_RADIUS *
            view.tilt *
            0.82} 0 0 1 {drawing.dots[0].x + PUNCT_RADIUS * 0.3} {drawing.dots[0].y -
            PUNCT_RADIUS * view.tilt * 0.78}"
        class="glint"
    ></path>
</g>

<style>
    .base {
        stroke-width: 0.6;
    }

    .side {
        stroke-width: 0.5;
    }

    .light .base {
        fill: #8e95a1;
        stroke: #8e95a1;
    }

    .dark .base {
        fill: #0b0c0d;
        stroke: #0b0c0d;
    }

    .light .top {
        fill: #e2e6ec;
        stroke: #b9bfc9;
        stroke-width: 0.8;
    }

    .dark .top {
        fill: #25282b;
        stroke: #16181a;
        stroke-width: 0.8;
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

    .light .dish {
        fill: #d6dbe2;
        stroke: #858d99;
        stroke-width: 1.5;
    }

    .dark .dish {
        fill: #1b1d1f;
        stroke: #646b72;
        stroke-width: 1.4;
    }

    /* The far wall of each dish lies in the shade of its lip. */
    .light .dish-wall {
        fill: rgb(70 80 95 / 0.3);
    }

    .dark .dish-wall {
        fill: rgb(0 0 0 / 0.5);
    }

    .light .punct {
        fill: #fbfbf9;
        stroke: #a7aeb8;
        stroke-width: 1;
    }

    .dark .punct {
        fill: #111315;
        stroke: #4d545b;
        stroke-width: 1;
    }

    .glint {
        fill: none;
        stroke-linecap: round;
        stroke-width: 1.6;
    }

    .dark .glint {
        stroke: rgb(255 255 255 / 0.32);
    }

    .light .glint {
        stroke: rgb(255 255 255 / 0.9);
    }
</style>
