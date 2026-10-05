<script lang="ts">
    import { assert } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import {
        type EighteenFortySixProjectedState,
        type HydratedEighteenFortySixState,
        steamboatCompanies,
        PortSymbols
    } from '@tabletop/1846'
    import {
        GameTable,
        OperatingActions,
        AutomaticRoutes,
        StationBuilding,
        CompanyDecisions
    } from '@tabletop/18xx-ui'
    import { EighteenFortySixSession } from './session.svelte.js'
    import { CompanyDescriptions } from './companyDescriptions.js'
    import OpeningCompanies from './OpeningCompanies.svelte'
    import Draft from './Draft.svelte'
    import ConstructionPowers from './ConstructionPowers.svelte'
    import RevenuePowers from './RevenuePowers.svelte'
    import EmergencyTrains from './EmergencyTrains.svelte'
    import { describe1846Action } from './history.js'
    import './panels.css'
    let {
        gameSession
    }: { gameSession: GameSession<EighteenFortySixProjectedState, HydratedEighteenFortySixState> } =
        $props()
    const session = $derived.by(() => {
        assert(gameSession instanceof EighteenFortySixSession, '1846 requires its title session')
        return gameSession
    })
    const state = $derived(session.gameState)
    const privateOperationDescription = (id: string) => CompanyDescriptions[id]
    function createRouteWorker() {
        return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
    }
</script>

<GameTable {session} {privateOperationDescription} historyDescription={describe1846Action}>
    {#snippet actions(_focusLocation, focusRoute)}
        <div class="midwest-actions">
            {#if state.machineState === 'BuyingOpeningCompanies'}
                <OpeningCompanies {session} />
            {:else if state.machineState === 'Drafting' || state.machineState === 'RevealingDraft'}
                <Draft {session} />
            {:else if state.pendingRevenueMarker || session.privateDraft}
                <RevenuePowers {session} />
                <ConstructionPowers {session} />
            {:else if state.machineState === 'AssigningSteamboat'}
                <section aria-label="Steamboat assignment">
                    <h2>Assign the Steamboat</h2>
                    <p>Choose a railroad and a port for this operating round.</p>
                    <div class="choices">
                        {#each steamboatCompanies(state) as companyId (companyId)}
                            {#each Object.entries(PortSymbols) as [locationId, ports] (locationId)}
                                <button
                                    disabled={!session.canChooseAction}
                                    onclick={() =>
                                        session.assignSteamboat({ companyId, locationId })}
                                >
                                    {companyId} · {locationId} · +${20 * ports}
                                </button>
                            {/each}
                        {/each}
                    </div>
                    <button
                        disabled={!session.canChooseAction}
                        onclick={() => session.assignSteamboat()}>Leave unassigned</button
                    >
                </section>
            {:else if state.machineState === 'CorporateFinance'}
                <CompanyDecisions
                    {session}
                    trainColors={session.presentation.trainColors}
                    showUndo={false}
                />
                {#if !session.privateActions.selection && !session.decisions.selection && !state.purchaseOffer}
                    <section aria-label="Corporate finance">
                        <h2>{session.financeChoices[0]?.companyId} · issue or redeem shares</h2>
                        <p>Choose one transaction, or pass. The stock price stays unchanged.</p>
                        <div class="choices">
                            {#each session.financeChoices as choice (`${choice.operation}:${choice.shares}`)}
                                <button
                                    disabled={!session.canChooseAction}
                                    onclick={() => session.corporateFinance(choice)}
                                >
                                    {choice.operation === 'pass'
                                        ? 'Pass'
                                        : `${choice.operation === 'issue' ? 'Issue' : 'Redeem'} ${choice.shares} shares · $${choice.amount}`}
                                </button>
                            {/each}
                        </div>
                    </section>
                    <ConstructionPowers {session} /><RevenuePowers {session} />
                {/if}
            {:else if state.machineState === 'RunningReceiver'}
                <AutomaticRoutes
                    {session}
                    {createRouteWorker}
                    onFocusRoute={focusRoute}
                    trainColors={session.presentation.trainColors}
                />
            {:else if state.machineState === 'FundingTrain'}
                <section aria-label="Emergency train funding">
                    <EmergencyTrains {session} />
                </section>
            {:else}
                {#if state.machineState === 'LayingTrack' && !state.purchaseOffer && !session.decisions.selection && !session.privateActions.selection}
                    <nav aria-label="Construction mode" class="choices">
                        <button
                            aria-pressed={session.constructionMode === 'track'}
                            onclick={() => session.chooseConstructionMode('track')}
                            disabled={!session.canChooseAction ||
                                !session.validActionTypes.includes('LayTile')}>Lay track</button
                        >
                        {#if state.stationStep && !state.stationStep.completed}
                            <button
                                aria-pressed={session.constructionMode === 'stations'}
                                onclick={() => session.chooseConstructionMode('stations')}
                                disabled={!session.canChooseAction ||
                                    !session.validActionTypes.includes('PlaceStation')}
                                >Place station</button
                            >
                        {/if}
                    </nav>
                {/if}
                {#if state.machineState === 'LayingTrack' && session.constructionMode === 'stations' && !state.purchaseOffer}
                    <CompanyDecisions
                        {session}
                        trainColors={session.presentation.trainColors}
                        showUndo={false}
                    />
                    {#if !session.privateActions.selection && !session.decisions.selection}
                        <StationBuilding
                            {session}
                            showUndo={false}
                            canSkip={session.canChooseAction}
                            onSkip={() => session.finishConstruction()}
                        />
                    {/if}
                {:else}
                    <OperatingActions
                        {session}
                        {privateOperationDescription}
                        {createRouteWorker}
                        onFocusRoute={focusRoute}
                    />
                {/if}
                {#if state.machineState === 'StockRound' && session.receiverShares.length}
                    <section aria-label="Companies in receivership">
                        <h2>Take over a company</h2>
                        {#each session.receiverShares as choice (choice.companyId)}
                            <button
                                disabled={!session.canChooseAction}
                                onclick={() => session.buyReceiverShare(choice)}
                                >{choice.companyId} · buy 10% for ${choice.price} and become president</button
                            >
                        {/each}
                    </section>
                {/if}
                {#if state.machineState === 'BuyingTrains'}<EmergencyTrains {session} />{/if}
                {#if !state.result && state.machineState !== 'StockRound'}
                    <ConstructionPowers {session} /><RevenuePowers {session} />
                {/if}
            {/if}
        </div>
    {/snippet}
</GameTable>
