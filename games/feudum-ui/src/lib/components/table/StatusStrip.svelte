<script lang="ts">
    import { sunray } from '@tabletop/feudum'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const Token = 15

    let myId = $derived(gameSession.myPlayerId)
    let view = $derived(myId === undefined ? undefined : gameSession.seatPanel(myId))
    let round = $derived(gameSession.gameState.roundManager.currentRound?.number ?? 1)
    let paint = $derived(myId === undefined ? undefined : gameSession.paintOf(myId))
</script>

<div
    class="flex h-[28px] items-center gap-x-1.5 overflow-hidden whitespace-nowrap border-y border-feudum-divider px-1 text-xs text-feudum-text"
    data-status-strip
>
    <span class="font-semibold" data-status-epoch
        >{sunray(gameSession.gameState.epoch).ray}·R{round}</span
    >
    {#if view}
        {#each view.supply.goods as { good, count } (good)}
            <span class="inline-flex items-center" data-status-good={good}>
                <GoodToken {good} size={Token} />{count}
            </span>
        {/each}
        <span class="inline-flex items-center" data-status-shillings>
            <ShillingToken value={1} size={Token} />{view.supply.shillings}
        </span>
        <span class="inline-flex items-center" data-status-barrel>
            <GoodToken good="sulfur" size={Token} />{view.barrel.sulfur}/{view.barrel.capacity}
        </span>
        {#if paint}
            <span class="inline-flex items-center" data-status-discs>
                <SeatToken kind="disc" {paint} size={Token} />{view.supply.freeDiscs}
            </span>
        {/if}
    {/if}
</div>
