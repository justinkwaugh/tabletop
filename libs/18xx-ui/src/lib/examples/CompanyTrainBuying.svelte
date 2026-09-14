<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { getCompany } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let { session, trainColors }: { session: FinanceExampleSession; trainColors: Readonly<Record<string, string>> } = $props()
    const request = $derived(session.trainBuyingSelection.purchase?.value)
    const response = $derived(session.financialState.purchaseOffer)
    const companies = $derived.by(() => {
        const groups = new Map<string, typeof session.companyTrainChoices>()
        for (const choice of session.companyTrainChoices) {
            if (choice.source !== session.trainBuyingSource || choice.request.seller.kind !== 'company') continue
            const id = choice.request.seller.companyId
            const group = groups.get(id)
            if (group) group.push(choice)
            else groups.set(id, [choice])
        }
        return [...groups].map(([companyId, trains]) => ({ companyId, trains }))
    })
    const selectedTrain = $derived.by(() => {
        const asset = response?.asset ?? request?.asset
        if (asset?.kind !== 'train') return undefined
        const train = session.financialState.trainInventory.trains.find((train) => train.id === asset.trainId)
        assertExists(train, 'Selected purchase requires a train')
        return session.trainDepot.trainDefinition(train.definitionId)
    })
</script>

<div class="company-trains">
    {#if response?.asset.kind === 'train' && selectedTrain}
        <div class="summary">
            <CompanyToken appearance={session.mapView.stations[response.companyId]} size={24} />
            <strong>{getCompany(session.financialState, response.companyId).name}</strong>
            <span>offers ${response.price} for</span>
            <TrainBadge name={selectedTrain.name} color={trainColors[selectedTrain.id]} />
            <span>from</span>
            {#if response.seller.kind === 'company'}
                <CompanyToken appearance={session.mapView.stations[response.seller.companyId]} size={24} />
            {/if}
            <span>{session.ownerName(response.seller)}</span>
        </div>
        <div class="controls">
            <button class="action-button" disabled={!session.canResolveCompanyDecision || !session.validActionTypes.includes('RespondToPurchaseOffer')} onclick={() => session.respondToPurchaseOffer(true)}>Accept</button>
            <button class="action-button" disabled={!session.canResolveCompanyDecision || !session.validActionTypes.includes('RespondToPurchaseOffer')} onclick={() => session.respondToPurchaseOffer(false)}>Decline</button>
        </div>
    {:else if request && selectedTrain}
        <div class="summary">
            {#if request.seller.kind === 'company'}
                <CompanyToken appearance={session.mapView.stations[request.seller.companyId]} size={24} />
            {/if}
            <strong>{session.ownerName(request.seller)}</strong>
            <TrainBadge name={selectedTrain.name} color={trainColors[selectedTrain.id]} />
        </div>
        <div class="controls">
            <label>Price <span>$</span><input aria-label="Train price" type="number" min="1" step="1" value={request.price}
                oninput={(event) => session.setCompanyTrainPrice(Number(event.currentTarget.value))} /></label>
            <button class="action-button" disabled={!session.canResolveCompanyDecision || !session.companyTrainEvaluation || !!session.companyTrainEvaluation.reason}
                onclick={() => session.buyCompanyTrain()}>{session.trainBuyingSource === 'mine' ? 'Buy' : 'Offer'}</button>
        </div>
        {#if session.companyTrainEvaluation?.reason}<p role="status">{session.companyTrainEvaluation.reason}</p>{/if}
    {:else}
        <div class="choices">
            {#each companies as { companyId, trains } (companyId)}
                <div class="company" role="group" aria-label={getCompany(session.financialState, companyId).name}>
                    <div class="company-heading">
                        <CompanyToken appearance={session.mapView.stations[companyId]} size={24} />
                        <strong>{getCompany(session.financialState, companyId).name}</strong>
                    </div>
                    <div class="company-roster">
                        {#each trains as choice}
                            <button class="train" disabled={!session.canResolveCompanyDecision} onclick={() => session.selectCompanyTrain(choice.request)}>
                                <TrainBadge name={session.trainDepot.trainDefinition(choice.definitionId).name} color={trainColors[choice.definitionId]} />
                            </button>
                        {/each}
                    </div>
                </div>
            {:else}<span>No trains available</span>{/each}
        </div>
    {/if}
</div>

<style>
    .company-trains { font-size: 13px; color: #514536; }
    .summary, .controls, .choices, label { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; }
    .controls { margin-top: 8px; }
    button { background: #efe7db; border: 1px solid #c7b8a6; border-radius: 4px; padding: 6px 10px; color: inherit; font: inherit; cursor: pointer; }
    button:hover:not(:disabled) { background: #e5d9c8; }
    button:disabled { opacity: .5; cursor: default; }
    .choices { align-items: flex-start; gap: 12px 24px; }
    .company { display: flex; align-items: center; gap: 12px; }
    .company-heading, .company-roster { display: flex; align-items: center; gap: 6px; }
    .company-roster { flex-wrap: wrap; }
    .train { display: flex; align-items: center; padding: 4px; }
    strong { font-weight: 600; }
    input { width: 76px; padding: 4px 6px; border: 1px solid #c7b8a6; border-radius: 3px; background: transparent; font: inherit; color: inherit; }
    label { gap: 4px; }
    p { text-align: center; margin: 6px 0 0; font-size: 12px; }
</style>
