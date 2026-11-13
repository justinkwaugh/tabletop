<script lang="ts">
    import type { Session1822 } from './session.svelte.js'

    let { session }: { session: Session1822 } = $props()
    const money = $derived(session.presentation.money)
    const declarer = $derived(session.cashDeclarer)
    const loan = $derived(session.loanRepayment)
</script>

{#if declarer}
    {@const cash = session.playerCash(declarer)}
    <section class="stock-turn title-panel centered-panel" aria-label="Cash declaration">
        {#if session.canDeclareCash}
            <p>
                The next stock round runs from most cash to least. Holding P9, you may declare
                double your cash for that order.
            </p>
            <div class="choices">
                <button class="action-button" onclick={() => session.declareCash(false)}
                    >Declare {money(cash)}</button
                >
                <button class="action-button" onclick={() => session.declareCash(true)}
                    >Declare double, {money(cash * 2)}</button
                >
            </div>
        {:else}
            <p>
                {session.getPlayerName(declarer)} holds P9 and is declaring their cash for the next stock
                round’s order.
            </p>
        {/if}
    </section>
{:else if loan}
    <section class="stock-turn loan centered-panel" aria-label="Your loan">
        <p>You owe <strong>{money(loan.owed)}</strong> on your loan.</p>
        <button class="action-button" onclick={() => session.repayLoan()}
            >Pay {money(loan.pays)} towards it</button
        >
    </section>
{/if}

<style>
    .stock-turn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        font-size: 13px;
    }
    .loan {
        flex-direction: row;
        justify-content: center;
        flex-wrap: wrap;
        gap: 6px 14px;
        padding-bottom: 8px;
        margin-bottom: 8px;
        border-bottom: 1px solid var(--rail-border, #c7b8a6);
    }
    p {
        margin: 0;
        max-width: 36em;
        text-align: center;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    .action-button {
        padding: 6px 14px;
        border: 1px solid transparent;
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
    }
    .action-button:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
