<script lang="ts">
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import { getCompany } from '@tabletop/18xx'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import PrivateBuying from '../privates/PrivateBuying.svelte'
    import DecisionResponse from './DecisionResponse.svelte'
    import Tile from '../tiles/Tile.svelte'
    import PrivateTrainBuying from '../trains/PrivateTrainBuying.svelte'
    let { session, trainColors, privateTilePrompts = {}, showUndo = true, excludeTrainPurchases = false }: { privateTilePrompts?: Readonly<Record<string, string>>; trainColors: Readonly<Record<string, string>>; excludeTrainPurchases?: boolean; showUndo?: boolean; session: EighteenXXSession } =
        $props()
    const purchaseOptions = $derived(session.decisions.purchaseOptions.filter((option) => option.request.asset.kind === 'train' && !excludeTrainPurchases))
    const state = $derived(session.financialState)
    const selection = $derived(session.decisions.selection)
    const showPowers = $derived(!session.privateActions.purchaseSource && (session.operating.step === undefined || session.privateActions.selection === 'powers' || !!state.privateTrackLay || !!state.privatePowerWindow))
</script>

{#if state.trackConsent}
    {@const request = state.trackConsent.details}
    {@const definition = session.mapView.tileSet.definitions.find((tile) => tile.id === request.definitionId)}
    <DecisionResponse label="Track permission response" acceptLabel="Allow"
        disabled={!session.decisions.canResolve || !session.validActionTypes.includes('RespondToTrackConsent')}
        onAccept={() => session.decisions.respondToTrackConsent(true)}
        onDecline={() => session.decisions.respondToTrackConsent(false)}>
        <CompanyToken appearance={session.mapView.stations[request.companyId]} size={24} />
        <strong>{getCompany(state, request.companyId).name}</strong>
        <span>requests permission to lay track at {request.locationId}</span>
        {#if definition}
            <Tile face={definition.face} orientation={session.mapView.map.definition.orientation}
                rotation={request.rotation} size={48} />
        {/if}
        {#if request.cost}<span>for ${request.cost}</span>{/if}
    </DecisionResponse>
{:else}
<section aria-label="Company decisions" class:private-powers={showPowers}>

    {#if state.privatePowerWindow}
        <p>Private powers before {state.privatePowerWindow.companyId} operates.</p>
        <button
            disabled={!session.decisions.canResolve ||
                !session.validActionTypes.includes('ContinueOperatingRound')}
            onclick={() => session.decisions.continueOperatingRound()}>Continue operating round</button
        >
    {/if}
    {#if state.purchaseOffer}
        {@const offer = state.purchaseOffer}
        <DecisionResponse label="Purchase response" acceptLabel="Accept"
            disabled={!session.decisions.canResolve || !session.validActionTypes.includes('RespondToPurchaseOffer')}
            onAccept={() => session.decisions.respondToPurchaseOffer(true)} onDecline={() => session.decisions.respondToPurchaseOffer(false)}>
            <CompanyToken appearance={session.mapView.stations[offer.companyId]} size={24} />
            <span>{getCompany(state, offer.companyId).name} offers ${offer.price} for {offer.asset.kind === 'private' ? getCompany(state, offer.asset.privateCompanyId).name : offer.asset.trainId}</span>
        </DecisionResponse>
    {:else}
        <PrivateBuying {session} showEntry={session.operating.step === undefined} />
        <div class="choices">
            {#if purchaseOptions.length}
                <label
                    >Buy from another owner
                    <select
                        aria-label="Purchase asset"
                        value=""
                        onchange={(event) => {
                            const choice =
                                purchaseOptions[Number(event.currentTarget.value)]
                            if (event.currentTarget.value && choice)
                                session.decisions.selectPurchaseOffer(choice.request)
                        }}
                    >
                        <option value="">Choose asset</option>
                        {#each purchaseOptions as option, index}<option value={index}
                                >{option.request.asset.kind === 'train'
                                    ? option.request.asset.trainId
                                    : option.request.asset.privateCompanyId} · {session.ownerName(
                                    option.request.seller
                                )} · minimum {option.minimum}{option.maximum
                                    ? `, maximum ${option.maximum}`
                                    : ''}</option
                            >{/each}
                    </select>
                </label>
            {/if}
            {#if showPowers && session.decisions.privateTileOptions.length}
                <div class="private-track">
                    {#if session.privateActions.trackPowerSelection}
                        {@const power = session.privateActions.trackPowerSelection.value}
                        <header class="private-track-prompt">
                            <span>{privateTilePrompts[power.privateCompanyId] ?? `Place a tile using ${getCompany(state, power.privateCompanyId).name}`}</span>
                            {#if state.privateTrackLay}
                                <span>or</span>
                                <button class="action-button inline-action" disabled={!session.decisions.canResolve || !session.validActionTypes.includes('DeclinePrivateTile')} onclick={() => session.decisions.declinePrivateTile()}>skip</button>
                            {/if}
                        </header>
                    {:else}
                        {#each session.privateActions.trackPowers as power}
                            <button onclick={() => session.privateActions.chooseTrackPower(power)}>{getCompany(state, power.privateCompanyId).name}</button>
                        {/each}
                    {/if}
                </div>
            {/if}
            {#if showPowers && session.decisions.privateTrainOptions.length}
                <PrivateTrainBuying {session} {trainColors} />
            {/if}
        </div>
    {/if}
    {#if selection && !(selection.kind === 'purchase' && selection.request.asset.kind === 'private')}
        <div aria-label="Company decision preview">
            {#if selection.kind === 'purchase'}
                <label
                    >Offer price <input
                        aria-label="Offer price"
                        type="number"
                        min="1"
                        step="1"
                        value={selection.request.price}
                        oninput={(event) =>
                            session.decisions.setPurchasePrice(event.currentTarget.valueAsNumber)}
                    /></label
                >
                {#if session.decisions.purchaseOfferEvaluation?.reason}<p>
                        {session.decisions.purchaseOfferEvaluation.reason}
                    </p>
                {:else if session.decisions.purchaseOfferEvaluation?.buyerPlayerId === session.decisions.purchaseOfferEvaluation?.sellerPlayerId}<p
                    >
                        You control both sides. Confirming completes the purchase.
                    </p>
                {:else}<p>The seller’s controlling owner will accept or reject this offer.</p>{/if}
            {:else if selection.kind === 'tile'}
                {@const definition = session.mapView.tileSet.definitions.find(
                    (tile) => tile.id === selection.details.definitionId
                )}
                {#if definition}<Tile
                        face={definition.face}
                        orientation={session.mapView.map.definition.orientation}
                        rotation={selection.details.rotation}
                    />{/if}
                <p>
                    {session.getPlayerName(selection.playerId)} uses {selection.privateCompanyId}: {selection
                        .details.locationId}, cost {selection.details.cost}.
                </p>
            {:else}<p>
                    {selection.details.companyId} closes {selection.privateCompanyId} and pays {selection
                        .details.price} for a {selection.details.definitionId} train.
                </p>{/if}
            <button onclick={() => session.decisions.back()}>Back</button>
            <button
                disabled={!session.decisions.canResolve ||
                    (selection.kind === 'purchase' && !!session.decisions.purchaseOfferEvaluation?.reason)}
                onclick={() => session.decisions.confirm()}>Confirm decision</button
            >
        </div>
    {/if}
    {#if showUndo}<button
            disabled={session.busy ||
                session.isViewingHistory ||
                (!selection && !session.actions.length)}
            onclick={() => session.undo()}>Undo</button
        >{/if}
</section>
{/if}

<style>
    strong { font-weight: 600; }
    section {
        margin-block: 0;
        padding: 0;
        border: 1px solid #cbd5e1;
        border-radius: 0.4rem;
    }
    section.private-powers { border: none; }
    .private-track { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .private-track-prompt { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 4px 0; font-size: 13px; color: var(--rail-text, #63513e); }
    .private-track-prompt button { margin: 0; }
    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
    }
    label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }
    select,
    input {
        padding: 0.4rem 2rem 0.4rem 0.5rem;
        border: 1px solid #94a3b8;
        border-radius: 0.3rem;
    }
    button {
        border: 1px solid #94a3b8;
        border-radius: 0.3rem;
        padding: 0.3rem 0.6rem;
        margin: 0.3rem;
    }
    button:disabled {
        opacity: 0.4;
    }
</style>
