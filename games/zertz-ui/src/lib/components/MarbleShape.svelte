<svelte:options namespace="svg" />

<script lang="ts">
    import type { MarbleColor } from '@tabletop/zertz'
    import { SPECK_COLOR, speckField } from '$lib/board/marbleStyle.js'

    let {
        prefix,
        color,
        radius,
        seed,
        speckDensity = 1,
        speckScale = 1
    }: {
        prefix: string
        color: MarbleColor
        radius: number
        seed: number
        speckDensity?: number
        speckScale?: number
    } = $props()

    const speckColor = $derived(SPECK_COLOR[color])
    const specks = $derived(speckColor ? speckField(color, seed, speckDensity) : [])
</script>

<circle r={radius} fill="url(#{prefix}-body-{color})"></circle>
{#each specks as speck, index (index)}
    <circle
        cx={speck.x * radius}
        cy={speck.y * radius}
        r={speck.r * radius * speckScale}
        fill={speckColor}
        fill-opacity={speck.opacity}
    ></circle>
{/each}
<circle r={radius} fill="url(#{prefix}-sheen)"></circle>
