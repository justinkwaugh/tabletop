<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const companyId = $derived(session.loans.operatingCompanyId)
    const rules = $derived(session.loans.rules)
    /** A right's name mid-sentence: "ferry marker", but "E token" keeps its letter. */
    const inSentence = (name: string) =>
        /^\p{Lu}\s/u.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1)
    const terms = $derived(session.presentation.loanTerms)
</script>

{#each session.accessRights.offers as offer (`${offer.companyId}:${offer.rightId}`)}
    <div class="loan-actions" aria-label="Rights">
        <button onclick={() => session.accessRights.buy(offer)}
            >Buy {inSentence(offer.name)} ({money(offer.price)})</button
        >
    </div>
{/each}
{#if rules && companyId}
    <div class="loan-actions" aria-label={terms?.name ?? 'Loans'}>
        <span
            >{terms?.name ?? 'Loans'}
            {session.loans.loans(companyId)}/{session.loans.capacity(
                companyId
            )}{#if !terms?.fixedTerms}
                · {session.loans.rate}%{/if}</span
        >
        {#if session.loans.canTake && session.gameState.machineState !== 'RepayingLoans'}<button
                onclick={() => session.loans.take(companyId)}
                >{terms?.take ?? 'Take loan'} ({money(rules.value)})</button
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
