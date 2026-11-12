<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import StartOrder from './StartOrder.svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import { PrivateRules1849, type HydratedState1849, type State1849 } from '@tabletop/1849'
    import { privateOwningCompany } from '@tabletop/18xx'
    import {
        CompanyPar,
        GameTable,
        OperatingActions,
        WaterfallAuctionLots,
        requireEighteenXXSession
    } from '@tabletop/18xx-ui'
    let { gameSession }: { gameSession: GameSession<State1849, HydratedState1849> } = $props()
    const session = $derived(requireEighteenXXSession(gameSession))
    // A company's private shows what it can still do for it.
    const privateOperationDescription = (privateCompanyId: string) =>
        privateOwningCompany(session.gameState, privateCompanyId)
            ? PrivateRules1849.description(session.gameState, privateCompanyId)
            : undefined
</script>

{#snippet startOrder(reveal: (locationId: string) => void)}<StartOrder
        {session}
        {reveal}
    />{/snippet}

<GameTable
    {session}
    {privateOperationDescription}
    {createRouteWorker}
    boardPanel={{ label: 'Start order', content: startOrder }}
>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.gameState.pendingPar}
            <CompanyPar {session} />
        {:else if session.waterfall.model && !session.waterfall.model.auction.completed}
            <WaterfallAuctionLots {session} />
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
