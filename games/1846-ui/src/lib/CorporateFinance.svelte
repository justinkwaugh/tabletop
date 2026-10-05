<script lang="ts">
    import { finiteCashOwnedBy } from '@tabletop/18xx'
    import { corporateFinanceCertificates, type FinanceChoice } from '@tabletop/1846'
    import { CompanyToken } from '@tabletop/18xx-ui'
    import { assertExists } from '@tabletop/common'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const money = $derived(session.presentation.money)
    const companyId = $derived.by(() => {
        const choice = session.financeChoices[0]
        assertExists(choice, 'The share transaction panel requires a legal transaction')
        return choice.companyId
    })
    const groups = $derived(
        (['issue', 'redeem'] as const)
            .map((operation) => ({
                operation,
                choices: session.financeChoices.filter((choice) => choice.operation === operation)
            }))
            .filter(({ choices }) => choices.length)
    )
    const appearance = $derived(session.mapView.stations[companyId])
    const state = $derived(session.gameState)
    const owner = $derived({ kind: 'company' as const, companyId })
</script>

{#snippet group(choices: readonly FinanceChoice[], label: string, sign: string)}
    <div class="finance-group" aria-label={label}>
        <h3>{label} <small>{money(choices[0].amount / choices[0].shares)} each</small></h3>
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
            {/each}
        </div>
    </div>
{/snippet}

<section class="corporate-finance" aria-label="Corporate finance">
    <dl class="finance-strip">
        <div class="finance-identity">
            <dt class="visually-hidden">Company</dt>
            <dd><CompanyToken {appearance} size={28} />{appearance.label}</dd>
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
            <dt>Market</dt>
            <dd>{corporateFinanceCertificates(state, companyId, 'redeem').length}</dd>
        </div>
    </dl>
    <div class="finance-groups">
        {#each groups as { operation, choices } (operation)}
            {@render group(
                choices,
                operation === 'issue' ? 'Issue' : 'Redeem',
                operation === 'issue' ? '+' : '−'
            )}
        {/each}
    </div>
</section>

<style>
    .corporate-finance {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
    }
    .finance-strip {
        display: flex;
        align-items: stretch;
        margin: 0;
        border: 1px solid var(--rail-border, #c9baa5);
        border-radius: 6px;
        background: var(--rail-surface-raised, #efe7db);
    }
    .finance-strip > div {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 76px;
        padding: 6px 14px;
    }
    .finance-strip > div + div::before {
        content: '';
        position: absolute;
        left: 0;
        top: 25%;
        height: 50%;
        border-left: 1px solid var(--rail-border, #c9baa5);
    }
    .finance-identity dd {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    dt {
        font-size: 11px;
        color: var(--rail-muted, #887969);
    }
    dd {
        margin: 0;
        font-size: 15px;
        font-weight: 650;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
    }
    .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
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
</style>
