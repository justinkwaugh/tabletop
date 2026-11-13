<script lang="ts">
    import { currencyAffixes } from '@tabletop/18xx-ui'
    import type { Session1822 } from './session.svelte.js'

    let { session }: { session: Session1822 } = $props()
    const money = $derived(session.presentation.money)
    const declarer = $derived(session.cashDeclarer)
    const loan = $derived(session.loanRepayment)
    const currency = $derived(currencyAffixes(money))
    // What the player means to pay, the most they can until they type another amount.
    let typed = $derived.by((): string | undefined => {
        void loan
        return undefined
    })
    const payment = $derived(typed === undefined ? (loan?.most ?? 0) : Number(typed))
    const payable = $derived(
        !!loan && Number.isInteger(payment) && payment >= 1 && payment <= loan.most
    )
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
        <p>
            You owe <strong>{money(loan.owed)}</strong> on your loan, and may not buy or bid until it
            is repaid.
        </p>
        <label class="payment"
            >Pay {currency.before}<input
                type="number"
                inputmode="numeric"
                min="1"
                max={loan.most}
                aria-label="Amount to repay"
                aria-invalid={payable ? undefined : 'true'}
                value={typed ?? loan.most}
                oninput={(event) => (typed = event.currentTarget.value)}
            />{currency.after}</label
        >
        <button class="action-button" disabled={!payable} onclick={() => session.repayLoan(payment)}
            >{payment === loan.owed ? 'Pay off the loan' : 'Pay towards the loan'}</button
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
    .payment {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
    .payment input {
        width: 5ch;
        padding: 2px 0;
        border: 0;
        border-bottom: 1px dashed var(--rail-border, #c7b8a6);
        background: transparent;
        color: inherit;
        font: inherit;
        appearance: textfield;
        -moz-appearance: textfield;
    }
    .payment input::-webkit-inner-spin-button,
    .payment input::-webkit-outer-spin-button {
        appearance: none;
        margin: 0;
    }
    .payment input:focus {
        outline: 2px solid var(--rail-focus, #443e35);
        outline-offset: 2px;
        box-shadow: none;
    }
    .payment input[aria-invalid='true'] {
        color: var(--rail-negative, #b33a32);
        border-bottom-color: var(--rail-negative, #b33a32);
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
