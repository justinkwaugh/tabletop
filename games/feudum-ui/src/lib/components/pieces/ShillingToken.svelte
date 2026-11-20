<script lang="ts">
    import { assetUrl, shillingAsset, type ShillingValue } from '$lib/art/assetMap.js'
    import PieceFrame from './PieceFrame.svelte'

    /** A one-shilling coin: every shilling the table draws is a single one. */
    let {
        value,
        size = 24,
        x,
        y
    }: { value: ShillingValue; size?: number; x?: number; y?: number } = $props()

    const Radius = 9.5
</script>

<PieceFrame
    label="{value}s"
    url={assetUrl(shillingAsset(value))}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    {x}
    {y}
>
    <circle
        cx="12"
        cy="12"
        r={Radius}
        fill="var(--feudum-shilling)"
        stroke="var(--feudum-ink)"
        stroke-width="1"
    ></circle>
    <circle cx="12" cy="12" r={Radius - 2} fill="none" stroke="var(--feudum-ink)" stroke-width="0.5"
    ></circle>
    <text
        x="12"
        y="16"
        text-anchor="middle"
        font-size="11"
        font-weight="700"
        fill="var(--feudum-ink)">{value}</text
    >
</PieceFrame>
