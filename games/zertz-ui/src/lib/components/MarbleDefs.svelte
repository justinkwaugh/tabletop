<svelte:options namespace="svg" />

<script lang="ts">
    import { MARBLE_COLORS } from '@tabletop/zertz'
    import { MARBLE_BODY_STOPS, SPECK_COLOR, SPECK_TILE, SPECKS } from '$lib/board/marbleStyle.js'

    let { prefix, speckScale = 1 }: { prefix: string; speckScale?: number } = $props()
</script>

{#each MARBLE_COLORS as color (color)}
    <radialGradient id="{prefix}-body-{color}" cx="0.38" cy="0.35" r="0.72">
        {#each MARBLE_BODY_STOPS[color] as stop (stop.offset)}
            <stop offset={stop.offset} stop-color={stop.color}></stop>
        {/each}
    </radialGradient>
    {#if SPECK_COLOR[color]}
        <pattern
            id="{prefix}-speck-{color}"
            width={SPECK_TILE.width}
            height={SPECK_TILE.height}
            patternUnits="userSpaceOnUse"
            patternTransform="scale({speckScale})"
        >
            {#each SPECKS as speck, index (index)}
                <circle
                    cx={speck.x}
                    cy={speck.y}
                    r={speck.r}
                    fill={SPECK_COLOR[color]}
                    fill-opacity="0.85"
                ></circle>
            {/each}
        </pattern>
    {/if}
{/each}
<radialGradient id="{prefix}-sheen" cx="0.32" cy="0.28" r="0.42">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.75"></stop>
    <stop offset="1" stop-color="#ffffff" stop-opacity="0"></stop>
</radialGradient>
