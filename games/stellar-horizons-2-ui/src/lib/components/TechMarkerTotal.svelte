<script lang="ts">
    import type { TechField } from '@tabletop/stellar-horizons-2'
    import { TECH_MARKER_BLANK_ART } from '$lib/art/manifest.js'

    let {
        field,
        values,
        size = 40
    }: { field: TechField; values: readonly number[]; size?: number } = $props()

    const total = $derived(values.reduce((sum, value) => sum + value, 0))
    const title = $derived(
        values.length === 0
            ? `No ${field.toLowerCase()} markers`
            : `${field} markers: ${values.join(', ')} (total ${total})`
    )
</script>

<span
    class="total"
    class:empty={values.length === 0}
    style:width="{size}px"
    style:height="{size}px"
    style:--digit-size="{size * (total >= 10 ? 0.44 : 0.56)}px"
    {title}
>
    <img src={TECH_MARKER_BLANK_ART[field]} alt="" width={size} height={size} />
    <span class="value">{total}</span>
</span>

<style>
    .total {
        position: relative;
        display: inline-block;
        flex-shrink: 0;
    }

    .total img {
        display: block;
        border-radius: 4px;
    }

    .total.empty {
        opacity: 0.4;
    }

    .value {
        position: absolute;
        left: 0;
        right: 0;
        top: 51%;
        transform: translateY(-50%);
        text-align: center;
        font-family: 'Hind Digits', sans-serif;
        font-weight: 700;
        font-size: var(--digit-size);
        line-height: 1;
        color: #ffffff;
        text-shadow:
            0 1px 2px rgba(0, 0, 0, 0.75),
            1px 2px 3px rgba(0, 0, 0, 0.45);
    }
</style>
