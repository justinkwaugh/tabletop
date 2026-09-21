<script lang="ts">
    import type { TrainPurchaseDetails } from '@tabletop/18xx'
    import TrainPurchaseButton from './TrainPurchaseButton.svelte'
    import TrainBadge from './TrainBadge.svelte'
    import CompanyTrainBuying from './CompanyTrainBuying.svelte'
    import TrainFunding from './TrainFunding.svelte'
    import PhaseChanges from '../phases/PhaseChanges.svelte'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session, trainColors, showUndo = true }: { trainColors: Readonly<Record<string, string>>; showUndo?: boolean; session: EighteenXXSession } =
        $props()
    const step = $derived(session.financialState.trainPurchaseStep)
    const availableTypes = $derived(session.availableTrainDefinitionIds)
    const fundingDepot = $derived(session.trainFunding.purchases.filter((purchase) => session.financialState.trainInventory.trains.some((train) => train.id === purchase.trainId && train.status === 'depot')))
    const remainingDepot = $derived(session.trainBuying.offers.filter((offer) => offer.remaining !== 0))
    const currentDepot = $derived(remainingDepot.filter((offer) => availableTypes.includes(offer.definitionId) && (offer.evaluation.details || fundingDepot.some((purchase) => purchase.definitionId === offer.definitionId))))
    const marketChoices = $derived.by(() => {
        const groups = new Map<string, { details: TrainPurchaseDetails; count: number }>()
        const offers = [
            ...session.trainBuying.marketOffers.flatMap((offer) => offer.details ? [offer.details] : []),
            ...session.trainFunding.purchases.filter((purchase) => session.financialState.trainInventory.trains.some((train) => train.id === purchase.trainId && train.status === 'market'))
        ]
        for (const details of offers) {
            const key = `${details.definitionId}:${details.price}`
            const group = groups.get(key)
            if (group) group.count += 1
            else groups.set(key, { details, count: 1 })
        }
        return [...groups.values()]
    })
</script>

{#snippet trainChoice(definitionId: string, price: number, remaining: number | 'unlimited', details: TrainPurchaseDetails | undefined, market = false, funding = false)}
    {@const definition = session.trainDepot.trainDefinition(definitionId)}
    <div class="depot-entry">
        <TrainPurchaseButton name={definition.name} {price} color={trainColors[definitionId]}
            {definitionId} {market}
            disabled={!(funding ? session.trainFunding.canFund : session.trainBuying.canBuy) || !details}
            onclick={() => { if (details) void (funding ? session.trainFunding.fund(details) : session.trainBuying.buy(details)) }} />
        <small class="remaining">{market ? 'Market · ' : ''}{remaining === 'unlimited' ? 'Unlimited' : `${remaining} remaining`}</small>
    </div>
{/snippet}

{#if session.financialState.phaseChange}<PhaseChanges {session} {showUndo} />{/if}
{#if session.financialState.trainFunding}<TrainFunding {session} {showUndo} {trainColors} />{/if}

{#if step && session.financialState.machineState === 'BuyingTrains'}
    <section aria-label="Train purchases">
        {#if session.financialState.purchaseOffer?.asset.kind === 'train'}
            <CompanyTrainBuying {session} {trainColors} />
        {:else}
        {#if !session.trainFunding.purchases.length}
        <header>
            <h2>
                Choose a train to buy
                {#if !session.finishOperatingReason}
                    or <button class="action-button inline-action" onclick={() => session.finishOperatingTurn()}
                        disabled={!session.canFinishOperatingTurn}>finish</button>
                {/if}
            </h2>
            {#if showUndo}<button
                    onclick={() => session.undo()}
                    disabled={session.busy ||
                        session.updatingVisibleState ||
                        session.isViewingHistory ||
                        (!session.trainBuying.depotSelection && !session.actions.length)}>Undo</button
                >{/if}
        </header>
        {/if}

        {#if session.trainBuying.companyChoices.length}
        <nav aria-label="Train source" class="sources">
            {#if currentDepot.length || marketChoices.length || session.trainBuying.exchanges.length}
                <button aria-pressed={session.trainBuying.source === 'depot'} onclick={() => session.trainBuying.selectSource('depot')}>Depot</button>
            {/if}
            {#if session.trainBuying.companyChoices.some((choice) => choice.source === 'mine')}
                <button aria-pressed={session.trainBuying.source === 'mine'} onclick={() => session.trainBuying.selectSource('mine')}>My companies</button>
            {/if}
            {#if session.trainBuying.companyChoices.some((choice) => choice.source === 'others')}
                <button aria-pressed={session.trainBuying.source === 'others'} onclick={() => session.trainBuying.selectSource('others')}>Other companies</button>
            {/if}
        </nav>
        {/if}
        {#if session.trainBuying.source === 'depot'}
        {#if session.trainFunding.purchases.length}
            <TrainFunding {session} {trainColors} {showUndo} />
        {:else}
        <div class="trains">
            {#each currentDepot as offer (offer.definitionId)}
                {@const fundingPurchase = fundingDepot.find((purchase) => purchase.definitionId === offer.definitionId)}
                {@render trainChoice(offer.definitionId, offer.evaluation.details?.price ?? session.trainDepot.trainDefinition(offer.definitionId).price, offer.remaining, offer.evaluation.details ?? fundingPurchase, false, !!fundingPurchase)}
            {/each}
            {#each marketChoices as { details, count } (`${details.definitionId}:${details.price}`)}
                {@render trainChoice(details.definitionId, details.price, count, details, true, session.trainFunding.purchases.some((purchase) => purchase.trainId === details.trainId))}
            {/each}
        </div>
        {#if session.trainBuying.exchanges.length}<h3>Diesel exchange</h3>
            <div class="trains">
                {#each session.trainBuying.exchanges as exchange}<button
                        disabled={!session.trainBuying.canBuy}
                        onclick={() => session.trainBuying.buy(exchange)}
                        >Exchange {exchange.exchangeTrainId} for Diesel · ${exchange.price}</button
                    >{/each}
            </div>{/if}
        {/if}
        {:else}<CompanyTrainBuying {session} {trainColors} />{/if}
        {#if session.trainBuying.currentPurchaseIds.length}
            <div class="purchased" aria-label="Trains purchased this OR">
                <span>Purchased</span>
                {#each session.financialState.trainInventory.trains.filter((train) => session.trainBuying.currentPurchaseIds.includes(train.id)) as train (train.id)}
                    <TrainBadge name={session.trainDepot.trainDefinition(train.definitionId).name} color={trainColors[train.definitionId]} />
                {/each}
            </div>
        {/if}
        {/if}
    </section>
{/if}

<style>
    section {
        padding: 4px 0 0;
        color: var(--rail-text, #514536);
        font:
            13px/1.5 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    header,
    .purchased {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
    }
    h2 {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        width: 100%;
        font-size: 13px;
        font-weight: 400;
        margin: 0;
    }
    h3 {
        font-size: 12px;
        font-weight: 500;
        text-align: center;
        margin: 12px 0 6px;
    }
    .sources { display: flex; justify-content: center; gap: 4px; margin: 6px 0; }
    .sources button { background: transparent; border: 0; padding: 4px 9px; }
    .sources button[aria-pressed='true'] { background: var(--rail-surface-raised, #e8dfd2); }
    .trains {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: flex-end;
        gap: 10px;
        margin-top: 6px;
    }
    .depot-entry { display: flex; flex-direction: column; gap: 2px; }
    .remaining { text-align: right; }
    small {
        color: var(--rail-text, #5e675f);
    }
    button {
        padding: 7px 12px;
        font: inherit;
        cursor: pointer;
        background: var(--rail-surface-raised, #efe7db);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .purchased {
        margin-top: 10px;
        justify-content: center;
    }
    button:hover:not(:disabled) { background: var(--rail-surface-raised, #e5d9c8); }
    button:focus-visible { outline: 2px solid #a87948; outline-offset: 2px; }
</style>
