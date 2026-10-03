<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import Pawn from '$lib/components/Pawn.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PawnCountChip, pawnCountChipWidth } from '$lib/utils/pawnCountChip.js'

    let {
        color,
        count,
        x,
        y,
        label
    }: { color: MarketColor; count: number; x: number; y: number; label: string } = $props()

    const gameSession = getGameSession()

    let palette = $derived(gameSession.marketPalettes[color])
    let width = $derived(pawnCountChipWidth(count))
    let left = $derived(-width / 2 + PawnCountChip.padding)
</script>

<g transform="translate({x} {y})" aria-label={label}>
    <rect
        x={-width / 2}
        y={-PawnCountChip.height / 2}
        {width}
        height={PawnCountChip.height}
        rx="8"
        fill="#ffffff"
        fill-opacity="0.85"
        stroke={palette.stroke}
        stroke-width="1.5"
    ></rect>
    <Pawn {color} x={left + PawnCountChip.pawnWidth / 2} y={0} size={PawnCountChip.pawnSize} />
    <text
        x={left + PawnCountChip.pawnWidth + PawnCountChip.gap}
        y="1"
        dominant-baseline="central"
        font-size="16"
        font-weight="700"
        fill={palette.stroke}>{count}</text
    >
</g>
