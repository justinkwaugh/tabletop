<script lang="ts">
    let {
        value,
        max,
        onChange,
        large = false
    }: { value: number; max: number; onChange: (value: number) => void; large?: boolean } =
        $props()
</script>

<div class="stepper" class:large>
    <button
        type="button"
        disabled={value <= 0}
        aria-label="One sack fewer"
        onclick={() => onChange(value - 1)}>−</button
    >
    <span class="value">{value}</span>
    <button
        type="button"
        disabled={value >= max}
        aria-label="One sack more"
        onclick={() => onChange(value + 1)}>+</button
    >
</div>

<style>
    .stepper {
        display: flex;
        align-items: center;
        gap: 2px;
        height: 22px;
    }

    button {
        width: 16px;
        height: 18px;
        border-radius: 4px;
        background: rgba(255, 220, 110, 0.55);
        font-size: 14px;
        line-height: 1;
        color: #4a2c16;
    }

    button:disabled {
        opacity: 0.25;
    }

    .value {
        min-width: 14px;
        color: #7d7d7d;
        font-family: 'Kartoffeln Pen', 'Comic Sans MS', cursive;
        font-size: 20px;
        font-weight: 700;
        line-height: 1;
        text-align: center;
    }

    .large {
        height: 36px;
    }

    .large button {
        width: 26px;
        height: 34px;
        font-size: 20px;
    }

    .large .value {
        min-width: 16px;
        font-size: 24px;
    }
</style>
