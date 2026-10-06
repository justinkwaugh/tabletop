<script lang="ts">
    import { MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        AwningClothFilterId,
        AwningCreaseBlurId,
        awningGradientId,
        awningStripesId
    } from '$lib/utils/awning.js'

    const gameSession = getGameSession()

    const StripeRepeat = 26
</script>

<filter id={AwningClothFilterId} x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035 0.11" numOctaves="3" seed="7"
    ></feTurbulence>
    <feColorMatrix
        type="matrix"
        values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.1 0.95"
        result="sheen"
    ></feColorMatrix>
    <feComposite in="sheen" in2="SourceGraphic" operator="in" result="clothSheen"></feComposite>
    <feBlend in="clothSheen" in2="SourceGraphic" mode="soft-light" result="cloth"></feBlend>
    <feDropShadow
        in="cloth"
        dx="2"
        dy="3"
        stdDeviation="2"
        flood-color="#3a2a14"
        flood-opacity="0.35"
    ></feDropShadow>
</filter>
<filter id={AwningCreaseBlurId} x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur stdDeviation="2.2"></feGaussianBlur>
</filter>

{#each Object.values(MarketColor) as color (color)}
    {@const palette = gameSession.marketPalettes[color]}
    <radialGradient id={awningGradientId(color)} cx="50%" cy="50%" r="65%">
        <stop offset="0" stop-color={palette.awning.glow}></stop>
        <stop offset="0.65" stop-color={palette.awning.base}></stop>
        <stop offset="1" stop-color={palette.awning.rim}></stop>
    </radialGradient>
    {#each [false, true] as vertical (vertical)}
        <pattern
            id={awningStripesId(color, vertical)}
            width={StripeRepeat}
            height={StripeRepeat}
            patternUnits="userSpaceOnUse"
            patternTransform={vertical ? 'rotate(90)' : undefined}
        >
            <rect width={StripeRepeat} height={StripeRepeat} fill={palette.awning.base}></rect>
            <rect width="10" height={StripeRepeat} fill={palette.awning.band}></rect>
            <rect x="13" width="2" height={StripeRepeat} fill={palette.awning.pinstripe}></rect>
            <rect x="18" width="2" height={StripeRepeat} fill={palette.awning.highlight}></rect>
        </pattern>
    {/each}
{/each}
