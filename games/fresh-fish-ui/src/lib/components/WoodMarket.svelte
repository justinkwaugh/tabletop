<script lang="ts">
    import { MARKET_CANVAS_DARK, MARKET_CANVAS_LIGHT, MARKET_LOT } from '$lib/utils/pieceColors.js'

    let { size = 100 }: { size?: number } = $props()

    // A flea-market booth seen from the front: a canopy with a straight valance over a stocked
    // counter, standing on its lot. Its soft edges match the faint lines on the other pieces.
    const BOOTH = {
        left: 12,
        right: 88,
        eave: 36,
        roofTop: 15,
        roofTopHalf: 9,
        ground: 91,
        counter: 19,
        pole: 4.5
    }
    const EDGE = 'rgb(0 0 0 / 0.28)'
    const EDGE_WIDTH = 0.7
    const INTERIOR = '#3c3c3c'
    const POLE = '#b5b5b5'

    const roof = `M${BOOTH.left} ${BOOTH.eave} L${50 - BOOTH.roofTopHalf} ${BOOTH.roofTop} L${50 + BOOTH.roofTopHalf} ${BOOTH.roofTop} L${BOOTH.right} ${BOOTH.eave} Z`
    const VALANCE = 6

    // A few goods of different heights, in greys so they never read as one of the four stall
    // goods.
    const counterTop = BOOTH.ground - BOOTH.counter
    const goods = [
        { x: 22, w: 8, h: 21, r: 4, fill: '#c2c2c2' },
        { x: 33, w: 15, h: 10, r: 1.5, fill: '#8f8f8f' },
        { x: 35.5, w: 10, h: 8, r: 1.5, fill: '#a9a9a9', stack: 10 },
        { x: 54, w: 20, h: 10, r: 5, fill: '#c9c9c9' }
    ].map(({ stack = 0, ...good }, i) => ({ ...good, i, y: counterTop - good.h - stack }))

    // Shrunk about its base, then moved so it sits centred in the lot.
    const SCALE = 0.794
    const scaledTop = BOOTH.ground - (BOOTH.ground - BOOTH.roofTop) * SCALE
    const shift = 50 - (scaledTop + BOOTH.ground) / 2
    const placement = `translate(0 ${shift}) translate(50 ${BOOTH.ground}) scale(${SCALE}) translate(-50 ${-BOOTH.ground})`
</script>

<svg
    class="pointer-events-none"
    overflow="visible"
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
>
    <!-- On the board the cell paints the lot past its edges, so neighbouring markets join; this
         square backs previews. -->
    <rect width="100" height="100" fill={MARKET_LOT}></rect>

    <g transform={placement} stroke={EDGE} stroke-width={EDGE_WIDTH} stroke-linejoin="round">
        <rect
            x={BOOTH.left + 2}
            y={BOOTH.eave}
            width={BOOTH.right - BOOTH.left - 4}
            height={BOOTH.ground - BOOTH.eave}
            fill={INTERIOR}
            stroke="none"
        ></rect>
        {#each goods as good (good.i)}
            <rect x={good.x} y={good.y} width={good.w} height={good.h} rx={good.r} fill={good.fill}
            ></rect>
        {/each}
        <rect
            x={BOOTH.left + 1}
            y={counterTop}
            width={BOOTH.right - BOOTH.left - 2}
            height={BOOTH.counter}
            rx="2.5"
            fill={MARKET_CANVAS_DARK}
        ></rect>
        <rect
            x={BOOTH.left + 1}
            y={counterTop}
            width={BOOTH.right - BOOTH.left - 2}
            height="4"
            rx="2"
            fill={MARKET_CANVAS_LIGHT}
        ></rect>
        {#each [BOOTH.left - 1, BOOTH.right + 1 - BOOTH.pole] as x (x)}
            <rect
                {x}
                y={BOOTH.eave}
                width={BOOTH.pole}
                height={BOOTH.ground - BOOTH.eave}
                rx={BOOTH.pole / 2}
                fill={POLE}
            ></rect>
        {/each}
        <path d={roof} fill={MARKET_CANVAS_LIGHT}></path>
        <rect
            x={BOOTH.left}
            y={BOOTH.eave}
            width={BOOTH.right - BOOTH.left}
            height={VALANCE}
            fill={MARKET_CANVAS_LIGHT}
        ></rect>
    </g>
</svg>
