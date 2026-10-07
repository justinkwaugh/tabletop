<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        PawnBaseY,
        PawnBodyShadeId,
        PawnBrimCrease,
        PawnBrimShadowId,
        PawnBrimY,
        PawnClipId,
        PawnFootShadeId,
        PawnGroundShadowId,
        PawnHatShadeId,
        PawnLipCrease,
        PawnOutline,
        PawnTopY,
        PawnWaistShadeId,
        PawnWaistY
    } from '$lib/utils/pawnShape.js'
    import { CandidateHaloFilterId } from '$lib/utils/boardGeometry.js'

    const HaloWidth = 3
    const HaloOpacity = 0.55

    let { color, highlighted }: { color: MarketColor; highlighted: boolean } = $props()
    const gameSession = getGameSession()

    let palette = $derived(gameSession.marketPalettes[color])
</script>

{#if highlighted}
    <path
        d={PawnOutline}
        fill="none"
        stroke="#ffffff"
        stroke-width={HaloWidth}
        stroke-opacity={HaloOpacity}
        stroke-linejoin="round"
        filter="url(#{CandidateHaloFilterId})"
    ></path>
{/if}
<ellipse cx="2" cy={PawnBaseY + 0.6} rx="9" ry="3" fill="url(#{PawnGroundShadowId})"></ellipse>
<path d={PawnOutline} fill={palette.fill}></path>
<g clip-path="url(#{PawnClipId})">
    <rect
        x="-8"
        y={PawnTopY}
        width="16"
        height={PawnBaseY + 2 - PawnTopY}
        fill="url(#{PawnBodyShadeId})"
    ></rect>
    <rect x="-8" y={PawnTopY} width="16" height={PawnBrimY - PawnTopY} fill="url(#{PawnHatShadeId})"
    ></rect>
    <rect x="-8" y={PawnBrimY} width="16" height="2.6" fill="url(#{PawnBrimShadowId})"></rect>
    <rect x="-8" y={PawnWaistY - 1.2} width="16" height="2.8" fill="url(#{PawnWaistShadeId})"
    ></rect>
    <rect x="-8" y={PawnBaseY - 3} width="16" height="5" fill="url(#{PawnFootShadeId})"></rect>
    <path d={PawnBrimCrease} fill="none" stroke={palette.stroke} stroke-width="0.8" opacity="0.7"
    ></path>
    <path d={PawnLipCrease} fill="none" stroke={palette.stroke} stroke-width="0.7" opacity="0.5"
    ></path>
</g>
<path d={PawnOutline} fill="none" stroke={palette.stroke} stroke-width="1.5" stroke-linejoin="round"
></path>
