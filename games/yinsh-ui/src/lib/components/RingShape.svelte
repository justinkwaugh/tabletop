<svelte:options namespace="svg" />

<script lang="ts">
    import { VIEW } from '$lib/board/geometry.js'
    import { RING_OUTER } from '$lib/board/pieceGeometry.js'
    import { ringDrawing } from '$lib/board/pieceShape.js'
    import { RING_STYLES, ringSpecks, seedOf, type Tone } from '$lib/board/pieceStyle.js'
    import { RING_HOLE } from '$lib/board/pieceShape.js'
    import SpeckMark from './SpeckMark.svelte'

    // A ring standing on its point. The gradients come from a PieceDefs with the same prefix in
    // the same SVG. `near` draws only the half in front of the hole, over a marker sitting in it.
    let {
        tone,
        seedKey,
        prefix,
        near = false
    }: { tone: Tone; seedKey: string; prefix: string; near?: boolean } = $props()

    const drawing = ringDrawing(VIEW, RING_OUTER)
    const style = $derived(RING_STYLES[tone])
    const specks = $derived(ringSpecks(tone, seedOf(seedKey), RING_HOLE))
</script>

<g clip-path={near ? `url(#${prefix}-near-half)` : undefined}>
    {#each drawing.slices as slice, index (index)}
        <path
            d="M {-slice.rx} {slice.y} A {slice.rx} {slice.ry} 0 1 0 {slice.rx} {slice.y} A {slice.rx} {slice.ry} 0 1 0 {-slice.rx} {slice.y} Z {drawing.through}"
            fill-rule="evenodd"
            fill="url(#{prefix}-{tone}-side-{slice.level})"
        ></path>
    {/each}
    {#each specks.side as speck, index (index)}
        <SpeckMark
            {...speck}
            r={speck.r * 0.8}
            y={RING_OUTER * VIEW.tilt * Math.sqrt(1 - speck.x * speck.x) -
                drawing.height * (1 - speck.v)}
            scale={RING_OUTER}
            fill={style.speck}
        />
    {/each}
    <path d={drawing.outline} fill="none" stroke={style.edge} stroke-width="0.8"></path>
    <path
        d={drawing.top}
        fill-rule="evenodd"
        fill={style.face}
        stroke={style.edge}
        stroke-width="0.6"
    ></path>
    <path d={drawing.innerEdge} fill-rule="evenodd" fill={style.innerEdge}></path>
    <g transform="translate(0 {-drawing.height}) scale(1 {VIEW.tilt})">
        {#each specks.face as speck, index (index)}
            <SpeckMark {...speck} y={speck.y * RING_OUTER} scale={RING_OUTER} fill={style.speck} />
        {/each}
    </g>
    {#if !near}
        <path d={drawing.farWall} fill-rule="evenodd" fill="url(#{prefix}-{tone}-wall)"></path>
        <g clip-path="url(#{prefix}-ring-wall)">
            {#each specks.wall as speck, index (index)}
                <SpeckMark
                    x={Math.cos(speck.angle) * RING_HOLE}
                    y={RING_OUTER * RING_HOLE * VIEW.tilt * Math.sin(speck.angle) +
                        drawing.wall.bottom +
                        (drawing.wall.top - drawing.wall.bottom) * speck.v}
                    r={speck.r * 0.8}
                    stretch={speck.stretch}
                    angle={speck.angle2}
                    scale={RING_OUTER}
                    fill={style.speck}
                />
            {/each}
        </g>
    {/if}
</g>
