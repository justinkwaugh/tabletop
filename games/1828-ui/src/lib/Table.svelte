<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import { PrivateCatalog1828, type HydratedState1828, type State1828 } from '@tabletop/1828'
    import {
        CompanyPar,
        GameTable,
        OperatingActions,
        WaterfallAuctionLots,
        type TitleActionDescription
    } from '@tabletop/18xx-ui'
    import { describe1828Action } from './history.js'
    import MergeProposal from './MergeProposal.svelte'
    import MergerFailed from './MergerFailed.svelte'
    import MohawkExchange from './MohawkExchange.svelte'
    import MergerProgress from './MergerProgress.svelte'
    import TitleActions from './TitleActions.svelte'
    import CobourgRun from './CobourgRun.svelte'
    import { requireSession1828 } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<State1828, HydratedState1828> } = $props()
    const session = $derived(requireSession1828(gameSession))

    const privateOperationDescription = (id: string) =>
        PrivateCatalog1828.definition(id).description
    const historyDescription: TitleActionDescription = (action, { companyName, place }, shared) =>
        describe1828Action(
            action,
            {
                companyName,
                place,
                playerName: (id) => session.getPlayerName(id),
                bankName: 'Bank'
            },
            session.presentation.money,
            shared
        )
</script>

<GameTable
    {session}
    {privateOperationDescription}
    {createRouteWorker}
    {historyDescription}
    additionalStockActions={session.stockPanels.menuOptions}
>
    {#snippet offTurnPanel()}
        {#if session.failedMerger}<MergerFailed {session} merger={session.failedMerger} />{/if}
        {#if session.mohawkExchangeOpen}<MohawkExchange {session} />{/if}
    {/snippet}
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.failedMerger}<MergerFailed {session} merger={session.failedMerger} />{/if}
        {#if session.gameState.pendingPar}
            <CompanyPar {session} />
        {:else if session.waterfall.model && !session.waterfall.model.auction.completed}
            <WaterfallAuctionLots {session} />
        {:else if session.merger}
            <MergerProgress {session} />
        {:else if session.stockPanels.open === 'merge'}
            <MergeProposal {session} />
        {:else if session.mohawkExchangeOpen}
            <MohawkExchange {session} />
        {:else if session.cobourgRunning}
            <CobourgRun {session} />
        {:else}
            <TitleActions {session} />
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session} />
        {/if}
    {/snippet}
</GameTable>
