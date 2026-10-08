<script lang="ts">
    import { getDescriptionForAction } from '$lib/utils/actionDescriptions.js'
    import { auctionedGoodsById } from '$lib/utils/historyEntries.js'
    import { Button } from 'flowbite-svelte'
    import ActorLine from './ActorLine.svelte'
    import AuctionResults from './AuctionResults.svelte'
    import { isEndAuction, isPlaceBid } from '@tabletop/fresh-fish'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession()

    let lastAction = $derived(gameSession.actions.findLast((action) => !isPlaceBid(action)))
    let auctionedGoods = $derived(auctionedGoodsById(gameSession.actions))
</script>

{#if lastAction || gameSession.hasManualSelection}
    <div
        class="rounded-lg bg-transparent text-gray-200 p-1 sm:p-2 text-center flex flex-row justify-center items-center mb-2"
    >
        <div class="flex flex-col justify-center items-center w-full grow-1">
            {#if lastAction && isEndAuction(lastAction)}
                <AuctionResults action={lastAction} goodsType={auctionedGoods.get(lastAction.id)} />
            {:else if lastAction}
                <ActorLine playerId={lastAction.playerId}>
                    {getDescriptionForAction(lastAction)}
                </ActorLine>
            {/if}
        </div>

        {#if (gameSession.undoableAction || gameSession.hasManualSelection) && gameSession.isPlayable}
            <Button
                onclick={async () => {
                    await gameSession.undo()
                }}
                size="xs"
                class="h-[24px] sm:h-[28px] grow-0 ms-2"
                color="light">Undo</Button
            >
        {/if}
    </div>
{/if}
