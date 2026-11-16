<script lang="ts">
    let {
        minimum,
        maximum,
        onbid
    }: { minimum: number; maximum: number; onbid: (amount: number) => void } = $props()

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
        >{valid ? `Bid $${amount}` : 'Bid'}</button
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
        border-bottom: 2px solid var(--po-rule);
        font-size: 20px;
        font-weight: 700;
    }

    .value:focus-within {
        border-bottom-color: var(--po-accent);
    }

    .value.invalid {
        border-bottom-color: var(--po-danger);
        color: var(--po-danger);
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
        border: 2px solid var(--po-accent);
        color: var(--po-accent);
        font-size: 20px;
        line-height: 1;
    }

    .step:disabled {
        opacity: 0.35;
    }

    @media (max-width: 639px) {
        .stepper {
            gap: 6px;
        }

        .step {
            width: 30px;
            height: 30px;
            font-size: 18px;
        }

        .value {
            font-size: 17px;
        }

        .primary {
            padding: 0.25rem 0.7rem;
        }
    }
</style>
