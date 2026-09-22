<script lang="ts">
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import GameEnding from '../ending/GameEnding.svelte'
    import TrackBuilding from '../maps/TrackBuilding.svelte'
    import StationBuilding from '../maps/StationBuilding.svelte'
    import AutomaticRoutes from '../routes/AutomaticRoutes.svelte'
    import EarningsDistribution from '../earnings/EarningsDistribution.svelte'
    import StockRoundActions from './StockRoundActions.svelte'
    import TrainBuying from '../trains/TrainBuying.svelte'
    import CompanyDecisions from '../finance/CompanyDecisions.svelte'
    let {
        session,
        createRouteWorker,
        onFocusRoute,
        privateOperationDescription
    }: {
        createRouteWorker: () => Worker
        onFocusRoute: (trainId: string) => void
        privateOperationDescription: (id: string, companyId: string) => string | undefined
        session: EighteenXXSession
    } = $props()
    const { trainColors, poolName, privateTilePrompts } = $derived(session.presentation)
    const state = $derived(session.gameState)
    const trainBuying = $derived(state.machineState === 'BuyingTrains')
</script>

{#if state.result}<GameEnding {session} />
{:else}
    {#if (state.purchaseOffer && !(trainBuying && state.purchaseOffer.asset.kind === 'train')) || state.trackConsent || state.privateTrackLay || state.privatePowerWindow || session.decisions.purchaseOptions.some((option) => !trainBuying || option.request.asset.kind !== 'train') || session.decisions.privateTileOptions.length || session.decisions.privateTrainOptions.length || session.decisions.selection}
        <CompanyDecisions
            {session}
            {trainColors}
            {privateTilePrompts}
            showUndo={false}
            excludeTrainPurchases={trainBuying}
        />
    {/if}
    {#if !session.privateActions.selection && !session.privateActions.trackPowerSelection && state.purchaseOffer?.asset.kind !== 'private'}
        {#if state.machineState === 'StockRound'}
            <StockRoundActions {session} {poolName} />
        {:else if state.machineState === 'LayingTrack'}<TrackBuilding
                {session}
                showUndo={false}
                mapControls
            />
        {:else if state.machineState === 'PlacingStation'}<StationBuilding
                {session}
                showUndo={false}
            />
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
