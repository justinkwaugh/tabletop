<script lang="ts">
    import { stockMarketSpace, type EarningsChoice, type Owner } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: FinanceExampleSession } = $props()
    const result = $derived(session.financialState.routeStep?.result)
    function isTreasury(owner: Owner): boolean {
        return owner.kind === 'company' && owner.companyId === result?.companyId
    }
    function paymentOrder(owner: Owner): number {
        return isTreasury(owner) ? 0 : owner.kind === 'player' ? 1 : 2
    }
    const names: Record<EarningsChoice, string> = {
        pay: 'Pay',
        withhold: 'Withhold',
        'half-pay': 'Half-pay'
    }
</script>

{#if result && session.financialState.machineState === 'DistributingEarnings'}
    <section aria-label="Earnings distribution">
        <h2>Distribute ${result.revenue}</h2>
        <div class="choices">
            {#each session.earningsChoices as { choice, evaluation }}
                {@const details = evaluation.details}
                <button class="choice" aria-label={names[choice]}
                    disabled={!session.canDistributeEarnings || !details}
                    onclick={() => {
                        session.selectEarnings(choice)
                        void session.confirmEarnings()
                    }}>
                    <span class="choice-heading">
                        <strong class="choice-name">{names[choice]}</strong>
                        {#if details}
                            <span class="heading-amounts">
                                <span class="heading-amount">
                                    <b>${choice === 'withhold' ? details.retained : details.dividendPerShare}</b>
                                    {#if choice !== 'withhold'}<small>/share</small>{/if}
                                </span>
                                {#if choice === 'half-pay'}
                                    <span class="heading-amount"><b>${details.retained}</b><small>&nbsp;retained</small></span>
                                {/if}
                            </span>
                        {/if}
                    </span>
                    {#if details}
                        {#if details.bonusPerShare}<small>Includes ${details.bonusPerShare}/share bonus</small>{/if}
                        {#if choice !== 'withhold'}<span class="payments">
                            {#each details.payments.toSorted((a, b) => paymentOrder(a.to) - paymentOrder(b.to)) as payment}
                                <span><span>{isTreasury(payment.to) ? 'Treasury' : session.ownerName(payment.to)}</span><b>${payment.amount}</b></span>
                            {/each}
                        </span>{/if}
                        {#if details.marketMove}
                            <span class="market">Market
                                <b>{stockMarketSpace(session.financialState.stockMarket, details.marketMove.fromMarketSpaceId).price}
                                → {stockMarketSpace(session.financialState.stockMarket, details.marketMove.toMarketSpaceId).price}</b>
                            </span>
                        {/if}
                    {:else}<small>{evaluation.reason}</small>{/if}
                </button>
            {/each}
        </div>
        {#if showUndo}<button class="undo"
            disabled={session.busy || session.updatingVisibleState || session.isViewingHistory || !session.actions.length}
            onclick={() => session.undo()}>Undo</button>{/if}
    </section>
{/if}

<style>
    section { padding: 4px 0; color: #514536; font-size: 12px; }
    h2 { margin: 0 0 10px; font-size: 13px; font-weight: 400; text-align: center; }
    .choices { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 10px; }
    button { font: inherit; color: inherit; cursor: pointer; background: #fffdf8; border: 1px solid #c7b8a6; border-radius: 7px; }
    .choice { display: flex; flex-direction: column; gap: 7px; padding: 10px 12px; text-align: left; font-variant-numeric: tabular-nums; }
    .choice-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
    .heading-amount { display: flex; align-items: baseline; gap: 0; text-align: right; white-space: nowrap; }
    .heading-amounts { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .heading-amount b, .choice-name { font-size: 14px; font-weight: 600; line-height: 1.25; }
    small { color: #786550; font-size: 10px; }
    b { font-weight: 600; }
    .payments { display: flex; flex-direction: column; gap: 2px; border-top: 1px solid #e4dacd; padding-top: 6px; }
    .payments > span, .market { display: flex; justify-content: space-between; gap: 14px; }
    .market { border-top: 1px solid #e4dacd; padding-top: 6px; margin-top: auto; }
    .undo { display: block; margin: 10px auto 0; padding: 7px 12px; }
    button:hover:not(:disabled) { background: #efe7db; border-color: #a68c6d; }
    button:focus-visible { outline: 2px solid #a87948; outline-offset: 2px; }
    button:disabled { opacity: 0.45; cursor: default; }
</style>
