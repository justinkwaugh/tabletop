<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        PawnBaseY,
        PawnBodyShadeId,
        PawnClipId,
        PawnFootShadeId,
        PawnGroundShadowId,
        PawnHeadCenterY,
        PawnHeadRadius,
        PawnHeadShadeId,
        PawnNeckShadeId,
        PawnNeckY,
        PawnOutline
    } from '$lib/utils/pawnShape.js'

    let { color }: { color: MarketColor } = $props()
    const gameSession = getGameSession()

    let palette = $derived(gameSession.marketPalettes[color])
</script>

<ellipse cx="2" cy={PawnBaseY + 0.6} rx="9" ry="3" fill="url(#{PawnGroundShadowId})"></ellipse>
<path d={PawnOutline} fill={palette.fill}></path>
<g clip-path="url(#{PawnClipId})">
    <rect
        x="-8"
        y={PawnNeckY}
        width="16"
        height={PawnBaseY + 2 - PawnNeckY}
        fill="url(#{PawnBodyShadeId})"
    ></rect>
    <circle cx="0" cy={PawnHeadCenterY} r={PawnHeadRadius} fill="url(#{PawnHeadShadeId})"></circle>
    <rect x="-8" y={PawnNeckY - 1.6} width="16" height="3.8" fill="url(#{PawnNeckShadeId})"></rect>
    <rect x="-8" y={PawnBaseY - 3} width="16" height="5" fill="url(#{PawnFootShadeId})"></rect>
</g>
<path d={PawnOutline} fill="none" stroke={palette.stroke} stroke-width="1.5" stroke-linejoin="round"
></path>
