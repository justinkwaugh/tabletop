<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { MarketColor } from '@tabletop/marracash'
    import PawnCountChip from '$lib/components/PawnCountChip.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { signEdgeColor } from '$lib/utils/playerColors.js'
    import { CastShadowFilterId } from '$lib/utils/boardGeometry.js'
    import { shopSignLayout, SignShadowOffset, standeeOutline } from '$lib/utils/shopSign.js'

    const Cream = '#f6e7c1'
    const FrameScale = 0.84
    const FrameCenterY = -28

    let {
        ownerId,
        center,
        vertical,
        customers,
        marketColor,
        highlighted = false
    }: {
        ownerId: string
        center: Point
        vertical: boolean
        customers: number
        marketColor: MarketColor
        highlighted?: boolean
    } = $props()

    const gameSession = getGameSession()

    let seat = $derived(gameSession.seatOf(ownerId))
    let ownerName = $derived(gameSession.getPlayerName(ownerId))
    let fill = $derived(gameSession.colors.getPlayerBgColorValue(ownerId))
    let edge = $derived(signEdgeColor(gameSession.colors.getPlayerColor(ownerId)))
    let ink = $derived(gameSession.colors.getPlayerTextColorValue(ownerId))
    let layout = $derived(shopSignLayout(center, vertical, customers))
    let outline = $derived(standeeOutline(seat))
</script>

<g transform="translate({layout.ground.x} {layout.ground.y})" aria-label="Owned by {ownerName}">
    <path
        d={outline}
        transform="translate({SignShadowOffset.x} {SignShadowOffset.y})"
        fill="#000000"
        opacity="0.35"
        filter="url(#{CastShadowFilterId})"
    ></path>
    <path d={outline} {fill} stroke={edge} stroke-width="1.5" stroke-linejoin="round"></path>
    <path
        d={outline}
        transform="translate(0 {FrameCenterY}) scale({FrameScale}) translate(0 {-FrameCenterY})"
        fill="none"
        stroke={Cream}
        stroke-width={1.3 / FrameScale}
        stroke-linejoin="round"
        opacity="0.9"
    ></path>
    <path d="M -3.5 -45 L 0 -48.5 L 3.5 -45 L 0 -41.5 Z" fill={Cream} opacity="0.9"></path>
    <path d="M -3 -13.5 L 0 -16 L 3 -13.5 L 0 -11 Z" fill={Cream} opacity="0.9"></path>
    <text x="0" y="-27" class="sign-initial marracash-initial" fill={ink}
        >{ownerName.charAt(0).toUpperCase()}</text
    >
</g>
{#if customers > 0}
    <PawnCountChip
        color={marketColor}
        count={customers}
        x={layout.chip.x}
        y={layout.chip.y}
        label="{customers} customers"
        {highlighted}
    />
{/if}

<style>
    .sign-initial {
        font-size: 22px;
        text-anchor: middle;
        dominant-baseline: central;
    }
</style>
