<script lang="ts">
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    import Tile from '../tiles/Tile.svelte'
    let { session, showUndo = true }: { showUndo?: boolean; session: FinanceExampleSession } =
        $props()
    const state = $derived(session.financialState)
    const draft = $derived(session.companyDecisionSelection)
</script>

<section aria-label="Company decisions">
    <h2>Purchases and private powers</h2>
    {#if state.privatePowerWindow}
        <p>Private powers before {state.privatePowerWindow.companyId} operates.</p>
        <button
            disabled={!session.canResolveCompanyDecision ||
                !session.validActionTypes.includes('ContinueOperatingRound')}
            onclick={() => session.continueOperatingRound()}>Continue operating round</button
        >
    {/if}
    {#if state.purchaseOffer}
        {@const offer = state.purchaseOffer}
        <div aria-label="Purchase response">
            <p>
                {offer.companyId} offers {offer.price} to {session.ownerName(offer.seller)} for {offer
                    .asset.kind === 'train'
                    ? offer.asset.trainId
                    : offer.asset.privateCompanyId}.
            </p>
            <p>
                {session.getPlayerName(offer.sellerPlayerId)} decides. {offer.companyId}’s turn
                resumes afterward.
            </p>
            <button
                disabled={!session.canResolveCompanyDecision ||
                    !session.validActionTypes.includes('RespondToPurchaseOffer')}
                onclick={() => session.respondToPurchaseOffer(true)}>Accept purchase</button
            >
            <button
                disabled={!session.canResolveCompanyDecision ||
                    !session.validActionTypes.includes('RespondToPurchaseOffer')}
                onclick={() => session.respondToPurchaseOffer(false)}>Reject purchase</button
            >
        </div>
    {:else if state.trackConsent}
        {@const request = state.trackConsent}
        {@const definition = session.mapView.tileSet.definitions.find(
            (tile) => tile.id === request.details.definitionId
        )}
        <div aria-label="Track permission response">
            {#if definition}<Tile
                    face={definition.face}
                    orientation={session.mapView.map.definition.orientation}
                    rotation={request.details.rotation}
                />{/if}
            <p>
                {request.details.companyId} requests permission to lay {request.details
                    .definitionId} on {request.details.locationId} for {request.details.cost}.
            </p>
            <p>{session.getPlayerName(request.details.consentPlayerId!)} decides.</p>
            <button
                disabled={!session.canResolveCompanyDecision ||
                    !session.validActionTypes.includes('RespondToTrackConsent')}
                onclick={() => session.respondToTrackConsent(true)}>Allow track lay</button
            >
            <button
                disabled={!session.canResolveCompanyDecision ||
                    !session.validActionTypes.includes('RespondToTrackConsent')}
                onclick={() => session.respondToTrackConsent(false)}>Deny track lay</button
            >
        </div>
    {:else}
        {#if state.privateTrackLay}
            <p>
                {session.getPlayerName(state.privateTrackLay.playerId)} may use {state
                    .privateTrackLay.privateCompanyId} to lay a tile now.
            </p>
            <button
                disabled={!session.canResolveCompanyDecision ||
                    !session.validActionTypes.includes('DeclinePrivateTile')}
                onclick={() => session.declinePrivateTile()}>Decline private tile lay</button
            >
        {/if}
        <div class="choices">
            {#if session.purchaseOptions.length}
                <label
                    >Buy from another owner
                    <select
                        aria-label="Purchase asset"
                        value=""
                        onchange={(event) => {
                            const choice =
                                session.purchaseOptions[Number(event.currentTarget.value)]
                            if (event.currentTarget.value && choice)
                                session.selectPurchaseOffer(choice.request)
                        }}
                    >
                        <option value="">Choose asset</option>
                        {#each session.purchaseOptions as option, index}<option value={index}
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
            {#if session.privateTileOptions.length}
                <label
                    >Private tile lay
                    <select
                        aria-label="Private tile lay"
                        value=""
                        onchange={(event) => {
                            const choice =
                                session.privateTileOptions[Number(event.currentTarget.value)]
                            if (event.currentTarget.value && choice)
                                session.selectPrivateTile(choice)
                        }}
                    >
                        <option value="">Choose placement</option>
                        {#each session.privateTileOptions as option, index}<option value={index}
                                >{option.privateCompanyId} · {session.getPlayerName(
                                    option.playerId
                                )} · {option.details.locationId} · {option.details.definitionId} · {option
                                    .details.rotation * 60}°</option
                            >{/each}
                    </select>
                </label>
            {/if}
            {#if session.privateTrainOptions.length}
                <label
                    >Private train purchase
                    <select
                        aria-label="Private train purchase"
                        value=""
                        onchange={(event) => {
                            const choice =
                                session.privateTrainOptions[Number(event.currentTarget.value)]
                            if (event.currentTarget.value && choice)
                                session.selectPrivateTrain(choice)
                        }}
                    >
                        <option value="">Choose train</option>
                        {#each session.privateTrainOptions as option, index}<option value={index}
                                >{option.privateCompanyId} · {option.details.definitionId} · {option
                                    .details.price}</option
                            >{/each}
                    </select>
                </label>
            {/if}
        </div>
    {/if}
    {#if draft}
        <div aria-label="Company decision preview">
            {#if draft.kind === 'purchase'}
                <label
                    >Offer price <input
                        aria-label="Offer price"
                        type="number"
                        min="1"
                        step="1"
                        value={draft.request.price}
                        oninput={(event) =>
                            session.setPurchasePrice(event.currentTarget.valueAsNumber)}
                    /></label
                >
                {#if session.purchaseOfferEvaluation?.reason}<p>
                        {session.purchaseOfferEvaluation.reason}
                    </p>
                {:else if session.purchaseOfferEvaluation?.buyerPlayerId === session.purchaseOfferEvaluation?.sellerPlayerId}<p
                    >
                        You control both sides. Confirming completes the purchase.
                    </p>
                {:else}<p>The seller’s controlling owner will accept or reject this offer.</p>{/if}
            {:else if draft.kind === 'tile'}
                {@const definition = session.mapView.tileSet.definitions.find(
                    (tile) => tile.id === draft.details.definitionId
                )}
                {#if definition}<Tile
                        face={definition.face}
                        orientation={session.mapView.map.definition.orientation}
                        rotation={draft.details.rotation}
                    />{/if}
                <p>
                    {session.getPlayerName(draft.playerId)} uses {draft.privateCompanyId}: {draft
                        .details.locationId}, cost {draft.details.cost}.
                </p>
            {:else}<p>
                    {draft.details.companyId} closes {draft.privateCompanyId} and pays {draft
                        .details.price} for a {draft.details.definitionId} train.
                </p>{/if}
            <button onclick={() => session.backCompanyDecision()}>Back</button>
            <button
                disabled={!session.canResolveCompanyDecision ||
                    (draft.kind === 'purchase' && !!session.purchaseOfferEvaluation?.reason)}
                onclick={() => session.confirmCompanyDecision()}>Confirm decision</button
            >
        </div>
    {/if}
    {#if showUndo}<button
            disabled={session.busy ||
                session.isViewingHistory ||
                (!draft && !session.actions.length)}
            onclick={() => session.undo()}>Undo</button
        >{/if}
</section>

<style>
    section {
        margin-block: 1rem;
        padding: 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.4rem;
    }
    h2 {
        margin-top: 0;
    }
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
