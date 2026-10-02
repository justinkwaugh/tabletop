<script lang="ts">
    import { companyMarketSpace, getCompany } from '@tabletop/18xx'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let { session }: { session: EighteenSeventeenSession } = $props()
    const money = $derived(session.presentation.money)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
</script>

{#if session.shortableCompanies.length}
    <section aria-label="Short selling">
        <h2>Or short a company</h2>
        <div class="choices">
            {#each session.shortableCompanies as companyId (companyId)}
                <button disabled={busy} onclick={() => session.shortShare(companyId)}
                    >Short {getCompany(session.gameState, companyId).name} ({money(
                        companyMarketSpace(session.gameState.stockMarket, companyId).price
                    )})</button
                >
            {/each}
        </div>
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
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
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
