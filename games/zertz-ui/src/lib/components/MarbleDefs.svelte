<svelte:options namespace="svg" />

<script lang="ts">
    import { MARBLE_COLORS } from '@tabletop/zertz'
    import { MARBLE_BODY_STOPS } from '$lib/board/marbleStyle.js'

    let { prefix }: { prefix: string } = $props()
</script>

{#each MARBLE_COLORS as color (color)}
    <radialGradient id="{prefix}-body-{color}" cx="0.38" cy="0.35" r="0.72">
        {#each MARBLE_BODY_STOPS[color] as stop (stop.offset)}
            <stop offset={stop.offset} stop-color={stop.color}></stop>
        {/each}
    </radialGradient>
{/each}
<radialGradient id="{prefix}-sheen" cx="0.34" cy="0.3" r="0.3">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.42"></stop>
    <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.08"></stop>
    <stop offset="1" stop-color="#ffffff" stop-opacity="0"></stop>
</radialGradient>
