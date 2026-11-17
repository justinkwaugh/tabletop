<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import {
        NationalisationRules1867,
        type HydratedState1867,
        type State1867
    } from '@tabletop/1867'
    import {
        GameTable,
        MergerRound,
        OperatingActions,
        TrainlessMajor,
        SelectionAuctionBidding,
        SelectionAuctionLots,
        type TitleActionDescription
    } from '@tabletop/18xx-ui'
    import { describe1867Action } from './history.js'
    import { requireSession1867 } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<State1867, HydratedState1867> } = $props()
    const session = $derived(requireSession1867(gameSession))
    const privateOperationDescription = () => undefined
    const historyDescription: TitleActionDescription = (action, { companyName, place }) =>
        describe1867Action(
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
        {:else if session.mergers.round}
            <MergerRound {session} mergers={session.mergers} />
        {:else if session.trainless.companyId}
            <TrainlessMajor
                {session}
                trainless={session.trainless}
                companyId={session.trainless.companyId}
                spacesPerLoan={NationalisationRules1867.stepsPerLoan}
            />
        {:else}
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session} />
        {/if}
    {/snippet}
</GameTable>
