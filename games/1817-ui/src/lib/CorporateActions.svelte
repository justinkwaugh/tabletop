<script lang="ts">
    import { cashOwnedBy, getCompany } from '@tabletop/18xx'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let { session }: { session: EighteenSeventeenSession } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
</script>

{#if session.corporateActions.length}
    <section aria-label="Corporate actions">
        <h2>
            {gameState.stockRound.turn.corporateAction ? 'Acting for' : 'Or act for a company'}
        </h2>
        {#each session.corporateActions as { companyId, canBorrow, buyBack } (companyId)}
            <div class="company">
                <strong>{getCompany(gameState, companyId).name}</strong>
                <span
                    >Treasury {money(
                        Number(cashOwnedBy(gameState, { kind: 'company', companyId }))
                    )} · Loans {session.loans.loans(companyId)}/{session.loans.capacity(
                        companyId
                    )}</span
                >
                {#if canBorrow}<button disabled={busy} onclick={() => session.loans.take(companyId)}
                        >Take a loan</button
                    >{/if}
                {#if buyBack}<button disabled={busy} onclick={() => session.buyBackShare(companyId)}
                        >Buy back a share ({money(buyBack.price)})</button
                    >{/if}
            </div>
        {/each}
    </section>
{/if}

<style>
    section {
        padding: 6px 0;
        font-size: 12px;
        color: var(--rail-text, #514536);
        text-align: center;
    }
    h2 {
        margin: 0 0 4px;
        font-size: 13px;
    }
    .company {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 4px;
    }
    button {
        padding: 5px 10px;
        font: inherit;
        color: inherit;
        cursor: pointer;
        background: var(--rail-surface, #fffdf8);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 7px;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
