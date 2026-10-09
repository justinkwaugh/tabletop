<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        canvasStripesId,
        StallShadowOffset,
        tentOutline,
        tentRidge
    } from '$lib/utils/stalls.js'

    const PoleRadius = 3.2
    const ShadedSideOpacity = 0.3

    let {
        width,
        height,
        color,
        clipId
    }: { width: number; height: number; color: MarketColor; clipId: string } = $props()
    const gameSession = getGameSession()

    let palette = $derived(gameSession.marketPalettes[color])
    let vertical = $derived(height > width)
    let outline = $derived(tentOutline(width, height))
    let shadedSide = $derived(
        vertical
            ? { x: width / 2, y: 0, width: width / 2, height }
            : { x: 0, y: height / 2, width, height: height / 2 }
    )
    let poles = $derived([
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height }
    ])
</script>

<clipPath id={clipId}>
    <path d={outline}></path>
</clipPath>
<path
    d={outline}
    transform="translate({StallShadowOffset.x} {StallShadowOffset.y})"
    fill="#3a2410"
    stroke="#3a2410"
    stroke-width="5"
    stroke-opacity="0.45"
    stroke-linejoin="round"
    opacity="0.28"
></path>
<path
    d={outline}
    fill="url(#{canvasStripesId(color, vertical)})"
    stroke={palette.awning.outline}
    stroke-width="1.5"
    stroke-linejoin="round"
></path>
<rect
    x={shadedSide.x}
    y={shadedSide.y}
    width={shadedSide.width}
    height={shadedSide.height}
    fill={palette.awning.outline}
    opacity={ShadedSideOpacity}
    clip-path="url(#{clipId})"
></rect>
<path
    d={tentRidge(width, height)}
    stroke={palette.awning.outline}
    stroke-width="1.8"
    stroke-linecap="round"
></path>
{#each poles as pole, index (index)}
    <circle cx={pole.x} cy={pole.y} r={PoleRadius} fill="#7a4f2a" stroke="#4a2f17" stroke-width="1"
    ></circle>
{/each}
