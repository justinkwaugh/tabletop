<script lang="ts">
    import { cashOwnedBy, getCompany, trainsOwnedBy } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import PrivateCard from '../privates/PrivateCard.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import { cashText } from '../presentation/money.js'
    let {
        session,
        companyId,
        purchaseRange
    }: {
        session: EighteenXXSessionView
        companyId: string
        purchaseRange?: { minimum: number; maximum?: number }
    } = $props()
    const company = $derived(getCompany(session.gameState, companyId))
    const money = $derived(session.presentation.money)
    const owner = $derived({ kind: 'company' as const, companyId })
</script>

{#if company.kind === 'private'}
    <PrivateCard
        {money}
        phaseColors={session.presentation.phaseColors}
        token={session.privateCompanyTokens[company.id]}
        name={company.name}
        description=""
        income={company.privateRevenue ?? 0}
        {purchaseRange}
    />
{:else}
    <article class="company-purchase-card">
        <header>
            <CompanyToken appearance={session.mapView.stations[companyId]} size={40} />
            <div><strong>{company.name}</strong><small>Independent railway</small></div>
        </header>
        <div class="assets">
            <span>Treasury {cashText(money, cashOwnedBy(session.gameState, owner))}</span>
            <span
                >Trains {trainsOwnedBy(session.gameState, owner)
                    .map((train) => train.definitionId)
                    .join(', ') || 'None'}</span
            >
        </div>
        {#if purchaseRange}<p>
                Purchase {money(purchaseRange.minimum)}{purchaseRange.maximum !== undefined
                    ? `–${money(purchaseRange.maximum)}`
                    : '+'}
            </p>{/if}
    </article>
{/if}

<style>
    article {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface-raised, #efe7db);
        padding: 10px;
        color: var(--rail-text, #514536);
    }
    header {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    strong {
        font-size: 13px;
    }
    small {
        display: block;
        font-size: 11px;
        color: var(--rail-muted, #887969);
    }
    .assets {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-top: 8px;
        font-size: 12px;
    }
    p {
        margin: 6px 0 0;
        font-size: 12px;
    }
</style>
