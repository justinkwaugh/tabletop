<script lang="ts">
    import { spaced } from '@tabletop/feudum'
    import type { LandscapeKind, RegionId, TileEpoch } from '@tabletop/feudum'
    import { assetUrl, tileBackAsset, tileFrontAsset } from '$lib/art/assetMap.js'
    import { LandscapePaths } from '$lib/utils/pieceShapes.js'
    import PieceFrame from './PieceFrame.svelte'

    /** R-4.3 Only `faceShown` lets the landscape reach the markup, by the perspective rule. */
    let {
        faceShown,
        epoch,
        landscape,
        region,
        size = 64,
        x,
        y
    }: {
        faceShown: boolean
        epoch: TileEpoch
        landscape?: LandscapeKind
        region?: RegionId
        size?: number
        x?: number
        y?: number
    } = $props()

    const Numerals = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' } as const
    let turned = $derived(faceShown ? landscape : undefined)
    let label = $derived(
        turned ? spaced(turned) : `${region ? `${region} ` : ''}tile, epoch ${Numerals[epoch]}`
    )
</script>

<PieceFrame
    {label}
    url={assetUrl(turned ? tileBackAsset(turned) : tileFrontAsset(epoch))}
    width={size}
    height={size}
    viewBox="0 0 64 64"
    {x}
    {y}
>
    {#if turned}
        <rect
            x="1"
            y="1"
            width="62"
            height="62"
            rx="7"
            fill="var(--feudum-parchment)"
            stroke="var(--feudum-frame)"
            stroke-width="2"
        ></rect>
        <path
            d={LandscapePaths[turned]}
            transform="translate(14 8) scale(1.5)"
            fill="var(--feudum-ink)"
            fill-rule="evenodd"
        ></path>
        <text x="32" y="56" text-anchor="middle" font-size="10" fill="var(--feudum-ink)"
            >{spaced(turned)}</text
        >
    {:else}
        <rect
            x="1"
            y="1"
            width="62"
            height="62"
            rx="7"
            fill={region ? `var(--feudum-terrain-${region})` : 'var(--feudum-surface-raised)'}
            stroke="var(--feudum-frame)"
            stroke-width="2"
        ></rect>
        <text
            x="32"
            y="40"
            text-anchor="middle"
            font-size="22"
            style:font-family="var(--feudum-font-title)"
            fill="var(--feudum-parchment)">{Numerals[epoch]}</text
        >
        {#if region}
            <text x="32" y="56" text-anchor="middle" font-size="10" fill="var(--feudum-parchment)"
                >{region}</text
            >
        {/if}
    {/if}
</PieceFrame>
