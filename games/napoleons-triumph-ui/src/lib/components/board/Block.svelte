<script lang="ts">
    import type { Face } from '@tabletop/napoleons-triumph'
    import UnitFace from '$lib/components/UnitFace.svelte'
    import type { ArmyColors } from '$lib/utils/armyColors.js'
    import { BLOCK_LENGTH, BLOCK_THICKNESS } from '$lib/utils/pieceLayout.js'

    let {
        x,
        y,
        angle,
        colors,
        face,
        dimmed = false,
        spent = false,
        leading = false
    }: {
        x: number
        y: number
        angle: number
        colors: ArmyColors
        face?: Face
        dimmed?: boolean
        spent?: boolean
        leading?: boolean
    } = $props()

    const EDGE = 3
    // Workaround: stacked blocks leave slivers between them, so each takes taps a little beyond its edges.
    const HIT_MARGIN = 2
</script>

<g transform="translate({x} {y}) rotate({angle})" opacity={dimmed ? 0.45 : 1}>
    <rect
        x={-BLOCK_LENGTH / 2}
        y={-BLOCK_THICKNESS / 2 - HIT_MARGIN}
        width={BLOCK_LENGTH}
        height={BLOCK_THICKNESS + HIT_MARGIN * 2}
        fill="transparent"
    ></rect>
    <rect
        x={-BLOCK_LENGTH / 2}
        y={-BLOCK_THICKNESS / 2}
        width={BLOCK_LENGTH}
        height={BLOCK_THICKNESS}
        rx="1.5"
        fill={colors.shade}
    ></rect>
    <rect
        x={-BLOCK_LENGTH / 2}
        y={-BLOCK_THICKNESS / 2}
        width={BLOCK_LENGTH}
        height={BLOCK_THICKNESS - EDGE}
        rx="1.5"
        fill={colors.block}
    ></rect>
    {#if face}
        <g transform="translate(0 {-EDGE / 2})">
            <UnitFace
                {face}
                ink={colors.ink}
                ground={colors.block}
                symbolHeight={11}
                symbolWidth={16}
            />
        </g>
    {/if}
    {#if leading}
        <path d="M{-BLOCK_LENGTH / 2 - 5} -7.5 l-12 7.5 l12 7.5 z" fill="#2b2620"></path>
    {/if}
    {#if spent}
        <circle cx={BLOCK_LENGTH / 2 - 8} cy={-EDGE / 2} r="3.2" fill={colors.ink} opacity="0.85"
        ></circle>
    {/if}
</g>
