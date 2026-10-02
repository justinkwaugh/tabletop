<script lang="ts">
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    let {
        appearance,
        size = 40,
        x = 0,
        y = 0
    }: {
        appearance: StationAppearance
        size?: number
        x?: number
        y?: number
    } = $props()
    const labelFitsTokenFontSize = $derived(appearance.label.length > 3 ? 9.5 : 12)
</script>

<svg {x} {y} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    {#if appearance.imageUrl}
        <image href={appearance.imageUrl} width="40" height="40"></image>
    {:else}
        <circle cx="20" cy="20" r="19" fill={appearance.color} stroke="white"></circle>
        <text
            x="20"
            y="20"
            text-anchor="middle"
            dominant-baseline="central"
            font-family="ui-sans-serif, system-ui, sans-serif"
            font-size={labelFitsTokenFontSize}
            fill={contrastingTextColor(appearance.color)}>{appearance.label}</text
        >
    {/if}
</svg>
