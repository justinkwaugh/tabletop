<script lang="ts">
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSession } = $props()
    const money = $derived(session.presentation.money)
    const companyId = $derived(session.loans.operatingCompanyId)
    const rules = $derived(session.loans.rules)
</script>

{#if rules && companyId}
    <div class="loan-actions" aria-label="Loans">
        <span
            >Loans {session.loans.loans(companyId)}/{session.loans.capacity(companyId)} · {session
                .loans.rate}%</span
        >
        {#if session.loans.canTake && session.gameState.machineState !== 'RepayingLoans'}<button
                onclick={() => session.loans.take(companyId)}
                >Take loan ({money(rules.value)})</button
            >{/if}
    </div>
{/if}

<style>
    .loan-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 3px 8px;
        font-size: 12px;
        color: var(--rail-text, #51412f);
        white-space: nowrap;
    }
    button {
        border: 0;
        border-radius: 4px;
        padding: 3px 10px;
        background: var(--rail-surface-selected, #ded0c2);
        color: var(--rail-text, #51412f);
        font: inherit;
        cursor: pointer;
    }
    button:hover {
        background: var(--rail-surface-selected, #cdbba9);
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #695543);
        outline-offset: 2px;
    }
</style>
