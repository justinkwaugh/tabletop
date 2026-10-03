<script lang="ts">
    import { cashOwnedBy } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: EighteenXXSessionView } =
        $props()
    const money = $derived(session.presentation.money)
    const companyId = $derived(session.gameState.loanStep?.companyId)
    const rules = $derived(session.loans.rules)
    const paid = $derived(session.loans.interestPaid)
</script>

{#if companyId && rules && session.gameState.machineState === 'RepayingLoans'}
    {@const name = session.gameState.companies.find((company) => company.id === companyId)?.name}
    <section aria-label="Loans">
        <h2>{name} · Loans {session.loans.loans(companyId)}/{session.loans.capacity(companyId)}</h2>
        <p>
            {#if paid?.default}
                Could not pay {money(paid.interest)} interest and was liquidated.
            {:else if paid}
                Paid {money(paid.interest)} interest at {session.loans.rate}%{#if paid.loansTaken},
                    borrowing
                    {paid.loansTaken}
                    {paid.loansTaken === 1 ? 'loan' : 'loans'}{/if}.
            {:else}
                No interest to pay.
            {/if}
            Treasury {money(
                Number(cashOwnedBy(session.gameState, { kind: 'company', companyId }))
            )}.
        </p>
        <div class="choices">
            {#if session.loans.canRepay}<button onclick={() => session.loans.repay(companyId)}
                    >Repay a loan ({money(rules.value)})</button
                >{/if}
            {#if session.loans.canTake}<button onclick={() => session.loans.take(companyId)}
                    >Take a loan ({money(rules.value)})</button
                >{/if}
            <button
                disabled={!session.operating.canFinish}
                onclick={() => session.operating.finish()}>Finish turn</button
            >
            {#if showUndo}<button
                    disabled={session.busy ||
                        session.updatingVisibleState ||
                        session.isViewingHistory ||
                        !session.actions.length}
                    onclick={() => session.undo()}>Undo</button
                >{/if}
        </div>
        {#if session.loans.canTake && session.loans.canRepay}<p class="note">
                Taking a loan now ends repayments for this turn.
            </p>{/if}
    </section>
{/if}

<style>
    section {
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 12px;
        text-align: center;
    }
    h2 {
        margin: 0 0 4px;
        font-size: 13px;
    }
    p {
        margin: 0 0 8px;
    }
    .note {
        margin: 8px 0 0;
        color: var(--rail-muted, #7d6c5a);
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    button {
        padding: 7px 12px;
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
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
