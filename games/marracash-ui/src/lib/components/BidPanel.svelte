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
        Sealed bid for the highlighted {shop?.color} shop. You have {myMoney} Dirham.
    </p>
    <div class="flex items-center gap-3">
        <button
            class="h-10 w-10 rounded-md border-2 border-[#8a6a46] bg-[#e3cfa8] text-2xl leading-none font-bold text-[#3d2f1f] hover:bg-[#d8bf91] disabled:opacity-40"
            aria-label="Lower bid"
            disabled={clampedAmount <= minimumBid}
            onclick={() => change(-DirhamIncrement)}>−</button
        >
        <span class="marracash-display w-24 text-xl">{clampedAmount}</span>
        <button
            class="h-10 w-10 rounded-md border-2 border-[#8a6a46] bg-[#e3cfa8] text-2xl leading-none font-bold text-[#3d2f1f] hover:bg-[#d8bf91] disabled:opacity-40"
            aria-label="Raise bid"
            disabled={clampedAmount + DirhamIncrement > myMoney}
            onclick={() => change(DirhamIncrement)}>+</button
        >
    </div>
    <button
        class="mt-2 w-32 rounded-md bg-[#8a6a46] py-1.5 text-center font-semibold whitespace-nowrap text-white hover:bg-[#765a3b]"
        onclick={() => gameSession.placeBid(clampedAmount)}
        >{clampedAmount === 0 ? 'Pass' : 'Place bid'}</button
    >
    <p class="text-sm">
        Still to bid:
        {#each gameSession.gameState.auction?.participants.filter((p) => !p.submitted) ?? [] as participant, index (participant.playerId)}
            {index > 0 ? ', ' : ''}<PlayerTag playerId={participant.playerId} />
        {/each}
    </p>
</div>
