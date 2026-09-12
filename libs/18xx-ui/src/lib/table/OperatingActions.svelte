<script lang="ts">
    import type { StockMenuOption } from '../stock/stockActionSelection.js'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import GameEnding from '../examples/GameEnding.svelte'
    import TrackBuilding from '../examples/TrackBuilding.svelte'
    import StationBuilding from '../examples/StationBuilding.svelte'
    import RouteBuilding from '../examples/RouteBuilding.svelte'
    import EarningsDistribution from '../examples/EarningsDistribution.svelte'
    import StockRoundActions from './StockRoundActions.svelte'
    import TrainBuying from '../examples/TrainBuying.svelte'
    import CompanyDecisions from '../examples/CompanyDecisions.svelte'
    let { session, additionalStockActions = [] }: { session: FinanceExampleSession; additionalStockActions?: readonly StockMenuOption[] } = $props()
    const state = $derived(session.financialState)
</script>

{#if state.result}<GameEnding {session} />
{:else}
    {#if state.purchaseOffer || state.trackConsent || state.privateTrackLay || state.privatePowerWindow || session.purchaseOptions.length || session.privateTileOptions.length || session.privateTrainOptions.length || session.companyDecisionSelection}
        <CompanyDecisions {session} showUndo={false} />
    {/if}
    {#if state.machineState === 'StockRound'}
        <StockRoundActions {session} additionalActions={additionalStockActions} />
    {:else if state.machineState === 'LayingTrack'}<TrackBuilding
            {session}
            showUndo={false}
            mapControls
        />
    {:else if state.machineState === 'PlacingStation'}<StationBuilding {session} showUndo={false} />
    {:else if state.machineState === 'RunningTrains'}<RouteBuilding {session} showUndo={false} />
    {:else if state.machineState === 'DistributingEarnings'}<EarningsDistribution
            {session}
            showUndo={false}
        />
    {:else}<TrainBuying {session} showUndo={false} />{/if}
{/if}
