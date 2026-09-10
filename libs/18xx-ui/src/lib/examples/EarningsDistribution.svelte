<script lang="ts">
    import { getCompany, stockMarketSpace, type EarningsChoice } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session }: { session: FinanceExampleSession } = $props()
    const result = $derived(session.financialState.routeStep?.result)
    const preview = $derived(session.earningsPreview ?? session.financialState.earningsDistribution)
    const names: Record<EarningsChoice, string> = {
        pay: 'Pay dividends',
        withhold: 'Withhold',
        'half-pay': 'Half pay'
    }
</script>

{#if result && (session.financialState.machineState === 'DistributingEarnings' || session.financialState.machineState === 'BuyingTrains')}
    <section aria-label="Earnings distribution">
        <h2>
            {getCompany(session.financialState, result.companyId).name} · Earnings ${result.revenue}
        </h2>
        {#if session.financialState.machineState === 'DistributingEarnings'}
            <div class="choices">
                {#each session.earningsChoices as { choice, evaluation }}
                    <div>
                        <button
                            disabled={!session.canDistributeEarnings || !evaluation.details}
                            aria-pressed={session.earningsSelection === choice}
                            onclick={() => session.selectEarnings(choice)}>{names[choice]}</button
                        >
                        {#if evaluation.reason}<p>{evaluation.reason}</p>{/if}
                    </div>
                {/each}
                <button
                    disabled={session.busy ||
                        session.updatingVisibleState ||
                        session.isViewingHistory ||
                        !session.actions.length}
                    onclick={() => session.undo()}>Undo</button
                >
            </div>
        {/if}
        {#if preview}
            <div aria-label="Earnings preview">
                <p>
                    Retained: ${preview.retained} · Dividend per share: ${preview.dividendPerShare}
                </p>
                {#if preview.bonusPerShare}<p>
                        Includes a ${preview.bonusPerShare} bonus per share.
                    </p>{/if}
                <ul>
                    {#each preview.payments as payment}<li>
                            {session.ownerName(payment.to)}: ${payment.amount}
                        </li>{/each}
                </ul>
                {#if preview.bankAdjustment > 0}<p>Bank supplement: ${preview.bankAdjustment}</p>
                {:else if preview.bankAdjustment < 0}<p>
                        Unpaid shares: ${-preview.bankAdjustment} remains in the Bank.
                    </p>{/if}
                {#if preview.marketMove}
                    <p>
                        Share price: ${stockMarketSpace(
                            session.financialState.stockMarket,
                            preview.marketMove.fromMarketSpaceId
                        ).price} → ${stockMarketSpace(
                            session.financialState.stockMarket,
                            preview.marketMove.toMarketSpaceId
                        ).price}
                    </p>
                {/if}
                {#if !session.financialState.earningsDistribution}
                    <button onclick={() => session.backEarnings()}>Back</button>
                    <button
                        disabled={!session.canDistributeEarnings}
                        onclick={() => session.confirmEarnings()}>Confirm distribution</button
                    >
                {:else}<p>Distributed · {names[preview.choice]}</p>{/if}
            </div>
        {/if}
    </section>
{/if}

<style>
    section {
        padding: 16px;
        margin-bottom: 20px;
        border: 1px solid #c9d2cb;
        border-radius: 7px;
        background: #fffefa;
        font:
            13px/1.5 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    h2 {
        font-size: 17px;
        margin: 0 0 12px;
    }
    .choices {
        display: flex;
        gap: 12px;
        align-items: start;
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
</style>
