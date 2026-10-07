<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { MarketColor } from '@tabletop/marracash'
    import PawnCountChip from '$lib/components/PawnCountChip.svelte'
    import SignFace from '$lib/components/SignFace.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { signEdgeColor } from '$lib/utils/playerColors.js'
    import { CastShadowFilterId } from '$lib/utils/boardGeometry.js'
    import {
        playerStandeeOutline,
        shopSignLayout,
        SignShadowOffset,
        signInitial
    } from '$lib/utils/shopSign.js'

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

    let ownerName = $derived(gameSession.getPlayerName(ownerId))
    let fill = $derived(gameSession.colors.getPlayerBgColorValue(ownerId))
    let edge = $derived(signEdgeColor(gameSession.colors.getPlayerColor(ownerId)))
    let ink = $derived(gameSession.colors.getPlayerTextColorValue(ownerId))
    let layout = $derived(shopSignLayout(center, vertical, customers))
    let outline = $derived(playerStandeeOutline(gameSession.gameState.players, ownerId))
</script>

<g transform="translate({layout.ground.x} {layout.ground.y})" aria-label="Owned by {ownerName}">
    <path
        d={outline}
        transform="translate({SignShadowOffset.x} {SignShadowOffset.y})"
        fill="#000000"
        opacity="0.35"
        filter="url(#{CastShadowFilterId})"
    ></path>
    <SignFace {outline} {fill} {edge}>
        <text x="0" y="-27" class="sign-initial marracash-initial" fill={ink}
            >{signInitial(ownerName)}</text
        >
    </SignFace>
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
