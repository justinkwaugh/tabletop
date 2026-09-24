<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import {
        stockMarketSpace,
        type EarningsChoice,
        type EarningsDetails,
        type Owner,
        type StockMarket
    } from '@tabletop/18xx'
    let {
        money,
        choice,
        details,
        label,
        companyId,
        stockMarket,
        ownerName,
        reason,
        onclick,
        disabled = false
    }: {
        money: MoneyFormat
        choice: EarningsChoice
        details?: EarningsDetails
        label: string
        companyId: string
        stockMarket: StockMarket
        ownerName: (owner: Owner) => string
        reason?: string
        onclick?: () => void
        disabled?: boolean
    } = $props()
    function isTreasury(owner: Owner): boolean {
        return owner.kind === 'company' && owner.companyId === companyId
    }
    function paymentOrder(owner: Owner): number {
        return isTreasury(owner) ? 0 : owner.kind === 'player' ? 1 : 2
    }
</script>

{#snippet content()}
    <span class="choice-heading">
        <strong class="choice-name">{label}</strong>
        {#if details}
            <span class="heading-amounts">
                <span class="heading-amount">
                    <b
                        >{money(
                            choice === 'withhold' ? details.retained : details.dividendPerShare
                        )}</b
                    >
                    {#if choice !== 'withhold'}<small>/share</small>{/if}
                </span>
                {#if choice === 'half-pay'}
                    <span class="heading-amount"
                        ><b>{money(details.retained)}</b><small>&nbsp;retained</small></span
                    >
                {/if}
            </span>
        {/if}
    </span>
    {#if details}
        {#if details.bonusPerShare}<small>Includes {money(details.bonusPerShare)}/share bonus</small
            >{/if}
        {#if choice !== 'withhold'}<span class="payments">
                {#each details.payments.toSorted((a, b) => paymentOrder(a.to) - paymentOrder(b.to)) as payment}
                    <span
                        ><span>{isTreasury(payment.to) ? 'Treasury' : ownerName(payment.to)}</span
                        ><b>{money(payment.amount)}</b></span
                    >
                {/each}
            </span>{/if}
        {#if details.marketMove}
            <span class="market"
                >Market
                <b
                    >{stockMarketSpace(stockMarket, details.marketMove.fromMarketSpaceId).price}
                    → {stockMarketSpace(stockMarket, details.marketMove.toMarketSpaceId).price}</b
                >
            </span>
        {/if}
    {:else}<small>{reason}</small>{/if}
{/snippet}
{#if onclick}
    <button class="choice" aria-label={label} {disabled} {onclick}>{@render content()}</button>
{:else}
    <div class="choice" aria-label={label}>{@render content()}</div>
{/if}

<style>
    .choice {
        font: inherit;
        color: inherit;
        background: var(--rail-surface, #fffdf8);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 7px;
    }
    .choice {
        display: flex;
        flex-direction: column;
        gap: 7px;
        padding: 10px 12px;
        text-align: left;
        font-variant-numeric: tabular-nums;
    }
    .choice-heading {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
    }
    .heading-amount {
        display: flex;
        align-items: baseline;
        gap: 0;
        text-align: right;
        white-space: nowrap;
    }
    .heading-amounts {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
    }
    .heading-amount b,
    .choice-name {
        font-size: 14px;
        font-weight: 600;
        line-height: 1.25;
    }
    small {
        color: var(--rail-text, #786550);
        font-size: 10px;
    }
    b {
        font-weight: 600;
    }
    .payments {
        display: flex;
        flex-direction: column;
        gap: 2px;
        border-top: 1px solid var(--rail-border, #e4dacd);
        padding-top: 6px;
    }
    .payments > span,
    .market {
        display: flex;
        justify-content: space-between;
        gap: 14px;
    }
    .market {
        border-top: 1px solid var(--rail-border, #e4dacd);
        padding-top: 6px;
        margin-top: auto;
    }

    button {
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
        border-color: var(--rail-border, #a68c6d);
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
