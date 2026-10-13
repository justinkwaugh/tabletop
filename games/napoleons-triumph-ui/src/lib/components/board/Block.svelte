<script lang="ts">
    import type { Face } from '@tabletop/napoleons-triumph'
    import UnitFace from '$lib/components/UnitFace.svelte'
    import type { RoleMark } from '$lib/model/roleMark.js'
    import { washedOut, type ArmyColors } from '$lib/utils/armyColors.js'
    import { BLOCK_LENGTH, BLOCK_THICKNESS } from '$lib/utils/blockShape.js'
    import { faceWidth } from '$lib/utils/faceLayout.js'

    let {
        x,
        y,
        angle,
        colors,
        face,
        dimmed = false,
        moved = false,
        roleMark
    }: {
        x: number
        y: number
        angle: number
        colors: ArmyColors
        face?: Face
        dimmed?: boolean
        moved?: boolean
        roleMark?: RoleMark
    } = $props()

    const ROLE_MARK_AT = BLOCK_LENGTH / 2 - 10
    const SYMBOL_WIDTH = 16
    const STRONGEST = 3
    // A loss stands clear of both the end of the block and the symbols of the strongest unit, the same place on every block.
    const HEAVY_MARK_AT = (faceWidth(STRONGEST, SYMBOL_WIDTH) / 2 + BLOCK_LENGTH / 2) / 2
    const MOVED_DOT_AT = BLOCK_LENGTH / 2 - 8
    const LETTERLESS_ROLE_LOZENGE = 'M0 -4.6 L4.2 0 L0 4.6 L-4.2 0 Z'
    const EDGE = 3
    // Workaround: stacked blocks leave slivers between them, so each takes taps a little beyond its edges.
    const HIT_MARGIN = 2

    const paint = $derived(dimmed ? washedOut(colors) : colors)
</script>

<g transform="translate({x} {y}) rotate({angle})">
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
        fill={paint.shade}
    ></rect>
    <rect
        x={-BLOCK_LENGTH / 2}
        y={-BLOCK_THICKNESS / 2}
        width={BLOCK_LENGTH}
        height={BLOCK_THICKNESS - EDGE}
        rx="1.5"
        fill={paint.block}
    ></rect>
    {#if face}
        <g transform="translate(0 {-EDGE / 2})" data-unit-face>
            <UnitFace
                {face}
                ink={paint.ink}
                ground={paint.block}
                symbolHeight={11}
                symbolWidth={SYMBOL_WIDTH}
            />
        </g>
    {/if}
    {#if roleMark}
        <g transform="translate({roleMark.heavy ? HEAVY_MARK_AT : ROLE_MARK_AT} {-EDGE / 2})">
            {#if roleMark.letter}
                <text
                    y={roleMark.heavy ? 4.6 : 4}
                    font-size={roleMark.heavy ? 13 : 11}
                    font-weight="700"
                    text-anchor="middle"
                    fill={paint.ink}
                    stroke={roleMark.heavy ? paint.ink : undefined}
                    stroke-width="0.7"
                    class:nt-block-heavy-mark={roleMark.heavy}>{roleMark.letter}</text
                >
            {:else}
                <path d={LETTERLESS_ROLE_LOZENGE} fill={paint.ink}></path>
            {/if}
        </g>
    {/if}
    {#if moved}
        <circle cx={MOVED_DOT_AT} cy={-EDGE / 2} r="3.2" fill={paint.ink} opacity="0.85"></circle>
    {/if}
</g>

<style>
    .nt-block-heavy-mark {
        font-variant-numeric: lining-nums;
    }
</style>
