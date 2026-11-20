<script lang="ts">
    import { currencyAffixes, type MoneyFormat } from '../presentation/money.js'

    /**
     * A player's loan taken for a company's train, repaid in their stock turn: as much of their
     * cash as they choose, the most they can until they type another amount.
     */
    let {
        money,
        owed,
        most,
        noun = 'loan',
        restriction,
        onRepay
    }: {
        money: MoneyFormat
        owed: number
        most: number
        noun?: string
        restriction: string
        onRepay: (amount: number) => void
    } = $props()
    const currency = $derived(currencyAffixes(money))
    let typed = $derived.by((): string | undefined => {
        void most
        return undefined
    })
    const payment = $derived(typed === undefined ? most : Number(typed))
    const payable = $derived(Number.isInteger(payment) && payment >= 1 && payment <= most)
</script>

<section class="loan centered-panel" aria-label={`Your ${noun}`}>
    <p>
        You owe <strong>{money(owed)}</strong> on your {noun}, and {restriction}
    </p>
    <label class="payment"
        >Pay {currency.before}<input
            type="number"
            inputmode="numeric"
            min="1"
            max={most}
            aria-label="Amount to repay"
            aria-invalid={payable ? undefined : 'true'}
            value={typed ?? most}
            oninput={(event) => (typed = event.currentTarget.value)}
        />{currency.after}</label
    >
    <button class="action-button" disabled={!payable} onclick={() => onRepay(payment)}
        >{payment === owed ? `Pay off the ${noun}` : `Pay towards the ${noun}`}</button
    >
</section>

<style>
    .loan {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px 14px;
        padding-bottom: 8px;
        margin-bottom: 8px;
        border-bottom: 1px solid var(--rail-border, #c7b8a6);
        font-size: 13px;
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
