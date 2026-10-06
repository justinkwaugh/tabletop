<script lang="ts">
    import type { Snippet } from 'svelte'
    import { DirhamIncrement, getShop } from '@tabletop/marracash'
    import DirhamAmount from '$lib/components/DirhamAmount.svelte'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { holdRepeat } from '$lib/utils/holdRepeat.js'

    let { lead }: { lead?: Snippet } = $props()
    const gameSession = getGameSession()

    let myMoney = $derived(gameSession.myMoney())
    let minimumBid = $derived(gameSession.myMinimumBid())
    let shopId = $derived(gameSession.gameState.auction?.shopId)
    let shop = $derived(shopId ? getShop(shopId) : undefined)
    let clampedAmount = $derived(withinBidLimits(gameSession.draftBid ?? minimumBid))

    function withinBidLimits(bid: number): number {
        return Math.min(Math.max(bid, minimumBid), myMoney)
    }

    function change(step: number): boolean {
        const next = withinBidLimits(clampedAmount + step)
        if (next === clampedAmount) return false
        gameSession.setDraftBid(next)
        return true
    }
</script>

<div class="flex flex-col items-center gap-2">
    <p class="font-semibold">
        {@render lead?.()}
        Sealed bid for the highlighted {shop?.color} shop. You have <DirhamAmount
            amount={myMoney}
        />
    </p>
    <div class="flex items-center gap-3">
        <button
            class="h-10 w-10 touch-manipulation rounded-md border-2 select-none border-[#8a6a46] bg-[#e3cfa8] text-2xl leading-none font-bold text-[#3d2f1f] hover:bg-[#d8bf91] disabled:opacity-40"
            aria-label="Lower bid"
            disabled={clampedAmount <= minimumBid}
            use:holdRepeat={() => change(-DirhamIncrement)}>−</button
        >
        <span class="marracash-display w-24 text-xl">{clampedAmount}</span>
        <button
            class="h-10 w-10 touch-manipulation rounded-md border-2 select-none border-[#8a6a46] bg-[#e3cfa8] text-2xl leading-none font-bold text-[#3d2f1f] hover:bg-[#d8bf91] disabled:opacity-40"
            aria-label="Raise bid"
            disabled={clampedAmount + DirhamIncrement > myMoney}
            use:holdRepeat={() => change(DirhamIncrement)}>+</button
        >
    </div>
    <button
        class="mt-2 w-32 rounded-md bg-[#8a6a46] py-1.5 text-center font-semibold whitespace-nowrap text-white hover:bg-[#765a3b]"
        onclick={() => gameSession.placeBid(clampedAmount)}
        >{clampedAmount === 0 ? 'Pass' : 'Place bid'}</button
    >
    <p class="text-sm">
        Still to bid:
        {#each gameSession.gameState.auction?.awaitingBidderIds() ?? [] as playerId (playerId)}
            {' '}<PlayerTag {playerId} />
        {/each}
    </p>
</div>
