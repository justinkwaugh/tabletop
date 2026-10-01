<script lang="ts">
    import { DirhamIncrement, getShop } from '@tabletop/marracash'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    let myMoney = $derived(
        gameSession.myPlayer
            ? gameSession.gameState.getPlayerState(gameSession.myPlayer.id).getMoney()
            : 0
    )
    let shopId = $derived(gameSession.gameState.auctionShopId)
    let shop = $derived(shopId ? getShop(shopId) : undefined)
    let amount = $state(gameSession.minimumBid)
    let clampedAmount = $derived(Math.min(Math.max(amount, gameSession.minimumBid), myMoney))

    function change(step: number) {
        amount = clampedAmount + step
    }
</script>

<div class="flex flex-col items-center gap-2">
    <p class="font-semibold">
        Sealed bid for the {shop?.color} shop {shopId}. You have {myMoney} Dirham.
    </p>
    <div class="flex items-center gap-2">
        <button
            class="h-8 w-8 rounded-md border border-[#8a6a46]"
            aria-label="Lower bid"
            disabled={clampedAmount <= gameSession.minimumBid}
            onclick={() => change(-DirhamIncrement)}>−</button
        >
        <span class="w-24 text-xl font-bold">{clampedAmount}</span>
        <button
            class="h-8 w-8 rounded-md border border-[#8a6a46]"
            aria-label="Raise bid"
            disabled={clampedAmount + DirhamIncrement > myMoney}
            onclick={() => change(DirhamIncrement)}>+</button
        >
        <button
            class="ml-2 rounded-md bg-[#8a6a46] px-4 py-1 font-semibold text-white"
            onclick={() => gameSession.placeBid(clampedAmount)}
            >{clampedAmount === 0 ? 'Pass' : 'Place sealed bid'}</button
        >
    </div>
    <p class="text-sm">
        Still to bid:
        {#each gameSession.gameState.auction?.participants.filter((p) => !p.submitted) ?? [] as participant, index (participant.playerId)}
            {#if index > 0},
            {/if}<PlayerName playerId={participant.playerId} />
        {/each}
    </p>
</div>
