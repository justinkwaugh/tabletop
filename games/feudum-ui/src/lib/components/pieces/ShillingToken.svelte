<script lang="ts">
    import { assetUrl, shillingAsset, type ShillingValue } from '$lib/art/assetMap.js'
    import PieceFrame from './PieceFrame.svelte'

    /** A coin: the 5 is told by size, rim and numeral, not colour. */
    let {
        value,
        size = 24,
        x,
        y
    }: { value: ShillingValue; size?: number; x?: number; y?: number } = $props()

    const Notches = Array.from({ length: 12 }, (_, index) => (index * 360) / 12)
    let radius = $derived(value === 5 ? 11 : 9.5)
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
        r={radius}
        fill="var(--feudum-shilling)"
        stroke="var(--feudum-ink)"
        stroke-width="1"
    ></circle>
    <circle cx="12" cy="12" r={radius - 2} fill="none" stroke="var(--feudum-ink)" stroke-width="0.5"
    ></circle>
    {#if value === 5}
        {#each Notches as angle (angle)}
            <rect
                x="11.5"
                y="1"
                width="1"
                height="1.5"
                fill="var(--feudum-ink)"
                transform="rotate({angle} 12 12)"
            ></rect>
        {/each}
    {/if}
    <text
        x="12"
        y="16"
        text-anchor="middle"
        font-size="11"
        font-weight="700"
        fill="var(--feudum-ink)">{value}</text
    >
</PieceFrame>
