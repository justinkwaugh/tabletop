<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    // The side-view locomotive's own units: it spans 16.2 wide, centred at (-0.7, 0.4).
    const SHAPE_WIDTH = 16.2
    const SHAPE_CENTER_X = -0.7
    const SHAPE_CENTER_Y = 0.4

    let {
        railroadId,
        x,
        y,
        width
    }: { railroadId: RailroadId; x: number; y: number; width: number } = $props()

    const style = $derived(railroadStyle(railroadId))
    const scale = $derived(width / SHAPE_WIDTH)
</script>

<g
    transform="translate({x - SHAPE_CENTER_X * scale} {y - SHAPE_CENTER_Y * scale}) scale({scale})"
    aria-hidden="true"
>
    <path
        d="M-8.8 3.2 L-7 0 L-7 -1.4 L2 -1.4 L2 -4.8 L7.4 -4.8 L7.4 3.2 Z"
        fill={style.fill}
        stroke={style.edge}
        stroke-width="0.8"
        stroke-linejoin="round"
    ></path>
    <rect
        x="-5.7"
        y="-4.6"
        width="2.3"
        height="3.3"
        fill={style.fill}
        stroke={style.edge}
        stroke-width="0.7"
    ></rect>
    <circle cx="-4.6" cy="3.7" r="1.7" fill={style.edge}></circle>
    <circle cx="-0.9" cy="3.7" r="1.7" fill={style.edge}></circle>
    <circle cx="4.7" cy="3.5" r="2.1" fill={style.edge}></circle>
    <text x="4.7" y="1.4" font-size="5.4" font-weight="800" text-anchor="middle" fill={style.ink}
        >{style.monogram}</text
    >
</g>
