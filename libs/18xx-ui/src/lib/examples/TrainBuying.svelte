<script lang="ts">
    import { getCompany, cashOwnedBy } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const step = $derived(session.financialState.trainPurchaseStep)
    const preview = $derived(session.trainPreview)
</script>

{#if step}
    <section aria-label="Train purchases">
        <header>
            <h2>{getCompany(session.financialState, step.companyId).name} · Trains</h2>
            <span
                >Treasury: ${cashOwnedBy(session.financialState, {
                    kind: 'company',
                    companyId: step.companyId
                })}</span
            >
            <span>Train limit: {session.trainLimit}</span>
            <span>{step.purchasedTrainIds.length} purchased this turn</span>
            <button
                onclick={() => session.undo()}
                disabled={session.busy ||
                    session.updatingVisibleState ||
                    session.isViewingHistory ||
                    (!session.trainSelection && !session.actions.length)}>Undo</button
            >
        </header>
        {#if session.isViewingHistory}<p>History view</p>{/if}
        <button
            onclick={() => session.finishOperatingTurn()}
            disabled={!session.canFinishOperatingTurn}>Finish operating turn</button
        >
        {#if session.finishOperatingReason}<p>{session.finishOperatingReason}</p>{/if}
        <h3>Depot</h3>
        <div class="trains">
            {#each session.trainOffers as offer (offer.definitionId)}
                {@const definition = session.trainDepot.trainDefinition(offer.definitionId)}
                <article data-depot-train={definition.id}>
                    <strong>{definition.name}</strong>
                    <span>${definition.price} · {offer.remaining} remaining</span>
                    <span
                        >{definition.distance.maximum}
                        {definition.distance.measure === 'hex-edges'
                            ? 'hex edges'
                            : definition.distance.measure === 'cities-and-offboards'
                              ? 'cities/offboards, plus towns'
                              : 'revenue centers'}</span
                    >
                    <button
                        disabled={!session.canBuyTrain || !offer.evaluation.details}
                        aria-pressed={preview?.definitionId === definition.id}
                        onclick={() => {
                            if (offer.evaluation.details)
                                session.selectTrain(offer.evaluation.details)
                        }}>Select {definition.name}</button
                    >
                    {#if offer.evaluation.reason}<small>{offer.evaluation.reason}</small>{/if}
                </article>
            {/each}
        </div>
        {#if preview}
            <div class="purchase" aria-label="Train purchase preview">
                <strong
                    >{session.trainDepot.trainDefinition(preview.definitionId).name} · ${preview.price}</strong
                >
                <button onclick={() => session.backTrain()}>Back</button>
                <button
                    onclick={() => session.confirmTrainPurchase()}
                    disabled={!session.canBuyTrain}>Confirm train purchase</button
                >
            </div>
        {/if}
        <h3>Company trains</h3>
        <div class="rosters">
            {#each session.trainRosters as { company, trains }}
                <div data-train-roster={company.id}>
                    <strong>{company.name}</strong>
                    <ul>
                        {#each trains as train (train.id)}<li data-owned-train={train.id}>
                                {session.trainDepot.trainDefinition(train.definitionId).name}
                            </li>{/each}
                    </ul>
                </div>
            {/each}
        </div>
        {#if session.trainPurchases.length}<ol aria-label="Train purchase history">
                {#each session.trainPurchases as action (action.id)}<li>
                        {action.companyId}: {session.trainDepot.trainDefinition(action.definitionId)
                            .name}, ${action.metadata?.price ?? action.expectedPrice}
                    </li>{/each}
            </ol>{/if}
    </section>
{/if}

<style>
    section {
        margin-bottom: 20px;
        padding: 16px;
        border: 1px solid #c9d2cb;
        border-radius: 7px;
        background: #fffefa;
        font:
            13px/1.5 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    header,
    .purchase,
    .rosters {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
    }
    h2 {
        font-size: 17px;
        margin: 0;
    }
    h3 {
        font-size: 15px;
        margin: 14px 0 8px;
    }
    .trains {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 10px;
    }
    article {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 10px;
        border: 1px solid #b5c3ba;
        border-radius: 4px;
    }
    article strong {
        font-size: 20px;
    }
    small {
        color: #5e675f;
    }
    button {
        padding: 7px 12px;
        font: inherit;
        cursor: pointer;
        background: #fffefa;
        border: 1px solid #b5c3ba;
        border-radius: 4px;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    button[aria-pressed='true'] {
        outline: 2px solid #d67910;
    }
    .purchase {
        margin-top: 14px;
    }
    ul {
        display: flex;
        gap: 8px;
        list-style: none;
        padding: 0;
    }
    li[data-owned-train] {
        padding: 4px 9px;
        border: 1px solid #b5c3ba;
        border-radius: 4px;
    }
</style>
