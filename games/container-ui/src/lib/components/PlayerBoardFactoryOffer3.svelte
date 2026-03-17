<script lang="ts">
    import CostSquare from '$lib/components/CostSquare.svelte'

    const OFFER_WIDTH = 120.05
    const OFFER_HEIGHT = 42.08
    const STROKE = '#332626'
    const LIGHT_FILL = '#ebe3e4'
    const WHITE_FILL = '#fff'
    const DARK_FILL = '#332626'
    const PANEL_FILL = '#b2928e'
    const DEEP_FILL = '#69504d'
    const COST_SQUARE_X = 78.36
    const COST_SQUARE_Y = 0.25
    const COST_SQUARE_WIDTH = 41.44
    const COST_SQUARE_HEIGHT = 41.58

    let {
        x,
        y,
        width,
        color,
        amount,
        costSquareRotation = 0
    }: {
        x: number
        y: number
        width: number
        color: string
        amount: 1 | 2 | 3 | 4
        costSquareRotation?: number
    } = $props()

    const height = $derived(width * (OFFER_HEIGHT / OFFER_WIDTH))
</script>

<g transform={`translate(${x} ${y}) scale(${width / OFFER_WIDTH} ${height / OFFER_HEIGHT})`}>
    <CostSquare
        x={COST_SQUARE_X}
        y={COST_SQUARE_Y}
        width={COST_SQUARE_WIDTH}
        squareHeight={COST_SQUARE_HEIGHT}
        amount={amount}
        color={color}
        rotation={costSquareRotation}
    />
    <g stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5">
        <rect x="2.85" y=".25" width="18.46" height="41.58" fill={LIGHT_FILL}></rect>
        <rect x="2.85" y=".25" width="1.78" height="16.37" fill={color}></rect>
        <rect x="2.85" y="25.46" width="1.78" height="16.37" fill={color}></rect>
        <rect x="21.31" y=".25" width="20.43" height="41.58" fill={WHITE_FILL}></rect>
        <rect
            x="-1.98"
            y="18.85"
            width="8.84"
            height="4.38"
            transform="translate(23.48 18.6) rotate(90)"
            fill={LIGHT_FILL}
        ></rect>
        <rect
            x="6.95"
            y="14.3"
            width="8.84"
            height="13.48"
            transform="translate(32.41 9.67) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <rect
            x="7.48"
            y="14.92"
            width="6.56"
            height="12.23"
            transform="translate(31.8 10.28) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <rect x="41.24" y=".25" width="16.67" height="41.58" fill={LIGHT_FILL}></rect>
        <rect x="57.92" y=".25" width="20.43" height="41.58" fill={WHITE_FILL}></rect>
        <g>
            <path
                d="M51.72,33.51v-3.48h4.09v-2.92h-13.8v2.92h6.79v3.48h-6.79v2.92h7.32c1.32,0,2.39-1.07,2.39-2.39v-.53Z"
                fill={WHITE_FILL}
            ></path>
            <path
                d="M49.17,33.51v-3.48h4.09v-2.92h-13.8v2.92h6.79v3.48h-6.79v2.92h7.32c1.32,0,2.39-1.07,2.39-2.39v-.53Z"
                fill={LIGHT_FILL}
            ></path>
            <path
                d="M51.72,8.56v3.48s4.09,0,4.09,0v2.92h-13.8v-2.92h6.79s0-3.48,0-3.48h-6.79v-2.92h6.79s.53,0,.53,0c1.32,0,2.39,1.07,2.39,2.39v.53Z"
                fill={WHITE_FILL}
            ></path>
            <path
                d="M49.17,8.56v3.48s4.09,0,4.09,0v2.92h-13.8v-2.92h6.79s0-3.48,0-3.48h-6.79v-2.92h6.79s.53,0,.53,0c1.32,0,2.39,1.07,2.39,2.39v.53Z"
                fill={LIGHT_FILL}
            ></path>
            <polygon points="42.93 14.29 42.93 3.96 41.24 3.96 41.24 38.12 42.93 38.12 42.93 14.29" fill={LIGHT_FILL}></polygon>
            <polygon
                points="46.78 36.43 44.61 36.43 44.61 5.65 46.78 5.65 46.78 3.96 42.93 3.96 42.93 38.12 46.78 38.12 46.78 36.43"
                fill={WHITE_FILL}
            ></polygon>
        </g>
        <rect
            x="71.98"
            y="6.75"
            width="6.69"
            height="1.98"
            transform="translate(83.07 -67.58) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <rect
            x="76.16"
            y="4.56"
            width="6.69"
            height="6.37"
            transform="translate(87.24 -71.76) rotate(90)"
            fill={LIGHT_FILL}
        ></rect>
        <ellipse cx="79.71" cy="7.74" rx="1.62" ry="1.87" fill={DEEP_FILL}></ellipse>
        <ellipse cx="79.71" cy="7.74" rx=".47" ry=".58" fill={DARK_FILL}></ellipse>
        <rect
            x="71.98"
            y="15.7"
            width="6.69"
            height="1.98"
            transform="translate(92.02 -58.64) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <rect
            x="76.16"
            y="13.5"
            width="6.69"
            height="6.37"
            transform="translate(96.19 -62.81) rotate(90)"
            fill={LIGHT_FILL}
        ></rect>
        <ellipse cx="79.71" cy="16.69" rx="1.62" ry="1.87" fill={DEEP_FILL}></ellipse>
        <ellipse cx="79.71" cy="16.69" rx=".47" ry=".58" fill={DARK_FILL}></ellipse>
        <path
            d="M63.36,38.5v-2.53h12.72c.32,0,.58-.26.58-.58v-5.47h2.53v5.47c0,1.71-1.39,3.1-3.1,3.1h-12.72Z"
            fill={PANEL_FILL}
        ></path>
        <path
            d="M66.94,38.5v-2.53h10.49c.32,0,.58-.26.58-.58v-5.47h2.53v5.47c0,1.71-1.39,3.1-3.1,3.1h-10.49Z"
            fill={LIGHT_FILL}
        ></path>
        <rect
            x="61.93"
            y="31.12"
            width="8.57"
            height="6.2"
            transform="translate(100.43 -32) rotate(90)"
            fill={LIGHT_FILL}
        ></rect>
        <rect
            x="58.29"
            y="33.43"
            width="8.57"
            height="1.57"
            transform="translate(96.79 -28.36) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <rect
            x="62.87"
            y="13.59"
            width="6.69"
            height="6.2"
            transform="translate(82.9 -49.52) rotate(90)"
            fill={LIGHT_FILL}
        ></rect>
        <rect
            x="59.23"
            y="15.91"
            width="6.69"
            height="1.57"
            transform="translate(79.26 -45.88) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <rect
            x="76.15"
            y="23.39"
            width="6.88"
            height="6.2"
            transform="translate(106.08 -53.1) rotate(90)"
            fill={LIGHT_FILL}
        ></rect>
        <rect
            x="71.98"
            y="25.4"
            width="6.88"
            height="2.17"
            transform="translate(101.91 -48.94) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <rect
            x="62.5"
            y="3.69"
            width="8.95"
            height="10.37"
            transform="translate(75.85 -58.11) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <rect
            x="58.1"
            y="8.09"
            width="8.95"
            height="1.57"
            transform="translate(71.45 -53.7) rotate(90)"
            fill={DEEP_FILL}
        ></rect>
    </g>
</g>
