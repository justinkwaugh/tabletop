<script lang="ts">
    let {
        value,
        min,
        max,
        onchange,
        label
    }: {
        value: number
        min: number
        max: number
        onchange: (value: number) => void
        label: string
    } = $props()
</script>

<div class="stepper" role="group" aria-label={label}>
    <button
        type="button"
        disabled={value <= min}
        onclick={() => onchange(value - 1)}
        aria-label="Less">−</button
    >
    <span class="value">{value}</span>
    <button
        type="button"
        disabled={value >= max}
        onclick={() => onchange(value + 1)}
        aria-label="More">+</button
    >
</div>

<style>
    .stepper {
        display: inline-flex;
        align-items: stretch;
        border: 2px solid #8d987a;
        border-radius: 6px;
        overflow: hidden;
        background: #1b201b;
    }
    button {
        width: 34px;
        font-size: 22px;
        line-height: 1;
        color: #ecebe1;
        background: #3b4529;
    }
    button:disabled {
        color: #6d7562;
        background: #2b3222;
    }
    button:not(:disabled):hover {
        background: #4b5735;
    }
    .value {
        min-width: 48px;
        text-align: center;
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 24px;
        color: #f3c534;
        padding: 0 6px;
    }
</style>
