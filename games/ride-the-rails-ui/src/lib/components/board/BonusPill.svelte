<script lang="ts">
    import type { CityBonusMark } from '$lib/utils/boardPieces.js'
    import { BONUS_PILL, bonusPill } from '$lib/utils/cityMarks.js'

    let { bonus }: { bonus: CityBonusMark } = $props()

    const pill = $derived(bonusPill(bonus))
    const { width, height, strokeWidth, fontSize, strike } = BONUS_PILL
</script>

<!-- Art plan, Bonus pill (BOARD_LOOK.bonus 'pill'): the amount in serif on a pill, centred on the
     origin; a used $5 is grey and struck through. -->
<g aria-hidden="true" data-bonus={pill.used ? 'used' : bonus.kind}>
    <rect
        x={-width / 2}
        y={-height / 2}
        {width}
        {height}
        rx={height / 2}
        fill={pill.fill}
        stroke="var(--rtr-ink)"
        stroke-width={strokeWidth}
    ></rect>
    <text
        class="rtr-serif"
        y={fontSize * 0.35}
        font-size={fontSize}
        text-anchor="middle"
        fill={pill.ink}>{pill.text}</text
    >
    {#if pill.used}
        <path
            d="M{strike.from.x} {strike.from.y} L{strike.to.x} {strike.to.y}"
            stroke="var(--rtr-coin-used-ink)"
            stroke-width={strike.width}
            stroke-linecap="round"
        ></path>
    {/if}
</g>
