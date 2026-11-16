<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { HydratedState1861, State1861 } from '@tabletop/1861'
    import {
        GameTable,
        OperatingActions,
        SelectionAuctionBidding,
        SelectionAuctionLots,
        type TitleActionDescription
    } from '@tabletop/18xx-ui'
    import { describe1861Action } from './history.js'
    import MergerRound from './MergerRound.svelte'
    import TrainlessMajor from './TrainlessMajor.svelte'
    import { requireSession1861 } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<State1861, HydratedState1861> } = $props()
    const session = $derived(requireSession1861(gameSession))
    const privateOperationDescription = () => undefined
    const historyDescription: TitleActionDescription = (action, { companyName, place }) =>
        describe1861Action(
            action,
            {
                companyName,
                place,
                playerName: (id) => session.getPlayerName(id),
                bankName: 'Bank'
            },
            session.presentation.money
        )
</script>

<GameTable {session} {privateOperationDescription} {createRouteWorker} {historyDescription}>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.selectionAuction.active}
            {#if session.selectionAuction.model?.auction.bidding}
                <SelectionAuctionBidding {session} />
            {:else}
                <SelectionAuctionLots {session} />
            {/if}
        {:else if session.mergerRound}
            <MergerRound {session} />
        {:else if session.trainlessMajor}
            <TrainlessMajor {session} companyId={session.trainlessMajor} />
        {:else}
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session} />
        {/if}
    {/snippet}
</GameTable>
