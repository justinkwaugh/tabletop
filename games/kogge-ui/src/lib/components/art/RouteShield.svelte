<script lang="ts">
    import { markerGood } from '@tabletop/kogge'
    import { GOOD_ART } from '$lib/utils/goodsArt.js'

    let {
        value,
        x = 0,
        y = 0,
        size = 40
    }: { value: number; x?: number; y?: number; size?: number } = $props()

    const art = $derived(GOOD_ART[markerGood(value)])
    const scale = $derived(size / 40)
</script>

<g transform="translate({x} {y}) scale({scale})">
    <path
        d="M3 3 H37 V21 C37 34 29 41.5 20 45.5 C11 41.5 3 34 3 21 Z"
        fill={art.fill}
        stroke="#9e2a22"
        stroke-width="1.6"
        stroke-linejoin="round"
    ></path>
    <path
        d="M5.5 5.5 H34.5 V21 C34.5 32 27.5 38.5 20 42 C12.5 38.5 5.5 32 5.5 21 Z"
        fill="none"
        stroke={art.light}
        stroke-opacity="0.55"
        stroke-width="0.9"
    ></path>
    <text
        x="20"
        y="30.5"
        text-anchor="middle"
        font-family="Libre Baskerville"
        font-style="italic"
        font-weight="700"
        font-size="25"
        fill={art.ink}
        stroke={art.dark}
        stroke-width="0.6"
        paint-order="stroke">{value}</text
    >
</g>
