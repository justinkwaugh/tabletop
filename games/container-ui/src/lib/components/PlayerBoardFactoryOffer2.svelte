<script lang="ts">
    import CostSquare from '$lib/components/CostSquare.svelte'

    const OFFER_WIDTH = 119.92
    const OFFER_HEIGHT = 42.13
    const STROKE = '#332626'
    const PANEL_FILL = '#c8bab8'
    const LIGHT_FILL = '#ebe3e4'
    const WHITE_FILL = '#fff'
    const COST_SQUARE_X = 78.23
    const COST_SQUARE_Y = 0.25
    const COST_SQUARE_WIDTH = 41.44
    const COST_SQUARE_HEIGHT = 41.63

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
        <g>
            <rect
                x="35.27"
                y="4.16"
                width="41.63"
                height="33.81"
                transform="translate(77.15 -35.02) rotate(90)"
                fill={PANEL_FILL}
            ></rect>
            <path
                d="M53.79,3.48c-5.41,0-9.79,4.94-9.79,11.02s4.38,11.02,9.79,11.02h15.81V3.48h-15.81Z"
                fill={LIGHT_FILL}
            ></path>
            <path
                d="M66.69,25.52c-5.41,0-9.79-4.94-9.79-11.02s4.38-11.02,9.79-11.02h-1.57c-5.41,0-9.79,4.94-9.79,11.02s4.38,11.02,9.79,11.02h1.57Z"
                fill={PANEL_FILL}
            ></path>
            <path
                d="M53.76,28.35V.25h-14.58v41.63h14.58v-13.53ZM52.71,13.24l-5.21-5.21v-.82l5.21-5.21v11.24ZM51.93,1.3l-5.15,5.15h-.86l-5.15-5.15h11.16ZM40.23,2.24l5.08,5.08v.58l-5.08,5.08V2.24ZM40.93,13.78l5.15-5.15h.54l5.15,5.15h-10.84ZM52.71,26.77l-5.21-5.21v-.82l5.21-5.21v11.24ZM51.93,14.83l-5.15,5.15h-.86l-5.15-5.15h11.16ZM40.23,15.77l5.08,5.08v.58l-5.08,5.08v-10.75ZM40.93,27.3l5.15-5.15h.54l5.15,5.15h-10.84ZM52.71,40.29l-5.21-5.21v-.82l5.21-5.21v11.24ZM51.93,28.35l-5.15,5.15h-.86l-5.15-5.15h11.16ZM40.23,29.3l5.08,5.08v.58l-5.08,5.08v-10.75ZM40.93,40.83l5.15-5.15h.54l5.15,5.15h-10.84Z"
                fill={color}
            ></path>
            <path
                d="M78.23.25h-24.47v41.63h24.47V.25ZM56.92,25.52V3.48h12.16v22.05h-12.16Z"
                fill={WHITE_FILL}
            ></path>
            <ellipse cx="69.92" cy="14.5" rx="9.79" ry="11.02" fill={WHITE_FILL}></ellipse>
            <path
                d="M56.92,29.82c0-1.03.67-1.07.67-1.07h8.62c.86,0,1.57-.7,1.57-1.57v-1.66h2.14v1.66c0,2.04-1.66,3.71-3.71,3.71h-8.62s-.67,0-.67-1.07Z"
                fill={color}
            ></path>
        </g>
        <rect
            x="-19.28"
            y="19.78"
            width="41.63"
            height="2.57"
            transform="translate(22.6 19.53) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <rect
            x="17.08"
            y="19.78"
            width="36.85"
            height="2.57"
            transform="translate(56.57 -14.44) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <path
            d="M39.18.25H2.82v41.63h36.36V.25ZM5.21,39.49V2.64h31.58v36.85H5.21Z"
            fill={WHITE_FILL}
        ></path>
        <path
            d="M20.43,8.81c-6.01,0-10.88,5.48-10.88,12.25s4.87,12.25,10.88,12.25h4.04V8.81h-4.04Z"
            fill={PANEL_FILL}
        ></path>
        <ellipse cx="23.29" cy="21.07" rx="10.88" ry="12.25" fill={PANEL_FILL}></ellipse>
        <ellipse cx="25.94" cy="21.07" rx="10.88" ry="12.25" fill={WHITE_FILL}></ellipse>
        <path
            d="M25.1,16.29c-2.1,0-3.88,2.18-3.88,4.77s1.77,4.77,3.88,4.77h4.69v-9.54h-4.69Z"
            fill={WHITE_FILL}
        ></path>
        <rect
            x="20.9"
            y="15.87"
            width="2.33"
            height="10.39"
            transform="translate(43.13 -1) rotate(90)"
            fill={WHITE_FILL}
        ></rect>
        <path
            d="M25.93,16.29v-7.48h2.27c.86,0,1.64.52,1.98,1.31l2.6,6.17h-6.84Z"
            fill={WHITE_FILL}
        ></path>
        <path
            d="M24.47,16.29v-7.48h2.27c.86,0,1.64.52,1.98,1.31l2.6,6.17h-6.84Z"
            fill={PANEL_FILL}
        ></path>
        <path
            d="M25.93,25.79v7.48s2.27,0,2.27,0c.86,0,1.64-.52,1.98-1.31l2.6-6.17h-6.84Z"
            fill={WHITE_FILL}
        ></path>
        <path
            d="M24.47,25.79v7.48s2.27,0,2.27,0c.86,0,1.64-.52,1.98-1.31l2.6-6.17h-6.84Z"
            fill={PANEL_FILL}
        ></path>
        <ellipse cx="34.41" cy="21.07" rx="5.79" ry="7.76" fill={PANEL_FILL}></ellipse>
        <ellipse cx="35.55" cy="21.07" rx="5.79" ry="7.76" fill={WHITE_FILL}></ellipse>
        <path
            d="M36.71,16.29c-2.1,0-3.88,2.18-3.88,4.77s1.77,4.77,3.88,4.77h3.01v-9.54h-3.01Z"
            fill={color}
        ></path>
        <path
            d="M35.83,21.07c0-2.59,1.78-4.77,3.89-4.77s5.03,2.18,5.03,4.77-2.92,4.77-5.03,4.77-3.89-2.18-3.89-4.77Z"
            fill={WHITE_FILL}
        ></path>
        <path
            d="M40.79,21.07c0-1.35.9-2.49,1.98-2.49s1.98,1.14,1.98,2.49-.9,2.49-1.98,2.49-1.98-1.14-1.98-2.49Z"
            fill={WHITE_FILL}
        ></path>
        <circle cx="26.92" cy="13.31" r=".76" fill={PANEL_FILL}></circle>
        <circle cx="26.92" cy="28.82" r=".76" fill={PANEL_FILL}></circle>
    </g>
</g>
