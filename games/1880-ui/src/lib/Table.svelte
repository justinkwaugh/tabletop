<script lang="ts">
    import { createRouteWorker } from './routeWorker.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { HydratedState1880, State1880 } from '@tabletop/1880'
    import {
        CompanyPar,
        GameTable,
        OperatingActions,
        PlayerLoanRepayment,
        SelectionAuctionBidding,
        SelectionAuctionLots,
        type TitleActionDescription
    } from '@tabletop/18xx-ui'
    import { describe1880Action } from './history.js'
    import InvestorChoice from './InvestorChoice.svelte'
    import InvestorMerger from './InvestorMerger.svelte'
    import InvestorsInGame from './InvestorsInGame.svelte'
    import SetupHistoryEntry from './SetupHistoryEntry.svelte'
    import PrivatePowers from './PrivatePowers.svelte'
    import RocketExchange from './RocketExchange.svelte'
    import OperatingOrder from './OperatingOrder.svelte'
    import { requireSession1880 } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<State1880, HydratedState1880> } = $props()
    const session = $derived(requireSession1880(gameSession))
    const privateOperationDescription = () => undefined
    const historyDescription: TitleActionDescription = (action, names, shared) =>
        describe1880Action(action, names, session.presentation.money, shared)
</script>

{#snippet historySetup()}<SetupHistoryEntry {session} />{/snippet}

{#snippet operatingOrder(reveal: (locationId: string) => void)}<OperatingOrder
        {session}
        {reveal}
    />{/snippet}

<GameTable
    {session}
    {privateOperationDescription}
    {createRouteWorker}
    {historyDescription}
    boardPanel={{ label: 'Operating order', content: operatingOrder }}
    historySetup={session.gameState.removedInvestorIds ? historySetup : undefined}
>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.gameState.removedInvestorIds && session.gameState.machineState === 'SelectionAuction'}
            <InvestorsInGame {session} />
        {/if}
        {#if session.gameState.pendingPar}
            <CompanyPar {session} />
        {:else if session.selectionAuction.active}
            {#if session.selectionAuction.model?.auction.bidding}
                <SelectionAuctionBidding {session} />
            {:else}
                <SelectionAuctionLots {session} />
            {/if}
        {:else if session.gameState.machineState === 'ChoosingInvestors'}
            <InvestorChoice {session} />
        {:else if session.merger || session.stationChoice}
            <InvestorMerger {session} />
        {:else if session.forcedRocket}
            <RocketExchange {session} />
        {:else}
            {#if session.debtRepayment}
                <PlayerLoanRepayment
                    money={session.presentation.money}
                    owed={session.debtRepayment.owed}
                    most={session.debtRepayment.most}
                    noun="debt"
                    restriction="may buy no shares until it is repaid."
                    onRepay={(amount) => session.repayDebt(amount)}
                />
            {/if}
            <PrivatePowers {session} />
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session} />
        {/if}
    {/snippet}
</GameTable>
