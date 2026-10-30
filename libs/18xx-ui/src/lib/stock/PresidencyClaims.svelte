<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const claims = $derived(session.presidencyClaims)
</script>

<section class="receivership centered-panel" aria-label="Companies in receivership">
    <h2>Take over a company</h2>
    <div class="choices">
        {#each claims.offers as offer (offer.companyId)}
            <button
                class="action-button"
                disabled={!claims.canClaim}
                onclick={() => claims.claim(offer)}
                >{session.companyName(offer.companyId)} · buy 10% for {money(offer.price)} and become
                president</button
            >
        {/each}
    </div>
</section>

<style>
    h2 {
        margin: 6px 0;
        font-size: 14px;
        font-weight: 650;
    }
    .choices {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
    }
    button {
        font: inherit;
        padding: 8px 12px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        cursor: pointer;
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
