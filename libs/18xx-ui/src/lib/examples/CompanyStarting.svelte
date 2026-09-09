<script lang="ts">
    import { getCompany, stockMarketSpace } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const state = $derived(session.financialState)
</script>

{#if session.selectedStartCompany}
    {@const company = getCompany(state, session.selectedStartCompany.companyId)}
    <div class="start" aria-label="Start company">
        <h3>Start {company.name}</h3>
        {#if session.selectedStartResult?.details}
            {@const details = session.selectedStartResult.details}
            <p>
                {session.ownerName(details.buyer)} buys the president’s certificate for {details.price}.
                Starting price: {details.parPrice}.
            </p>
            <ul>
                {#each details.payments as payment}<li>
                        {session.ownerName(payment.from)} pays {payment.amount} to {session.ownerName(
                            payment.to
                        )}.
                    </li>{/each}
            </ul>
            <div class="buttons">
                <button disabled={session.busy} onclick={() => session.backFromStart()}>Back</button
                ><button disabled={session.busy} onclick={() => session.confirmStart()}
                    >Confirm start</button
                >
            </div>
        {:else}
            <p>
                Choose a starting price for {session.ownerName(session.selectedStartCompany.buyer)}.
            </p>
            <div class="buttons" aria-label="Starting prices">
                {#each session.selectedStartPrices as price (price.marketSpaceId)}
                    <button
                        data-start-price={stockMarketSpace(state.stockMarket, price.marketSpaceId)
                            .price}
                        disabled={session.busy || !price.result.details}
                        title={price.result.reason}
                        onclick={() => session.selectStartPrice(price.marketSpaceId)}
                        >{stockMarketSpace(state.stockMarket, price.marketSpaceId).price}</button
                    >
                {/each}
            </div>
            {#if session.selectedStartResult?.reason}<p role="alert">
                    {session.selectedStartResult.reason}
                </p>{/if}
            <button disabled={session.busy} onclick={() => session.backFromStart()}>Back</button>
        {/if}
    </div>
{:else if session.startChoices.length && !session.selection}
    <details open>
        <summary>Start a company</summary>
        <div class="choices">
            {#each session.startChoices as choice (`${choice.request.buyer.kind === 'company' ? choice.request.buyer.companyId : choice.request.playerId}:${choice.request.companyId}`)}
                <button
                    data-start-company={choice.request.companyId}
                    data-start-buyer={choice.request.buyer.kind === 'company'
                        ? choice.request.buyer.companyId
                        : 'player'}
                    disabled={session.busy || !choice.prices.some((price) => price.result.details)}
                    onclick={() => session.selectCompanyStart(choice.request)}
                >
                    <strong>{getCompany(state, choice.request.companyId).name}</strong>
                    <span>{session.ownerName(choice.request.buyer)}</span>
                    {#if !choice.prices.some((price) => price.result.details)}<span
                            >{choice.prices[0]?.result.reason}</span
                        >{/if}
                </button>
            {/each}
        </div>
    </details>
{/if}

<style>
    h3,
    summary {
        font-size: 14px;
        font-weight: 650;
    }
    summary {
        cursor: pointer;
        padding: 8px 0;
    }
    .start {
        margin: 12px 0;
        padding: 12px;
        border: 1px solid #b7c7b6;
    }
    .buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 10px 0;
    }
    .choices {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
        gap: 8px;
        padding: 8px 0;
    }
    button {
        font: inherit;
        padding: 9px 12px;
        border: 1px solid #aebfb4;
        background: #edf3eb;
        border-radius: 5px;
        color: inherit;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .choices button {
        text-align: left;
        overflow-wrap: anywhere;
    }
    span {
        display: block;
        font-size: 12px;
    }
</style>
