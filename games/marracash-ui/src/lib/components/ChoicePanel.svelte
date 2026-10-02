<script lang="ts">
    import { getShop } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    let options = $derived(
        [
            gameSession.canMove ? 'click a fountain to move its visitors' : undefined,
            gameSession.canAuction ? 'click an unowned shop to auction it' : undefined
        ].filter((option) => option !== undefined)
    )
</script>

{#if gameSession.selectedShopId !== undefined}
    <div class="flex flex-wrap items-center justify-center gap-4">
        <p class="font-semibold">
            Auction the {getShop(gameSession.selectedShopId).color} shop? Every player will be asked for
            a sealed bid.
        </p>
        <button
            class="rounded-md bg-[#8a6a46] px-3 py-1 text-sm font-semibold text-white"
            onclick={() => gameSession.startAuction()}>Start auction</button
        >
        <button
            class="rounded-md border border-[#8a6a46] px-3 py-1 text-sm"
            onclick={() => gameSession.back()}>Back</button
        >
    </div>
{:else if gameSession.selectedFountainId === undefined}
    <p class="font-semibold">Your turn: {options.join(', or ')}.</p>
{:else}
    <div class="flex items-center justify-center gap-4">
        <p class="font-semibold">
            Choose where the visitors at fountain {gameSession.selectedFountainId} go.
        </p>
        <button
            class="rounded-md border border-[#8a6a46] px-3 py-1 text-sm"
            onclick={() => gameSession.back()}>Back</button
        >
    </div>
{/if}
