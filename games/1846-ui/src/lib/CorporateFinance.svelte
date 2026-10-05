<script lang="ts">
    import { companyMarketSpace, finiteCashOwnedBy, getCompany } from '@tabletop/18xx'
    import { corporateFinanceCertificates, type FinanceChoice } from '@tabletop/1846'
    import { CompanyToken } from '@tabletop/18xx-ui'
    import { assertExists } from '@tabletop/common'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const money = $derived(session.presentation.money)
    const pass = $derived.by(() => {
        const choice = session.financeChoices.find((choice) => choice.operation === 'pass')
        assertExists(choice, 'Corporate finance always offers a pass')
        return choice
    })
    const companyId = $derived(pass.companyId)
    const groups = $derived(
        (['issue', 'redeem'] as const).map((operation) => ({
            operation,
            choices: session.financeChoices.filter((choice) => choice.operation === operation)
        }))
    )
    const state = $derived(session.gameState)
    const owner = $derived({ kind: 'company' as const, companyId })
</script>

{#snippet group(
    operation: 'issue' | 'redeem',
    choices: readonly FinanceChoice[],
    label: string,
    sign: string
)}
    <div class="finance-group" aria-label={label}>
        <h3>
            {label}
            {#if choices.length}<small>{money(choices[0].amount / choices[0].shares)} each</small
                >{/if}
        </h3>
        <div class="finance-choices">
            {#each choices as choice (choice.shares)}
                <button
                    class="finance-choice"
                    disabled={!session.canChooseAction}
                    aria-label={`${label} ${choice.shares} for ${money(choice.amount)}`}
                    onclick={() => session.corporateFinance(choice)}
                >
                    <span class="finance-count">{choice.shares}</span>
                    <small>{sign}{money(choice.amount)}</small>
                </button>
            {:else}
                <span class="finance-none"
                    >{operation === 'issue' ? 'No shares to issue' : 'No shares to redeem'}</span
                >
            {/each}
        </div>
    </div>
{/snippet}

<section class="corporate-finance" aria-label="Corporate finance">
    <header class="finance-prompt">
        <span>Issue or redeem shares, or</span>
        <button
            class="action-button inline-action"
            disabled={!session.canChooseAction}
            onclick={() => session.corporateFinance(pass)}>pass</button
        >
    </header>
    <div class="finance-company">
        <CompanyToken appearance={session.mapView.stations[companyId]} size={32} />
        <strong>{getCompany(state, companyId).name}</strong>
        <dl>
            <div>
                <dt>Market</dt>
                <dd>{money(companyMarketSpace(state.stockMarket, companyId).price)}</dd>
            </div>
            <div>
                <dt>Cash</dt>
                <dd>{money(finiteCashOwnedBy(state, owner))}</dd>
            </div>
            <div>
                <dt>Treasury</dt>
                <dd>{corporateFinanceCertificates(state, companyId, 'issue').length}</dd>
            </div>
            <div>
                <dt>Market pool</dt>
                <dd>{corporateFinanceCertificates(state, companyId, 'redeem').length}</dd>
            </div>
        </dl>
    </div>
    <div class="finance-groups">
        {#each groups as { operation, choices } (operation)}
            {@render group(
                operation,
                choices,
                operation === 'issue' ? 'Issue' : 'Redeem',
                operation === 'issue' ? '+' : '−'
            )}
        {/each}
    </div>
    <p class="finance-note">One transaction per turn. The stock price stays unchanged.</p>
</section>

<style>
    .corporate-finance {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
    }
    .finance-prompt {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .finance-company {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .finance-company strong {
        font-size: 15px;
        font-weight: 650;
    }
    dl {
        display: flex;
        gap: 16px;
        margin: 0 0 0 8px;
    }
    dl div {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    dt {
        font-size: 11px;
        color: var(--rail-muted, #887969);
    }
    dd {
        margin: 0;
        font-size: 15px;
        font-weight: 650;
        font-variant-numeric: tabular-nums;
    }
    .finance-groups {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 28px;
    }
    .finance-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }
    h3 {
        margin: 0;
        font-size: 11px;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--rail-muted, #887969);
    }
    h3 small {
        margin-left: 4px;
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0;
        text-transform: none;
    }
    .finance-choices {
        display: flex;
        gap: 8px;
    }
    button.finance-choice {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-width: 64px;
        padding: 6px 12px;
    }
    .finance-count {
        font-size: 24px;
        line-height: 26px;
        font-variant-numeric: tabular-nums;
    }
    .finance-choice small {
        font-size: 11px;
        font-variant-numeric: tabular-nums;
    }
    .finance-none {
        padding: 12px 0;
        color: var(--rail-muted, #887969);
    }
    .finance-note {
        margin: 0;
        color: var(--rail-muted, #887969);
    }
</style>
