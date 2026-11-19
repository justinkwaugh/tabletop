<script lang="ts">
    import type { BeadValue } from '@tabletop/feudum'
    import { SealAsset, assetUrl, beadAsset } from '$lib/art/assetMap.js'
    import { CrownPath } from '$lib/utils/pieceShapes.js'
    import PieceFrame from './PieceFrame.svelte'

    /**
     * R-5-H1 One disc with two sides. Red side up it is the same crowned seal for everyone, its
     * holder included, so nothing of its value reaches the markup; a flip shows the bead to all.
     * A game piece, so never a halo: a cost is not read as a seal, nor a seal as a cost.
     */
    let {
        faceShown,
        beadValue,
        size = 24,
        x,
        y
    }: {
        faceShown: boolean
        beadValue?: BeadValue
        size?: number
        x?: number
        y?: number
    } = $props()

    let bead = $derived(faceShown ? beadValue : undefined)
</script>

<PieceFrame
    label={bead ? `bead +${bead}` : "king's seal"}
    url={assetUrl(bead ? beadAsset(bead) : SealAsset)}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    {x}
    {y}
>
    {#if bead}
        <circle cx="12" cy="12" r="11" fill="var(--feudum-bead)" stroke="var(--feudum-ink)"
        ></circle>
        <path d="M2 16 L22 16 L20.5 19 L3.5 19 Z" fill="var(--feudum-terrain-sea)"></path>
        <text
            x="12"
            y="14"
            text-anchor="middle"
            font-size="11"
            font-weight="700"
            fill="var(--feudum-ink)">+{bead}</text
        >
    {:else}
        <circle cx="12" cy="12" r="11" fill="var(--feudum-seal)" stroke="var(--feudum-ink)"
        ></circle>
        <path d={CrownPath} transform="translate(4 4) scale(0.67)" fill="var(--feudum-parchment)"
        ></path>
    {/if}
</PieceFrame>
