<script lang="ts">
    import type { CertificatePool } from '@tabletop/18xx'
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
        privateOperationDescription,
        poolName
    }: {
        createRouteWorker: () => Worker
        onFocusRoute: (trainId: string) => void
        trainColors: Readonly<Record<string, string>>
        privateOperationDescription: (id: string, companyId: string) => string | undefined
        poolName?: (pool: CertificatePool) => string
        session: FinanceExampleSession
    } = $props()
    const state = $derived(session.financialState)
    const trainBuying = $derived(state.machineState === 'BuyingTrains')
</script>

{#if state.result}<GameEnding {session} />
{:else}
    {#if (state.purchaseOffer && !(trainBuying && state.purchaseOffer.asset.kind === 'train')) || state.trackConsent || state.privateTrackLay || state.privatePowerWindow || session.purchaseOptions.some((option) => !trainBuying || option.request.asset.kind !== 'train') || session.privateTileOptions.length || session.privateTrainOptions.length || session.companyDecisionSelection}
        <CompanyDecisions {session} showUndo={false} excludeTrainPurchases={trainBuying} />
    {/if}
    {#if !session.privatePurchaseSource && state.purchaseOffer?.asset.kind !== 'private'}
    {#if state.machineState === 'StockRound'}
        <StockRoundActions {session} {poolName} />
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
    {:else}<TrainBuying {session} {trainColors} showUndo={false} />{/if}
    {/if}
{/if}
