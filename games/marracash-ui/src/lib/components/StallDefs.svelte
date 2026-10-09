<script lang="ts">
    import { MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        canvasStripesId,
        kilimId,
        StallShadowFilterId,
        WeavePatternId
    } from '$lib/utils/stalls.js'
    import { BoardTextures } from '$lib/utils/boardTextures.js'
    import StallWeaveTexture from '$lib/textures/stall-weave.webp'

    const gameSession = getGameSession()

    const StripeRepeat = 22
    const KilimRepeat = 26
    const WeaveTileSize = BoardTextures.stallWeave.size
    const KilimCream = '#f3e6c8'

    function diamond(inset: number): string {
        const middle = KilimRepeat / 2
        return `M ${middle} ${inset} L ${KilimRepeat - inset - 2} ${middle} L ${middle} ${KilimRepeat - inset} L ${inset + 2} ${middle} Z`
    }

    const KilimCorners = [
        'M 0 0 L 3 3',
        `M ${KilimRepeat} 0 L ${KilimRepeat - 3} 3`,
        `M 0 ${KilimRepeat} L 3 ${KilimRepeat - 3}`,
        `M ${KilimRepeat} ${KilimRepeat} L ${KilimRepeat - 3} ${KilimRepeat - 3}`
    ].join(' ')
</script>

<pattern
    id={WeavePatternId}
    width={WeaveTileSize}
    height={WeaveTileSize}
    patternUnits="userSpaceOnUse"
>
    <image href={StallWeaveTexture} width={WeaveTileSize} height={WeaveTileSize}></image>
</pattern>
<filter id={StallShadowFilterId} x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="2.5"></feGaussianBlur>
</filter>

{#each Object.values(MarketColor) as color (color)}
    {@const palette = gameSession.marketPalettes[color]}
    {#each [false, true] as vertical (vertical)}
        <pattern
            id={canvasStripesId(color, vertical)}
            width={StripeRepeat}
            height={StripeRepeat}
            patternUnits="userSpaceOnUse"
            patternTransform={vertical ? 'rotate(90)' : undefined}
        >
            <rect width={StripeRepeat} height={StripeRepeat} fill={palette.awning.base}></rect>
            <rect width="9" height={StripeRepeat} fill={palette.awning.band}></rect>
            <rect
                x="12"
                width="1.5"
                height={StripeRepeat}
                fill={palette.awning.outline}
                opacity="0.5"
            ></rect>
        </pattern>
        <pattern
            id={kilimId(color, vertical)}
            width={KilimRepeat}
            height={KilimRepeat}
            patternUnits="userSpaceOnUse"
            patternTransform={vertical ? 'rotate(90)' : undefined}
        >
            <rect width={KilimRepeat} height={KilimRepeat} fill={palette.awning.base}></rect>
            <path d={diamond(2)} fill={palette.awning.band}></path>
            <path d={diamond(7)} fill={palette.awning.outline} opacity="0.6"></path>
            <path d={diamond(10.5)} fill={KilimCream} opacity="0.75"></path>
            <path d={KilimCorners} stroke={palette.awning.outline} stroke-width="2"></path>
        </pattern>
    {/each}
{/each}
