<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import TrackBuilding from '../maps/TrackBuilding.svelte'
    import StationBuilding from '../maps/StationBuilding.svelte'
    import HomeStationChoice from '../maps/HomeStationChoice.svelte'
    import PrivateStationChoice from '../maps/PrivateStationChoice.svelte'
    import AutomaticRoutes from '../routes/AutomaticRoutes.svelte'
    import ProjectedRun from '../routes/ProjectedRun.svelte'
    import EarningsDistribution from '../earnings/EarningsDistribution.svelte'
    import StockRoundActions from './StockRoundActions.svelte'
    import TrainBuying from '../trains/TrainBuying.svelte'
    import CompanyDecisions from '../finance/CompanyDecisions.svelte'
    import CompanyAuctionBidding from '../stock/CompanyAuctionBidding.svelte'
    import CompanyFormation from '../stock/CompanyFormation.svelte'
    import LoanRepayment from '../loans/LoanRepayment.svelte'
    import CashCrisis from '../funding/CashCrisis.svelte'
    import CorporateFinance from '../finance/CorporateFinance.svelte'
    import NothingToBuild from '../maps/NothingToBuild.svelte'
    import PresidencyClaims from '../stock/PresidencyClaims.svelte'
    import OperatingModeSwitch from './OperatingModeSwitch.svelte'
    import type { Snippet } from 'svelte'
    import { assertExists } from '@tabletop/common'
    import { fade } from 'svelte/transition'
    import { prefersReducedMotion } from 'svelte/motion'
    let {
        session,
        createRouteWorker,
        onFocusRoute,
        privateOperationDescription,
        titleMode
    }: {
        createRouteWorker: () => Worker
        onFocusRoute: (trainId: string) => void
        privateOperationDescription: (id: string, companyId: string) => string | undefined
        session: EighteenXXSessionView
        /** The panel of one of the session's `titleOperatingModes`, by its id. */
        titleMode?: Snippet<[string]>
    } = $props()
    const { trainColors, privateTilePrompts } = $derived(session.presentation)
    const gameState = $derived(session.gameState)
    const trainBuying = $derived(gameState.machineState === 'BuyingTrains')
    const trainOffer = $derived(trainBuying && gameState.purchaseOffer?.asset.kind === 'train')
    const titleModePanel = $derived.by(() => {
        const id = session.operatingMode.titleModeShown
        if (!id) return undefined
        assertExists(titleMode, `Title operating mode ${id} requires the table's titleMode panel`)
        return { id, panel: titleMode }
    })
</script>

{#snippet actionControls()}
    {#if (gameState.purchaseOffer && !trainOffer) || gameState.trackConsent || gameState.privateTrackLay || gameState.privatePowerWindow || session.decisions.purchaseOptions.some((option) => !trainBuying || option.request.asset.kind !== 'train') || session.decisions.privateTrainOptions.length || session.decisions.selection || session.privateActions.selection === 'powers'}
        <CompanyDecisions
            {session}
            {trainColors}
            {privateTilePrompts}
            showUndo={false}
            excludeTrainPurchases={trainBuying}
        />
    {/if}
    {#if !session.privateActions.selection && !session.decisions.selection && !session.privateActions.trackPowerSelection && (!gameState.purchaseOffer || trainOffer)}
        {#if gameState.machineState === 'StockRound' && session.companyAuction.pending}
            <CompanyFormation {session} />
        {:else if gameState.machineState === 'StockRound' && session.companyAuction.auction}
            <CompanyAuctionBidding {session} />
        {:else if gameState.machineState === 'StockRound'}
            <StockRoundActions {session} />
        {:else if session.stations.homeChoice}<HomeStationChoice {session} />
        {:else if session.stations.privateStation}<PrivateStationChoice {session} />
        {:else if gameState.machineState === 'LayingTrack'}<TrackBuilding
                {session}
                showUndo={false}
                mapControls
            /><ProjectedRun {session} {onFocusRoute} />
        {:else if gameState.machineState === 'PlacingStation'}<StationBuilding
                {session}
                showUndo={false}
            /><ProjectedRun {session} {onFocusRoute} />
        {:else if gameState.machineState === 'RunningTrains'}<AutomaticRoutes
                {session}
                {createRouteWorker}
                {onFocusRoute}
                {trainColors}
            />
        {:else if gameState.machineState === 'DistributingEarnings'}<EarningsDistribution
                {session}
                showUndo={false}
            />
        {:else if gameState.machineState === 'RaisingCash'}<CashCrisis {session} showUndo={false} />
        {:else if gameState.machineState === 'RepayingLoans'}<LoanRepayment
                {session}
                showUndo={false}
            />
        {:else}<TrainBuying {session} {trainColors} showUndo={false} />{/if}
    {/if}
{/snippet}

{#snippet stationsWithTrack()}
    <div class="centered-panel">
        <CompanyDecisions {session} {trainColors} showUndo={false} />
        {#if !session.privateActions.selection && !session.decisions.selection}
            {#if session.operatingMode.nothingToBuild}
                <NothingToBuild {session} />
            {:else}
                <StationBuilding
                    {session}
                    showUndo={false}
                    canSkip={session.operatingMode.canFinish}
                    onSkip={() => session.operatingMode.finish()}
                />
                <ProjectedRun {session} {onFocusRoute} />
            {/if}
        {/if}
    </div>
{/snippet}

{#snippet content()}
    {#if gameState.machineState === 'StockRound' && session.familyStockPanels.open === 'receivership'}
        <PresidencyClaims {session} />
    {:else if session.operatingMode.financeShown}
        <CorporateFinance {session} />
    {:else if titleModePanel}
        {@render titleModePanel.panel(titleModePanel.id)}
    {:else if session.operatingMode.stationsShown}
        {@render stationsWithTrack()}
    {:else if gameState.machineState === 'StockRound'}
        {@render actionControls()}
    {:else}
        <section class="centered-panel" aria-label="Operating actions">
            {@render actionControls()}
        </section>
    {/if}
{/snippet}

{#if session.operatingMode.enabled}
    <div class="operating-modes">
        {#if session.operatingMode.switchVisible}<OperatingModeSwitch {session} />{/if}
        {#key session.operatingMode.switchVisible ? session.operatingMode.mode : undefined}<div
                class="operating-mode-content"
                in:fade={{ duration: prefersReducedMotion.current ? 0 : 150 }}
            >
                {@render content()}
            </div>{/key}
    </div>
{:else}
    {@render content()}
{/if}

<style>
    .operating-modes,
    .operating-mode-content {
        display: flex;
        flex: 1 0 auto;
        flex-direction: column;
    }
</style>
