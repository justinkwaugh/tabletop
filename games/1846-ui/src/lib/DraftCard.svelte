<script lang="ts">
    import type { Snippet } from 'svelte'
    import { draftCompany, isBlank } from '@tabletop/1846'
    import { PrivateCard } from '@tabletop/18xx-ui'
    import { CompanyDescriptions } from './companyDescriptions.js'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let {
        session,
        cardId,
        price,
        actions
    }: {
        session: EighteenFortySixSession
        cardId: string
        price: number
        actions: Snippet
    } = $props()
    const money = $derived(session.presentation.money)
</script>

{#if isBlank(cardId)}
    <article class="draft-card blank" aria-label="Pass card">
        <div class="blank-face">
            <strong>Pass</strong>
            <span>Take no company</span>
        </div>
        <footer>{@render actions()}</footer>
    </article>
{:else}
    {@const company = draftCompany(cardId)}
    <article class="draft-card" aria-label={company.name}>
        <PrivateCard
            {money}
            phaseColors={session.presentation.phaseColors}
            name={company.name}
            description={CompanyDescriptions[cardId]}
            income={company.kind === 'private' && company.revenue ? company.revenue : undefined}
            token={company.kind === 'independent'
                ? session.mapView.stations[cardId]
                : session.privateCompanyTokens[cardId]}
        />
        <footer>
            <div class="price">
                <strong>{money(price)}</strong>
                {#if company.kind === 'independent'}<small
                        >{money(company.price)} treasury · {money(company.debt)} debt</small
                    >{/if}
            </div>
            {@render actions()}
        </footer>
    </article>
{/if}

<style>
    .draft-card {
        display: flex;
        flex-direction: column;
        width: 232px;
        border-radius: 9px;
        background: var(--rail-surface, #fffdf8);
        box-shadow:
            0 0 0 1px var(--rail-border, #c9baa5),
            0 4px 14px var(--rail-shadow, #0000002e);
        overflow: hidden;
        transition:
            transform 140ms ease-out,
            box-shadow 140ms ease-out;
    }
    .draft-card:has(footer :global(button:not(:disabled))):hover {
        transform: translateY(-2px);
        box-shadow:
            0 0 0 1px var(--rail-focus, #b8cddd),
            0 8px 20px var(--rail-shadow, #00000040);
    }
    .draft-card > :global(.private-card) {
        flex: 1;
        border: 0;
        border-radius: 0;
    }
    footer {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px 12px;
        border-top: 1px solid var(--rail-border, #c9baa5);
        background: var(--rail-surface-raised, #efe7db);
    }
    .price {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
    }
    .price strong {
        font-size: 20px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }
    .price small {
        font-size: 11px;
        opacity: 0.75;
    }
    footer :global(button) {
        width: 100%;
    }
    .blank {
        width: 150px;
        box-shadow: none;
        border: 2px dashed var(--rail-border, #c9baa5);
        background: transparent;
    }
    .blank-face {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-height: 140px;
        padding: 16px;
        text-align: center;
    }
    .blank-face strong {
        font-size: 16px;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .blank-face span {
        opacity: 0.7;
    }
    .blank footer {
        border-top-style: dashed;
        background: transparent;
    }
    @media (prefers-reduced-motion: reduce) {
        .draft-card {
            transition: none;
        }
    }
</style>
