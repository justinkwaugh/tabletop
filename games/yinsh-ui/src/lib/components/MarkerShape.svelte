<script lang="ts">
    import { MARKER_FACE, MARKER_RADIUS, MARKER_SIDE } from '$lib/board/pieceGeometry.js'
    import { capsule } from '$lib/board/pieceShapes.js'
    import {
        MARKER_BLUE,
        MARKER_STYLES,
        markerSpecks,
        seedOf,
        type Tone
    } from '$lib/board/pieceStyle.js'
    import SpeckMark from './SpeckMark.svelte'

    let { tone, seedKey, scale = 1 }: { tone: Tone; seedKey: string; scale?: number } = $props()

    const style = $derived(MARKER_STYLES[tone])
    const radius = $derived(MARKER_RADIUS * scale)
    const side = $derived(MARKER_SIDE * scale)
    const specks = $derived(markerSpecks(seedOf(seedKey), MARKER_FACE))
</script>

<path d={capsule(radius, side)} fill={MARKER_BLUE.side} stroke={MARKER_BLUE.edge} stroke-width="0.8"
></path>
{#each specks.side as speck, index (index)}
    <SpeckMark
        {...speck}
        r={Math.min(speck.r, (side / radius) * 0.3)}
        y={radius * Math.sqrt(1 - speck.x * speck.x) + speck.v * side}
        scale={radius}
        fill={speck.color}
    />
{/each}
<circle r={radius} fill={MARKER_BLUE.face} stroke={MARKER_BLUE.edge} stroke-width="0.8"></circle>
{#each specks.lip as speck, index (index)}
    <SpeckMark {...speck} y={speck.y * radius} scale={radius} fill={speck.color} />
{/each}
<circle r={radius * MARKER_FACE} fill={style.face} stroke={style.edge} stroke-width="0.6"></circle>
