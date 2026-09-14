<script lang="ts">
    let {
        amount,
        increment,
        canBid,
        canDecrease,
        canIncrease,
        canPass,
        onChange,
        onBid,
        onPass
    }: {
        amount: number
        increment: number
        canBid: boolean
        canDecrease: boolean
        canIncrease: boolean
        canPass: boolean
        onChange: (amount: number) => void
        onBid: () => void
        onPass: () => void
    } = $props()
</script>

<div class="controls">
    <div class="amount-control" role="group" aria-label="Bid amount">
        <button
            aria-label="Decrease bid"
            disabled={!canDecrease}
            onclick={() => onChange(amount - increment)}>−</button
        >
        <output aria-label="Bid amount">${amount.toLocaleString('en-US')}</output>
        <button
            aria-label="Increase bid"
            disabled={!canIncrease}
            onclick={() => onChange(amount + increment)}>+</button
        >
    </div>
    <button class="bid action-button" disabled={!canBid} onclick={onBid}>Bid</button>
    <button class="pass action-button" disabled={!canPass} onclick={onPass}>Pass</button>
</div>

<style>
    .controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }
    .amount-control {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        border: 1px solid #c7b8a6;
        border-radius: 6px;
        overflow: hidden;
    }
    button {
        height: 32px;
        padding: 0 14px;
        border: 1px solid #c7b8a6;
        border-radius: 6px;
        background: transparent;
        color: #514536;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
    }
    .amount-control button {
        border: 0;
        border-radius: 0;
        padding: 0;
        width: 32px;
        font-size: 19px;
    }
    output {
        min-width: 68px;
        padding: 0 6px;
        text-align: center;
        font-size: 15px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
    .bid {
        background: #695540;
        border-color: #695540;
        color: #fffaf4;
    }
    button:hover:not(:disabled) {
        background: #e8dfd3;
    }
    .bid:hover:not(:disabled) {
        background: #51412f;
    }
    button:disabled {
        opacity: 0.35;
        cursor: default;
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: -2px;
    }
</style>
