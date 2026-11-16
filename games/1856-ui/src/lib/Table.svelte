<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import {
        CanadaCompanyId,
        WaterlooId,
        type HydratedState1856,
        type State1856
    } from '@tabletop/1856'
    import {
        GameTable,
        OperatingActions,
        WaterfallAuctionLots,
        type TitleActionDescription
    } from '@tabletop/18xx-ui'
    import { describe1856Action } from './history.js'
    import NationalFormation from './NationalFormation.svelte'
    import NationalMarketShare from './NationalMarketShare.svelte'
    import NationalPresidency from './NationalPresidency.svelte'
    import { requireSession1856 } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<State1856, HydratedState1856> } = $props()
    const session = $derived(requireSession1856(gameSession))

    const privateOperationDescription = (id: string) =>
        id === WaterlooId
            ? 'May lay #59 in Kitchener if it is bare, and place a free station there, each in place of its own, without a route.'
            : id === CanadaCompanyId
              ? 'May lay a tile in its hex besides its own lay, without a route.'
              : undefined
    const historyDescription: TitleActionDescription = (action, { companyName }) =>
        describe1856Action(
            action,
            {
                companyName,
                playerName: (id) => session.getPlayerName(id),
                bankName: 'Bank'
            },
            session.presentation.money
        )
</script>

<GameTable {session} {privateOperationDescription} {createRouteWorker} {historyDescription}>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.waterfall.model && !session.waterfall.model.auction.completed}
            <WaterfallAuctionLots {session} />
        {:else if session.nationalFormation}
            <NationalFormation {session} />
        {:else}
            {#if session.presidencyShare}
                <NationalPresidency {session} offers={session.presidencyShare} />
            {:else if session.marketShareOwed}
                <NationalMarketShare {session} owed={session.marketShareOwed} />
            {/if}
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session} />
        {/if}
    {/snippet}
</GameTable>
