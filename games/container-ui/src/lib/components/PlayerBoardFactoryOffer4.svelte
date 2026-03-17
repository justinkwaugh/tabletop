<script lang="ts">
    import CostSquare from '$lib/components/CostSquare.svelte'

    const OFFER_WIDTH = 115.92
    const OFFER_HEIGHT = 42.02
    const STROKE = '#332626'
    const PANEL_FILL = '#c8bab8'
    const LIGHT_FILL = '#ebe3e4'
    const WHITE_FILL = '#fff'
    const COST_SQUARE_X = 74.23
    const COST_SQUARE_Y = 0.25
    const COST_SQUARE_WIDTH = 41.44
    const COST_SQUARE_HEIGHT = 41.52

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
    <rect
        x="50.92"
        y="19.73"
        width="41.52"
        height="2.56"
        transform="translate(92.7 -50.67) rotate(90)"
        fill={PANEL_FILL}
        stroke={STROKE}
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width=".5"
    ></rect>
    <g stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5">
        <rect
            x="-19.23"
            y="19.73"
            width="41.52"
            height="2.56"
            transform="translate(22.54 19.48) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <rect
            x="15.96"
            y="19.73"
            width="41.52"
            height="2.56"
            transform="translate(57.73 -15.71) rotate(90)"
            fill={PANEL_FILL}
        ></rect>
        <path
            d="M75.13.25H2.81v41.52h72.32V.25ZM5.2,39.39V2.63h32.69v36.76H5.2ZM40.31,2.63h32.44v36.76h-32.44V2.63Z"
            fill={WHITE_FILL}
        ></path>
    </g>
    <g stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5">
        <g>
            <path
                d="M54.31,8.35c-6.63,0-12,5.89-12,13.17s5.37,13.17,12,13.17h1.6V8.35h-1.6Z"
                fill={color}
            ></path>
            <ellipse cx="55.91" cy="21.52" rx="12" ry="13.17" fill={color}></ellipse>
            <path
                d="M55.91,9.65c-5.82,0-10.54,5.31-10.54,11.87s4.72,11.87,10.54,11.87h12.02V9.65h-12.02Z"
                fill={LIGHT_FILL}
            ></path>
            <ellipse cx="67.93" cy="21.52" rx="10.54" ry="11.87" fill={WHITE_FILL}></ellipse>
            <path
                d="M63.14,33.38c-5.82,0-10.54-5.31-10.54-11.87s4.72-11.87,10.54-11.87h1.08c-5.82,0-10.54,5.31-10.54,11.87s4.72,11.87,10.54,11.87h-1.08Z"
                fill={PANEL_FILL}
            ></path>
            <ellipse cx="68.05" cy="21.52" rx="3.49" ry="4.02" fill={WHITE_FILL}></ellipse>
            <ellipse cx="68.05" cy="21.52" rx="2.38" ry="2.94" fill={WHITE_FILL}></ellipse>
            <line x1="65.88" y1="22.72" x2="65.03" y2="23.19" fill="none"></line>
            <line x1="71.07" y1="19.84" x2="70.22" y2="20.31" fill="none"></line>
            <line x1="65.88" y1="20.31" x2="65.03" y2="19.84" fill="none"></line>
            <line x1="71.07" y1="23.19" x2="70.22" y2="22.72" fill="none"></line>
            <line x1="67.04" y1="18.85" x2="66.66" y2="17.86" fill="none"></line>
            <line x1="69.45" y1="25.2" x2="69.1" y2="24.27" fill="none"></line>
            <line x1="66.99" y1="24.27" x2="66.64" y2="25.2" fill="none"></line>
            <line x1="69.42" y1="17.86" x2="69.05" y2="18.85" fill="none"></line>
        </g>
        <g>
            <path
                d="M20,8.35c-6.63,0-12,5.89-12,13.17s5.37,13.17,12,13.17h1.6V8.35h-1.6Z"
                fill={color}
            ></path>
            <ellipse cx="21.6" cy="21.52" rx="12" ry="13.17" fill={color}></ellipse>
            <path
                d="M21.6,9.65c-5.82,0-10.54,5.31-10.54,11.87s4.72,11.87,10.54,11.87h12.02V9.65h-12.02Z"
                fill={LIGHT_FILL}
            ></path>
            <ellipse cx="33.61" cy="21.52" rx="10.54" ry="11.87" fill={WHITE_FILL}></ellipse>
            <path
                d="M28.82,33.38c-5.82,0-10.54-5.31-10.54-11.87s4.72-11.87,10.54-11.87h1.08c-5.82,0-10.54,5.31-10.54,11.87s4.72,11.87,10.54,11.87h-1.08Z"
                fill={PANEL_FILL}
            ></path>
            <ellipse cx="33.73" cy="21.52" rx="3.49" ry="4.02" fill={WHITE_FILL}></ellipse>
            <ellipse cx="33.73" cy="21.52" rx="2.38" ry="2.94" fill={WHITE_FILL}></ellipse>
            <line x1="31.56" y1="22.72" x2="30.71" y2="23.19" fill="none"></line>
            <line x1="36.76" y1="19.84" x2="35.91" y2="20.31" fill="none"></line>
            <line x1="31.56" y1="20.31" x2="30.71" y2="19.84" fill="none"></line>
            <line x1="36.76" y1="23.19" x2="35.91" y2="22.72" fill="none"></line>
            <line x1="32.72" y1="18.85" x2="32.35" y2="17.86" fill="none"></line>
            <line x1="35.13" y1="25.2" x2="34.78" y2="24.27" fill="none"></line>
            <line x1="32.68" y1="24.27" x2="32.32" y2="25.2" fill="none"></line>
            <line x1="35.11" y1="17.86" x2="34.73" y2="18.85" fill="none"></line>
        </g>
        <path
            d="M69.24,21.58c0,.83-.67,1.5-1.5,1.5h-34.05c-.62,0-1.15-.68-1.15-1.5s.53-1.5,1.15-1.5h34.05c.83,0,1.5.67,1.5,1.5h0Z"
            fill={PANEL_FILL}
        ></path>
    </g>
</g>
