<script lang="ts">
    import type { CityBonusMark } from '$lib/utils/boardPieces.js'
    import { bonusCoin, COIN_FONT_SIZE, COIN_RADIUS } from '$lib/utils/cityMarks.js'

    let { bonus }: { bonus: CityBonusMark } = $props()

    const coin = $derived(bonusCoin(bonus))
    const STRIKE = { x: 14, y: 10 }
</script>

<!-- Art plan, Bonus coin (BOARD_LOOK.bonus 'coin'): the amount on a coin, centred on the origin;
     a used $5 is grey and struck through. Its shadow is an offset shape. -->
<g aria-hidden="true" data-bonus={coin.used ? 'used' : bonus.kind}>
    <circle cy="1.6" r={COIN_RADIUS} fill="var(--rtr-halo)" fill-opacity="0.18"></circle>
    <circle r={COIN_RADIUS} fill={coin.fill} stroke={coin.rim} stroke-width="2.2"></circle>
    <circle
        r={COIN_RADIUS - 3.8}
        fill="none"
        stroke="var(--rtr-station)"
        stroke-opacity="0.5"
        stroke-width="1.1"
    ></circle>
    <text
        y={COIN_FONT_SIZE * 0.35}
        font-size={COIN_FONT_SIZE}
        font-weight="900"
        letter-spacing="-0.6"
        text-anchor="middle"
        fill={coin.ink}>{coin.text}</text
    >
    {#if coin.used}
        <path
            d="M{-STRIKE.x} {STRIKE.y} L{STRIKE.x} {-STRIKE.y}"
            stroke="var(--rtr-coin-used-ink)"
            stroke-width="2.6"
            stroke-linecap="round"
        ></path>
    {/if}
</g>
