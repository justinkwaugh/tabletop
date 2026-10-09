<script lang="ts">
    let {
        minimum,
        maximum,
        label,
        onbid
    }: { minimum: number; maximum: number; label: string; onbid: (amount: number) => void } =
        $props()

    let amount = $derived(minimum)

    const valid = $derived(Number.isInteger(amount) && amount >= minimum && amount <= maximum)

    function clamp(value: number): number {
        return Math.min(maximum, Math.max(minimum, value))
    }

    function adjust(step: number) {
        amount = clamp((Number.isInteger(amount) ? amount : minimum) + step)
    }

    function bid() {
        if (valid) {
            onbid(amount)
        }
    }
</script>

<div class="stepper">
    <button
        type="button"
        class="step"
        aria-label="Lower the bid"
        onclick={() => adjust(-1)}
        disabled={Number.isInteger(amount) && amount <= minimum}>−</button
    >
    <label class="value" class:invalid={!valid}>
        $<input
            type="number"
            inputmode="numeric"
            aria-label="Bid amount"
            min={minimum}
            max={maximum}
            step="1"
            value={amount}
            oninput={(event) => (amount = event.currentTarget.valueAsNumber)}
            onkeydown={(event) => {
                if (event.key === 'Enter') {
                    bid()
                }
            }}
        />
    </label>
    <button
        type="button"
        class="step"
        aria-label="Raise the bid"
        onclick={() => adjust(1)}
        disabled={Number.isInteger(amount) && amount >= maximum}>+</button
    >
    <button type="button" class="primary" disabled={!valid} onclick={bid}
        >{label} {valid ? `$${amount}` : ''}</button
    >
</div>

<style>
    .stepper {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .value {
        display: inline-flex;
        align-items: baseline;
        border-bottom: 2px solid #d4b48c;
        font-size: 20px;
        font-weight: 700;
    }

    .value:focus-within {
        border-bottom-color: #7a1d22;
    }

    .value.invalid {
        border-bottom-color: #b0262e;
        color: #b0262e;
    }

    input {
        width: 2.4em;
        border: none;
        padding: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: center;
        appearance: textfield;
        -moz-appearance: textfield;
    }

    input:focus {
        outline: none;
        box-shadow: none;
    }

    input::-webkit-inner-spin-button,
    input::-webkit-outer-spin-button {
        margin: 0;
        -webkit-appearance: none;
    }

    .step {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        border: 2px solid #7a1d22;
        color: #7a1d22;
        font-size: 20px;
        line-height: 1;
    }

    .step:disabled {
        opacity: 0.35;
    }
</style>
