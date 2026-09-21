<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import TrainBadge from './TrainBadge.svelte'
    import TrainPurchaseButton from './TrainPurchaseButton.svelte'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session, trainColors, showUndo = true }: {
        session: EighteenXXSession; trainColors: Readonly<Record<string, string>>; showUndo?: boolean
    } = $props()
    const money = $derived(session.presentation.money)
    const purchase = $derived(session.trainFunding.purchase)
    const plan = $derived(session.trainFunding.plan)
    const disabled = $derived(!(session.trainFunding.canFund || session.trainFunding.canResolve))
</script>

{#if purchase && plan}
    <section aria-label="Compulsory train funding">
        <header>
            <CompanyToken appearance={session.mapView.stations[purchase.companyId]} size={24} />
            <span>{getCompany(session.financialState, purchase.companyId).name} must buy a</span>
            <TrainBadge name={session.trainDepot.trainDefinition(purchase.definitionId).name} color={trainColors[purchase.definitionId]} />
            <span>for {money(purchase.price)}</span>
            {#if showUndo}<button disabled={session.busy || session.updatingVisibleState || session.isViewingHistory}
                onclick={() => session.undo()}>Undo</button>{/if}
        </header>
        {#if session.financialState.bankruptcy}
            <p>Unable to raise the remaining {money(session.financialState.bankruptcy.shortfall)}. The game has ended.</p>
        {:else}
            {#if plan.treasuryProceeds}<p>Treasury shares will raise {money(plan.treasuryProceeds)}.</p>{/if}
            {#each session.trainFunding.contributions as contribution (contribution.id)}
                <p>{session.ownerName(contribution.owner)} contributed {money(contribution.amount)}.</p>
            {/each}
            {#each plan.contributions as contribution}
                <p>{session.ownerName(contribution.owner)} contributes {money(contribution.amount)}.</p>
            {/each}
            {#if plan.choice.kind === 'sell'}
                <p>{session.ownerName(plan.choice.owner)}
                    {#if plan.amountToRaise > 0}must raise <strong>{money(plan.amountToRaise)}</strong> by selling shares.
                    {:else}must sell shares to meet the ownership limit.{/if}</p>
                <div class="choices" aria-label="Funding share sales">
                    {#each session.trainFunding.sales as sale}
                        {@const companyId = sale.sales[0].companyId}
                        <button class="sale-choice" {disabled} data-funding-shares={sale.sales[0].shares}
                            aria-label={`Sell ${sale.sales[0].shares} ${getCompany(session.financialState, companyId).name} shares for ${money(sale.proceeds)}`}
                            onclick={() => session.trainFunding.resolve(sale)}>
                            <CompanyToken appearance={session.mapView.stations[companyId]} size={32} />
                            <span>{sale.sales[0].shares} {sale.sales[0].shares === 1 ? 'share' : 'shares'} · {money(sale.proceeds)}</span>
                        </button>
                    {/each}
                </div>
            {:else if plan.choice.kind === 'bankrupt'}
                <p>Unable to raise the remaining {money(plan.amountToRaise)}.</p>
                <div class="choices"><button class="action-button" {disabled}
                    onclick={() => session.trainFunding.resolve()}>Declare bankruptcy</button></div>
            {:else if plan.choice.kind === 'buy'}
                <div class="choices">
                    <span>Buy</span>
                    <TrainPurchaseButton {money} name={session.trainDepot.trainDefinition(purchase.definitionId).name}
                        definitionId={purchase.definitionId} price={purchase.price} color={trainColors[purchase.definitionId]}
                        {disabled} onclick={() => { void session.trainFunding.resolve() }} />
                </div>
            {/if}
            {#if session.trainFunding.saleHistory.length}
                <table aria-label="Shares sold for train">
                    <thead><tr><th>Seller</th><th>Company</th><th>Shares</th><th>Proceeds</th></tr></thead>
                    <tbody>{#each session.trainFunding.saleHistory as { id, details } (id)}
                        <tr><td>{session.ownerName(details.seller)}</td>
                            <td><span class="company"><CompanyToken appearance={session.mapView.stations[details.sales[0].companyId]} size={20} />{getCompany(session.financialState, details.sales[0].companyId).name}</span></td>
                            <td>{details.sales[0].shares}</td><td>{money(details.proceeds)}</td></tr>
                    {/each}</tbody>
                </table>
            {/if}
        {/if}
    </section>
{/if}

<style>
    section { font-size: 13px; color: var(--rail-text, #514536); }
    header, .choices, .company { display: flex; align-items: center; gap: 6px; }
    header, .choices { justify-content: center; flex-wrap: wrap; }
    p { text-align: center; margin: 8px 0; }
    .choices { margin-top: 10px; }
    button { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--rail-border, #c7b8a6); border-radius: 4px; background: var(--rail-surface-raised, #efe7db); color: inherit; font: inherit; cursor: pointer; }
    .sale-choice { flex-direction: column; gap: 4px; }
    button:disabled { opacity: .5; cursor: default; }
    table { border-collapse: collapse; margin: 12px auto 0; font-variant-numeric: tabular-nums; }
    th { font-weight: 500; color: var(--rail-text, #756854); border-bottom: 1px solid var(--rail-border, #c7b8a6); }
    th, td { padding: 3px 9px; text-align: left; }
    th:nth-last-child(-n+2), td:nth-last-child(-n+2) { text-align: right; }
</style>
