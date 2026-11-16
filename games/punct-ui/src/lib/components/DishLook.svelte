<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { VIEW, type BoardView } from '$lib/board/geometry.js'
    import { DISH, dishRings, type DishMaterial } from '$lib/board/dishShape.js'

    // A dot sunk into a piece's top as a flat-bottomed dish, drawn live ring by ring from its lip
    // in, each shaded by its gradient in `PieceDefs`; the PÜNCT's smooth insert with a soft sheen
    // on its floor, towards the light. The board shows pre-rendered images of it (board/looks.ts).
    let {
        center = { x: 0, y: 0 },
        material,
        prefix,
        view = VIEW
    }: { center?: Point; material: DishMaterial; prefix: string; view?: BoardView } = $props()

    const uid = $props.id()
    const clipId = `dish-lip-${uid}`
    const rings = $derived(dishRings(center, view))

    const insert = $derived(material.endsWith('insert'))
    const sheen = $derived.by(() => {
        const r = DISH.floor
        return {
            cx: center.x - r * 0.28,
            cy: center.y + view.height(DISH.depth) - r * view.tilt * 0.22,
            rx: r * 0.55,
            ry: r * view.tilt * 0.4
        }
    })
</script>

<clipPath id={clipId}>
    <ellipse {...rings[0]}></ellipse>
</clipPath>
<g clip-path="url(#{clipId})">
    {#each rings as ring, ringIndex (ringIndex)}
        <ellipse
            {...ring}
            fill="url(#{prefix}-dish-{material}-{ringIndex})"
            stroke="url(#{prefix}-dish-{material}-{ringIndex})"
            stroke-width="0.35"
        ></ellipse>
    {/each}
    {#if insert}
        <ellipse {...sheen} fill="url(#{prefix}-sheen)" pointer-events="none"></ellipse>
    {/if}
</g>
