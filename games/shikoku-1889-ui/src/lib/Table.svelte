<script lang="ts">
    import { privatePowerUsed } from '@tabletop/18xx'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { Shikoku1889State, HydratedShikoku1889State } from '@tabletop/shikoku-1889'
    import {
        GameTable,
        OperatingActions,
        WaterfallAuctionBidding,
        WaterfallAuctionLots,
        requireEighteenXXSession
    } from '@tabletop/18xx-ui'
    function createRouteWorker() {
        return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
    }
    let { gameSession }: { gameSession: GameSession<Shikoku1889State, HydratedShikoku1889State> } =
        $props()
    const session = $derived(requireEighteenXXSession(gameSession))
    const privateOperationDescription = (id: string) =>
        id === 'SRR'
            ? 'Ignores mountain-only terrain costs. Combined river and mountain costs still apply.'
            : id === 'ER' && !privatePowerUsed(session.gameState, id)
              ? 'On purchase, the seller may immediately upgrade Ohzu in addition to ordinary construction.'
              : undefined
</script>

<GameTable {session} {privateOperationDescription}>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.waterfall.model && !session.waterfall.model.auction.completed}
            {#if session.waterfall.model.auction.bidding}
                <WaterfallAuctionBidding {session} />
            {:else}
                <WaterfallAuctionLots {session} />
            {/if}
        {:else}
            <OperatingActions
                {privateOperationDescription}
                onFocusRoute={focusRoute}
                {session}
                {createRouteWorker}
            />
        {/if}
    {/snippet}
</GameTable>
