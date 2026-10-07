<script lang="ts">
    let {
        minimum,
        maximum,
        label,
        onbid
    }: { minimum: number; maximum: number; label: string; onbid: (amount: number) => void } =
        $props()

    // Starts at the smallest legal bid and resets whenever the minimum moves on.
    let amount = $derived(minimum)

    function adjust(step: number) {
        amount = Math.min(maximum, Math.max(minimum, amount + step))
    }
</script>

<div class="stepper">
    <button
        type="button"
        class="step"
        aria-label="Lower the bid"
        onclick={() => adjust(-1)}
        disabled={amount <= minimum}>−</button
    >
    <span class="value">${amount}</span>
    <button
        type="button"
        class="step"
        aria-label="Raise the bid"
        onclick={() => adjust(1)}
        disabled={amount >= maximum}>+</button
    >
    <button type="button" class="primary" disabled={amount > maximum} onclick={() => onbid(amount)}
        >{label} ${amount}</button
    >
</div>

<style>
    .stepper {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .value {
        min-width: 3.2em;
        text-align: center;
        font-size: 20px;
        font-weight: 700;
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
