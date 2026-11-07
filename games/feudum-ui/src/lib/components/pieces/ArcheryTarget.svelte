<script lang="ts">
    import { TargetAsset, assetUrl } from '$lib/art/assetMap.js'
    import PieceFrame from './PieceFrame.svelte'

    /** An archery target, held by a landscape or in supply. */
    let { size = 24, x, y }: { size?: number; x?: number; y?: number } = $props()

    const Rings = [
        { r: 11, fill: 'var(--feudum-wood-piece)' },
        { r: 8, fill: 'var(--feudum-parchment)' },
        { r: 5, fill: 'var(--feudum-terrain-line)' },
        { r: 2, fill: 'var(--feudum-parchment)' }
    ]
</script>

<PieceFrame
    label="archery target"
    url={assetUrl(TargetAsset)}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    {x}
    {y}
>
    {#each Rings as ring (ring.r)}
        <circle
            cx="12"
            cy="12"
            r={ring.r}
            fill={ring.fill}
            stroke="var(--feudum-terrain-line)"
            stroke-width="0.5"
        ></circle>
    {/each}
</PieceFrame>
