<script lang="ts">
    import type { TrainPurchaseDetails } from '@tabletop/18xx'
    import type { TrainSource } from '../session/trainBuyingSelection.js'
    import TrainPurchaseButton from './TrainPurchaseButton.svelte'
    import TrainBadge from './TrainBadge.svelte'
    import CompanyTrainBuying from './CompanyTrainBuying.svelte'
    import TrainFunding from './TrainFunding.svelte'
    import PhaseChanges from '../phases/PhaseChanges.svelte'
    import SlidingToggle from '../table/SlidingToggle.svelte'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let {
        session,
        trainColors,
        showUndo = true
    }: {
        trainColors: Readonly<Record<string, string>>
        showUndo?: boolean
        session: EighteenXXSessionView
    } = $props()
    const money = $derived(session.presentation.money)
    const step = $derived(session.gameState.trainPurchaseStep)
    const fundingDepot = $derived(
        session.trainFunding.purchases.filter((purchase) =>
            session.gameState.trainInventory.trains.some(
                (train) => train.id === purchase.trainId && train.status === 'depot'
            )
        )
    )
    const currentDepot = $derived(session.trainBuying.currentDepotOffers)
    const marketChoices = $derived.by(() => {
        const groups = new Map<string, { details: TrainPurchaseDetails; count: number }>()
        const offers = [
            ...session.trainBuying.marketOffers.flatMap((offer) =>
                offer.details ? [offer.details] : []
            ),
            ...session.trainFunding.purchases.filter((purchase) =>
                session.gameState.trainInventory.trains.some(
                    (train) => train.id === purchase.trainId && train.status === 'market'
                )
            )
        ]
        for (const details of offers) {
            const key = `${details.definitionId}:${details.price}`
            const group = groups.get(key)
            if (group) group.count += 1
            else groups.set(key, { details, count: 1 })
        }
        return [...groups.values()]
    })
    const SourceLabels: Readonly<Record<TrainSource, string>> = {
        depot: 'Depot',
        mine: 'My companies',
        others: 'Other companies'
    }
</script>

{#snippet trainChoice(
    definitionId: string,
    price: number,
    remaining: number | 'unlimited',
    details: TrainPurchaseDetails | undefined,
    market = false,
    funding = false,
    reason: string | undefined = undefined
)}
    {@const definition = session.trainDepot.trainDefinition(definitionId)}
    <div class="depot-entry" class:unavailable={!!reason}>
        <TrainPurchaseButton
            {money}
            name={definition.name}
            {price}
            color={trainColors[definitionId]}
            imageUrl={session.publishedTrainImage(definitionId)}
            listPrice={definition.price}
            {definitionId}
            {market}
            disabled={!(funding ? session.trainFunding.canFund : session.trainBuying.canBuy) ||
                !details}
            onclick={() => {
                if (details)
                    void (funding
                        ? session.trainFunding.fund(details)
                        : session.trainBuying.buy(details))
            }}
        />
        <small class="remaining"
            >{market ? 'Market · ' : ''}{remaining === 'unlimited'
                ? 'Unlimited'
                : `${remaining} remaining`}</small
        >
        {#if reason}<small class="reason">{reason}</small>{/if}
        {#if funding && session.trainFunding.voluntary}
            {#each session.trainFunding.plan?.contributions ?? [] as help, index (index)}
                <small class="help">{session.ownerName(help.owner)} adds {money(help.amount)}</small
                >
            {/each}
        {/if}
    </div>
{/snippet}

{#if session.gameState.phaseChange}<PhaseChanges {session} {showUndo} />{/if}
{#if session.gameState.trainFunding}<TrainFunding {session} {showUndo} {trainColors} />{/if}

{#if step && session.gameState.machineState === 'BuyingTrains'}
    <section aria-label="Train purchases">
        {#if session.gameState.purchaseOffer?.asset.kind === 'train'}
            <CompanyTrainBuying {session} {trainColors} />
        {:else}
            {#if !session.trainFunding.purchases.length || session.trainFunding.voluntary}
                <header>
                    <h2>
                        Choose a train to buy
                        {#if !session.operating.finishReason}
                            or <button
                                class="action-button inline-action"
                                onclick={() => session.operating.finish()}
                                disabled={!session.operating.canFinish}>finish</button
                            >
                        {/if}
                    </h2>
                    {#if showUndo}<button
                            onclick={() => session.undo()}
                            disabled={session.busy ||
                                session.updatingVisibleState ||
                                session.isViewingHistory ||
                                (!session.trainBuying.depotSelection && !session.actions.length)}
                            >Undo</button
                        >{/if}
                </header>
            {/if}

            {#if session.trainBuying.sources.length > 1}
                {@const sources = session.trainBuying.sources}
                <nav aria-label="Train source" class="sources">
                    <span>Buy from</span>
                    <SlidingToggle
                        count={sources.length}
                        selectedIndex={sources.indexOf(session.trainBuying.source)}
                    >
                        {#each sources as source (source)}<button
                                aria-pressed={session.trainBuying.source === source}
                                onclick={() => session.trainBuying.selectSource(source)}
                                >{SourceLabels[source]}</button
                            >{/each}
                    </SlidingToggle>
                </nav>
            {/if}
            {#if session.trainBuying.source === 'depot'}
                {#if session.trainFunding.purchases.length && !session.trainFunding.voluntary}
                    <TrainFunding {session} {trainColors} {showUndo} />
                {:else}
                    <div class="trains">
                        {#each currentDepot as offer (offer.definitionId)}
                            {@const fundingPurchase = fundingDepot.find(
                                (purchase) => purchase.definitionId === offer.definitionId
                            )}
                            {@render trainChoice(
                                offer.definitionId,
                                offer.evaluation.details?.price ??
                                    session.trainDepot.trainDefinition(offer.definitionId).price,
                                offer.remaining,
                                offer.evaluation.details ?? fundingPurchase,
                                false,
                                !!fundingPurchase,
                                fundingPurchase ? undefined : offer.evaluation.reason
                            )}
                        {/each}
                        {#each marketChoices as { details, count } (`${details.definitionId}:${details.price}`)}
                            {@render trainChoice(
                                details.definitionId,
                                details.price,
                                count,
                                details,
                                true,
                                session.trainFunding.purchases.some(
                                    (purchase) => purchase.trainId === details.trainId
                                )
                            )}
                        {/each}
                    </div>
                    {#if session.trainBuying.exchangeChoices.length}<h3>Trade in</h3>
                        <div class="trains">
                            {#each session.trainBuying.exchangeChoices as { exchange, tradedDefinitionId } (`${exchange.definitionId}:${tradedDefinitionId}:${exchange.price}`)}
                                {@const definition = session.trainDepot.trainDefinition(
                                    exchange.definitionId
                                )}
                                <div class="depot-entry">
                                    <TrainPurchaseButton
                                        {money}
                                        name={definition.name}
                                        price={exchange.price}
                                        color={trainColors[exchange.definitionId]}
                                        imageUrl={session.publishedTrainImage(
                                            exchange.definitionId
                                        )}
                                        listPrice={definition.price}
                                        definitionId={exchange.definitionId}
                                        disabled={!session.trainBuying.canBuy}
                                        onclick={() => session.trainBuying.buy(exchange)}
                                    />
                                    <small class="remaining traded"
                                        >trading in <TrainBadge
                                            name={session.trainDepot.trainDefinition(
                                                tradedDefinitionId
                                            ).name}
                                            color={trainColors[tradedDefinitionId]}
                                        /></small
                                    >
                                </div>
                            {/each}
                        </div>{/if}
                {/if}
            {:else}<CompanyTrainBuying {session} {trainColors} />{/if}
            {#if session.trainBuying.currentPurchases.length}
                <div class="purchased" aria-label="Trains purchased this OR">
                    <span>Purchased</span>
                    {#each session.trainBuying.currentPurchases as purchase (purchase.trainId)}
                        <span class="purchased-train">
                            <TrainBadge
                                name={session.trainDepot.trainDefinition(purchase.definitionId)
                                    .name}
                                color={trainColors[purchase.definitionId]}
                            />{#if purchase.sellerCompanyId}<span
                                    >{' '}from {session.ownerName({
                                        kind: 'company',
                                        companyId: purchase.sellerCompanyId
                                    })}</span
                                >{/if}
                        </span>
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
    .sources {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
        margin: 10px 0;
        color: var(--rail-muted, #887664);
        font-size: 12px;
    }
    .sources button {
        padding: 4px 14px;
        font-size: 12px;
        line-height: 16px;
    }
    .unavailable :global(button) {
        opacity: 0.45;
    }
    .reason {
        max-width: 140px;
        color: var(--rail-muted, #887664);
        text-align: center;
    }
    .trains {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: flex-start;
        gap: 10px;
        margin-top: 6px;
    }
    .depot-entry {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .remaining {
        text-align: right;
    }
    .help {
        max-width: 140px;
        text-align: right;
        font-weight: 600;
    }
    .traded {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 5px;
    }
    small {
        color: var(--rail-text, #5e675f);
    }
    header button {
        padding: 7px 12px;
        font: inherit;
        cursor: pointer;
        background: var(--rail-surface-raised, #efe7db);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
    }
    header button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .purchased {
        margin-top: 10px;
        justify-content: center;
    }
    .purchased-train {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }
    header button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #e5d9c8);
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
</style>
