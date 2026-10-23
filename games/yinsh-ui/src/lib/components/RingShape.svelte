<script lang="ts">
    import { RING_INNER, RING_OUTER, RING_SIDE } from '$lib/board/pieceGeometry.js'
    import { ringBody, ringFace } from '$lib/board/pieceShapes.js'
    import { RING_STYLES, ringSpecks, seedOf, type Tone } from '$lib/board/pieceStyle.js'
    import SpeckMark from './SpeckMark.svelte'

    let { tone, seedKey, scale = 1 }: { tone: Tone; seedKey: string; scale?: number } = $props()

    const style = $derived(RING_STYLES[tone])
    const outer = $derived(RING_OUTER * scale)
    const inner = $derived(RING_INNER * scale)
    const side = $derived(RING_SIDE * scale)
    const specks = $derived(ringSpecks(tone, seedOf(seedKey), RING_INNER / RING_OUTER))
</script>

<path
    d={ringBody(outer, inner, side)}
    fill={style.side}
    fill-rule="evenodd"
    stroke={style.edge}
    stroke-width="0.8"
></path>
{#each specks.side as speck, index (index)}
    <SpeckMark
        {...speck}
        r={Math.min(speck.r, (side / outer) * 0.3)}
        x={speck.x}
        y={outer * Math.sqrt(1 - speck.x * speck.x) + speck.v * side}
        scale={outer}
        fill={style.speck}
    />
{/each}
<path
    d={ringFace(outer, inner)}
    fill={style.face}
    fill-rule="evenodd"
    stroke={style.edge}
    stroke-width="0.8"
></path>
{#each specks.face as speck, index (index)}
    <SpeckMark {...speck} y={speck.y * outer} scale={outer} fill={style.speck} />
{/each}
