<svelte:options namespace="svg" />

<script lang="ts">
    import type { MarbleColor } from '@tabletop/zertz'
    import { SPECK_COLOR } from '$lib/board/marbleStyle.js'

    let {
        prefix,
        color,
        radius,
        speckTurn = 0
    }: { prefix: string; color: MarbleColor; radius: number; speckTurn?: number } = $props()
</script>

<circle r={radius} fill="url(#{prefix}-body-{color})"></circle>
{#if SPECK_COLOR[color]}
    <circle r={radius} fill="url(#{prefix}-speck-{color})" transform="rotate({speckTurn})"></circle>
{/if}
<circle r={radius} fill="url(#{prefix}-sheen)"></circle>
