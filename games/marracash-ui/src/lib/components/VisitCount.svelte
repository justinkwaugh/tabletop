<script lang="ts">
    import { getShop, type ShopVisit } from '@tabletop/marracash'
    import type { Point } from '@tabletop/common'
    import Pawn from '$lib/components/Pawn.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PawnUnitSize, PawnWidth } from '$lib/utils/pawnShape.js'

    const ChipHeight = 32
    const ChipPadding = 7
    const ChipGap = 4
    const DigitWidth = 9.5
    const PawnSize = 18
    const PawnChipWidth = (PawnWidth * PawnSize) / PawnUnitSize

    let { visit, at }: { visit: ShopVisit; at: Point } = $props()

    const gameSession = getGameSession()

    let color = $derived(getShop(visit.shopId).color)
    let palette = $derived(gameSession.marketPalettes[color])
    let width = $derived(
        2 * ChipPadding + PawnChipWidth + ChipGap + String(visit.customers).length * DigitWidth
    )
    let left = $derived(-width / 2 + ChipPadding)
</script>

<g transform="translate({at.x} {at.y})" aria-label="{visit.customers} entering shop {visit.shopId}">
    <rect
        x={-width / 2}
        y={-ChipHeight / 2}
        {width}
        height={ChipHeight}
        rx="8"
        fill="#ffffff"
        fill-opacity="0.85"
        stroke={palette.stroke}
        stroke-width="1.5"
    ></rect>
    <Pawn {color} x={left + PawnChipWidth / 2} y={0} size={PawnSize} />
    <text
        x={left + PawnChipWidth + ChipGap}
        y="1"
        dominant-baseline="central"
        font-size="16"
        font-weight="700"
        fill={palette.stroke}>{visit.customers}</text
    >
</g>
