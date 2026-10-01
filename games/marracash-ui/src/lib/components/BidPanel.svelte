<script lang="ts">
    import { DirhamIncrement, getShop } from '@tabletop/marracash'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    let myMoney = $derived(gameSession.myMoney())
    let minimumBid = $derived(gameSession.myMinimumBid())
    let shopId = $derived(gameSession.gameState.auctionShopId)
    let shop = $derived(shopId ? getShop(shopId) : undefined)
    let amount = $state(gameSession.myMinimumBid())
    let clampedAmount = $derived(Math.min(Math.max(amount, minimumBid), myMoney))

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
            disabled={clampedAmount <= minimumBid}
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
            {index > 0 ? ', ' : ''}<PlayerTag playerId={participant.playerId} />
        {/each}
    </p>
</div>
