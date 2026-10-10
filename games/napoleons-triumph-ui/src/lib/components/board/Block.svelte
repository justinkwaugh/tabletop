<script lang="ts">
    import type { Face } from '@tabletop/napoleons-triumph'
    import UnitFace from '$lib/components/UnitFace.svelte'
    import { BLOCK_LENGTH, BLOCK_THICKNESS } from '$lib/utils/pieceLayout.js'

    let {
        x,
        y,
        angle,
        fill,
        shade,
        ink,
        face,
        dimmed = false,
        spent = false,
        leading = false
    }: {
        x: number
        y: number
        angle: number
        fill: string
        shade: string
        ink: string
        face?: Face
        /** Left out of the order being built. */
        dimmed?: boolean
        /** Already moved this turn. */
        spent?: boolean
        /** Named as a leading unit in the attack being fought. */
        leading?: boolean
    } = $props()

    const EDGE = 3
    // Closes the slivers between stacked blocks so a stack is one unbroken target.
    const HIT_MARGIN = 2
</script>

<g transform="translate({x} {y}) rotate({angle})" opacity={dimmed ? 0.45 : 1}>
    <rect
        x={-BLOCK_LENGTH / 2}
        y={-BLOCK_THICKNESS / 2 - HIT_MARGIN}
        width={BLOCK_LENGTH}
        height={BLOCK_THICKNESS + HIT_MARGIN * 2}
        fill="transparent"
    />
    <rect
        x={-BLOCK_LENGTH / 2}
        y={-BLOCK_THICKNESS / 2}
        width={BLOCK_LENGTH}
        height={BLOCK_THICKNESS}
        rx="1.5"
        fill={shade}
    />
    <rect
        x={-BLOCK_LENGTH / 2}
        y={-BLOCK_THICKNESS / 2}
        width={BLOCK_LENGTH}
        height={BLOCK_THICKNESS - EDGE}
        rx="1.5"
        {fill}
    />
    {#if face}
        <g transform="translate(0 {-EDGE / 2})">
            <UnitFace {face} {ink} ground={fill} symbolHeight={11} symbolWidth={16} />
        </g>
    {/if}
    {#if leading}
        <path d="M{-BLOCK_LENGTH / 2 - 5} -7.5 l-12 7.5 l12 7.5 z" fill="#2b2620" />
    {/if}
    {#if spent}
        <circle cx={BLOCK_LENGTH / 2 - 8} cy={-EDGE / 2} r="3.2" fill={ink} opacity="0.85" />
    {/if}
</g>
