<svelte:options namespace="svg" />

<script lang="ts">
    import { VIEW } from '$lib/board/geometry.js'
    import { MARKER_HEIGHT, MARKER_RADIUS } from '$lib/board/pieceGeometry.js'
    import { ellipsePath, MARKER_FACE, markerDrawing } from '$lib/board/pieceShape.js'
    import {
        MARKER_BLUE,
        MARKER_STYLES,
        markerSpecks,
        seedOf,
        type Tone
    } from '$lib/board/pieceStyle.js'
    import SpeckMark from './SpeckMark.svelte'

    // A marker lying on its point, `tone` face up. The gradients come from a PieceDefs with the
    // same prefix in the same SVG.
    let { tone, seedKey, prefix }: { tone: Tone; seedKey: string; prefix: string } = $props()

    const drawing = markerDrawing(VIEW, MARKER_RADIUS, MARKER_HEIGHT)
    const style = $derived(MARKER_STYLES[tone])
    const specks = $derived(markerSpecks(seedOf(seedKey), MARKER_FACE))
</script>

{#each drawing.slices as slice, index (index)}
    <ellipse cy={slice.y} rx={slice.rx} ry={slice.ry} fill="url(#{prefix}-blue-side-{slice.level})"
    ></ellipse>
{/each}
{#each specks.side as speck, index (index)}
    <SpeckMark
        {...speck}
        r={speck.r * 0.7}
        y={MARKER_RADIUS * VIEW.tilt * Math.sqrt(1 - speck.x * speck.x) -
            drawing.height * (1 - speck.v)}
        scale={MARKER_RADIUS}
        fill={speck.color}
    />
{/each}
<path d={drawing.outline} fill="none" stroke={MARKER_BLUE.edge} stroke-width="0.8"></path>
<path d={ellipsePath(drawing.lip)} fill={MARKER_BLUE.lip}></path>
<g transform="translate(0 {-drawing.height}) scale(1 {VIEW.tilt})">
    {#each specks.lip as speck, index (index)}
        <SpeckMark
            {...speck}
            y={speck.y * MARKER_RADIUS}
            scale={MARKER_RADIUS}
            fill={speck.color}
        />
    {/each}
</g>
<!-- The face sits down inside the lip: the lip's inner wall shows on the far side. -->
<path
    d={ellipsePath(drawing.opening)}
    fill={MARKER_BLUE.wall}
    stroke={style.edge}
    stroke-width="0.5"
></path>
<g clip-path="url(#{prefix}-marker-wall)">
    {#each specks.wall as speck, index (index)}
        <SpeckMark
            x={Math.cos(speck.angle) * MARKER_FACE}
            y={MARKER_RADIUS * MARKER_FACE * VIEW.tilt * Math.sin(speck.angle) +
                drawing.wall.bottom +
                (drawing.wall.top - drawing.wall.bottom) * speck.v}
            r={speck.r * 0.7}
            stretch={speck.stretch}
            angle={speck.angle2}
            scale={MARKER_RADIUS}
            fill={speck.color}
        />
    {/each}
</g>
<path d={drawing.face} fill="url(#{prefix}-{tone}-face)"></path>
