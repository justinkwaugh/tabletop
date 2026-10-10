<script lang="ts">
    import type { MarketColor, ShopId } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        kilimId,
        rugFringe,
        rugOutline,
        StallShadowOffset,
        WeavePatternId
    } from '$lib/utils/stalls.js'

    const FringeColor = '#efe1c4'

    let {
        shopId,
        width,
        height,
        color,
        clipId
    }: {
        shopId: ShopId
        width: number
        height: number
        color: MarketColor
        clipId: string
    } = $props()
    const gameSession = getGameSession()

    let palette = $derived(gameSession.marketPalettes[color])
    let vertical = $derived(height > width)
    let outline = $derived(rugOutline(shopId, width, height))
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
<path d={outline} fill="url(#{kilimId(color, vertical)})"></path>
<path d={outline} fill="url(#{WeavePatternId})"></path>
<g clip-path="url(#{clipId})" fill="none">
    <path d={outline} stroke={palette.awning.band} stroke-width="14"></path>
    <path d={outline} stroke={palette.awning.outline} stroke-width="6"></path>
</g>
{#each rugFringe(width, height) as thread (`${thread.from.x},${thread.from.y}`)}
    <line
        x1={thread.from.x}
        y1={thread.from.y}
        x2={thread.to.x}
        y2={thread.to.y}
        stroke={FringeColor}
        stroke-width="1.3"
    ></line>
{/each}
