<script lang="ts">
    import type { StockMenuOption } from '../stock/stockActionSelection.js'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import GameEnding from '../examples/GameEnding.svelte'
    import TrackBuilding from '../examples/TrackBuilding.svelte'
    import StationBuilding from '../examples/StationBuilding.svelte'
    import AutomaticRoutes from '../routes/AutomaticRoutes.svelte'
    import EarningsDistribution from '../examples/EarningsDistribution.svelte'
    import StockRoundActions from './StockRoundActions.svelte'
    import TrainBuying from '../examples/TrainBuying.svelte'
    import CompanyDecisions from '../examples/CompanyDecisions.svelte'
    let {
        session,
        createRouteWorker,
        onFocusRoute,
        trainColors,
        additionalStockActions = []
    }: {
        createRouteWorker: () => Worker
        onFocusRoute: (trainId: string) => void
        trainColors: Readonly<Record<string, string>>
        session: FinanceExampleSession
        additionalStockActions?: readonly StockMenuOption[]
    } = $props()
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
    {:else if state.machineState === 'RunningTrains'}<AutomaticRoutes
            {session}
            {createRouteWorker}
            {onFocusRoute}
            {trainColors}
        />
    {:else if state.machineState === 'DistributingEarnings'}<EarningsDistribution
            {session}
            showUndo={false}
        />
    {:else}<TrainBuying {session} showUndo={false} />{/if}
{/if}
