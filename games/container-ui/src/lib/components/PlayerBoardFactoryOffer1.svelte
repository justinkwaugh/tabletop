<script lang="ts">
    import CostSquare from '$lib/components/CostSquare.svelte'

    const OFFER_WIDTH = 116.83
    const OFFER_HEIGHT = 42.18
    const STROKE = '#332626'
    const PANEL_FILL = '#c8bab8'
    const LIGHT_FILL = '#ebe3e4'
    const WHITE_FILL = '#fff'
    const DARK_FILL = '#69504d'
    const BLACK_FILL = '#332626'
    const BEIGE_FILL = '#b2928e'
    const GREEN_FILL = '#c2c92f'
    const COST_SQUARE_X = 75.13
    const COST_SQUARE_Y = 0.25
    const COST_SQUARE_WIDTH = 41.44
    const COST_SQUARE_HEIGHT = 41.68

    let {
        x,
        y,
        width,
        color,
        amount,
        costSquareRotation = 0,
        costSquareCounterMirror = false
    }: {
        x: number
        y: number
        width: number
        color: string
        amount: 1 | 2 | 3 | 4
        costSquareRotation?: number
        costSquareCounterMirror?: boolean
    } = $props()

    const height = $derived(width * (OFFER_HEIGHT / OFFER_WIDTH))
</script>

<g transform={`translate(${x} ${y}) scale(${width / OFFER_WIDTH} ${height / OFFER_HEIGHT})`}>
    <g>
        <g>
            <path d="M39.07.43H7.37v15.29h31.69V.43Z" fill={LIGHT_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></path>
            <polygon points="23.82 5.48 18.76 10.53 15.69 10.53 20.75 5.48 23.82 5.48" fill={WHITE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></polygon>
            <polygon points="20.75 5.48 30.27 5.48 30.27 .43 18.66 .43 13.6 5.48 3.82 5.48 3.82 10.53 15.69 10.53 20.75 5.48" fill={PANEL_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></polygon>
            <rect x="25.6" y=".81" width="5.05" height="4.3" transform="translate(31.07 -25.17) rotate(90)" fill={WHITE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
            <rect x="-.5" y="21.26" width="26.21" height="15.13" transform="translate(41.43 16.22) rotate(90)" fill={LIGHT_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
            <polygon points="39.07 .43 30.27 .43 30.27 15.72 17.01 15.72 17.01 41.93 30.27 41.93 39.07 41.93 39.07 .43" fill={WHITE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></polygon>
            <polygon points="18.44 17.15 31.7 17.15 31.7 1.86 37.64 1.86 37.64 40.5 18.44 40.5 18.44 17.15" fill={LIGHT_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></polygon>
            <path d="M4.12,15.72h4.68c1.93,0,3.5,1.57,3.5,3.5v11.37c0,.54.44.98.97.98h6.89v2.52h-6.89c-1.93,0-3.5-1.57-3.5-3.5v-11.37c0-.54-.44-.97-.97-.97h-4.68v-2.52Z" fill={WHITE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></path>
            <path d="M.25,15.72h6.27c1.93,0,3.5,1.57,3.5,3.5v11.37c0,.54.44.98.97.98h7.31v2.52h-7.31c-1.93,0-3.5-1.57-3.5-3.5v-11.37c0-.54-.44-.97-.97-.97H.25v-2.52Z" fill={LIGHT_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></path>
            <rect x="17.97" y="23.19" width="2.52" height="1.86" transform="translate(43.36 4.89) rotate(90)" fill={WHITE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
            <rect x="12.93" y="20.01" width="2.52" height="8.23" transform="translate(38.31 9.94) rotate(90)" fill={LIGHT_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
            <rect x="21.01" y="23.14" width="6.67" height="1.98" transform="translate(48.48 -.22) rotate(90)" fill={BEIGE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
            <rect x="25.18" y="20.95" width="6.67" height="6.36" transform="translate(52.64 -4.39) rotate(90)" fill={LIGHT_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
            <ellipse cx="28.73" cy="24.13" rx="1.62" ry="1.87" fill={DARK_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></ellipse>
            <ellipse cx="28.73" cy="24.13" rx=".47" ry=".58" fill={BLACK_FILL}></ellipse>
            <rect x="21.01" y="31.97" width="6.67" height="1.98" transform="translate(57.3 8.61) rotate(90)" fill={BEIGE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
            <rect x="25.18" y="29.77" width="6.67" height="6.36" transform="translate(61.47 4.44) rotate(90)" fill={LIGHT_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
            <ellipse cx="28.73" cy="32.96" rx="1.62" ry="1.87" fill={DARK_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></ellipse>
            <ellipse cx="28.73" cy="32.96" rx=".47" ry=".58" fill={BLACK_FILL}></ellipse>
        </g>
        <g>
            <rect x="36.85" y="16.56" width="41.6" height="9.14" transform="translate(78.79 -36.52) rotate(90)" fill={WHITE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
            <path d="M58.22,16.69c-1.69,0-3.06,1.54-3.06,3.45s1.37,3.45,3.06,3.45h6.33v-6.9h-6.33Z" fill={LIGHT_FILL}></path>
            <path d="M60.33,16.69c-1.69,0-3.06,1.54-3.06,3.45s1.37,3.45,3.06,3.45h6.33v-6.9h-6.33Z" fill={BEIGE_FILL}></path>
            <path d="M58.22,16.69c-1.69,0-3.06,1.54-3.06,3.45s1.37,3.45,3.06,3.45h6.33v-6.9h-6.33Z" fill="none" stroke={STROKE} stroke-miterlimit="10" stroke-width=".5"></path>
            <path d="M58.22,32.65c-1.69,0-3.06,1.54-3.06,3.45s1.37,3.45,3.06,3.45h6.33v-6.9h-6.33Z" fill={LIGHT_FILL}></path>
            <path d="M60.33,32.65c-1.69,0-3.06,1.54-3.06,3.45s1.37,3.45,3.06,3.45h6.33v-6.9h-6.33Z" fill={BEIGE_FILL}></path>
            <path d="M58.22,32.65c-1.69,0-3.06,1.54-3.06,3.45s1.37,3.45,3.06,3.45h6.33v-6.9h-6.33Z" fill="none" stroke={STROKE} stroke-miterlimit="10" stroke-width=".5"></path>
            <polygon points="74.47 14.86 64.09 14.86 62.63 11.99 58.86 11.99 58.86 41.93 74.47 41.93 74.47 14.86" fill={PANEL_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></polygon>
            <rect x="26.3" y="15.15" width="41.6" height="11.97" transform="translate(68.23 -25.96) rotate(90)" fill={PANEL_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
            <g>
                <rect x="61" y="17.25" width="9.2" height="5.72" fill={BEIGE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
                <line x1="66.3" y1="22.97" x2="66.3" y2="17.31" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="65" y1="22.97" x2="65" y2="17.31" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="63.69" y1="22.97" x2="63.69" y2="17.31" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="62.39" y1="22.97" x2="62.39" y2="17.31" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="67.6" y1="22.97" x2="67.6" y2="17.31" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="68.9" y1="22.97" x2="68.9" y2="17.31" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="70.21" y1="22.97" x2="70.21" y2="17.31" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
            </g>
            <g>
                <rect x="61" y="33.24" width="9.2" height="5.72" fill={BEIGE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
                <line x1="66.3" y1="38.96" x2="66.3" y2="33.3" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="65" y1="38.96" x2="65" y2="33.3" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="63.69" y1="38.96" x2="63.69" y2="33.3" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="62.39" y1="38.96" x2="62.39" y2="33.3" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="67.6" y1="38.96" x2="67.6" y2="33.3" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="68.9" y1="38.96" x2="68.9" y2="33.3" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
                <line x1="70.21" y1="38.96" x2="70.21" y2="33.3" fill="none" stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></line>
            </g>
            <rect x="60.12" y="26.92" width="27.07" height="2.97" transform="translate(102.05 -45.25) rotate(90)" fill={WHITE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></rect>
            <path d="M39.13,28.02c-.46,0-.84.42-.84.94s.37.94.84.94h31.18c1.03,0,1.86-.83,1.86-1.86l-33.04-.02Z" fill={color} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></path>
            <path d="M39.13,26.14c-.46,0-.84.42-.84.94s.37.94.84.94h33.43v-1.88h-33.43Z" fill={color} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></path>
            <ellipse cx="72.56" cy="27.08" rx=".76" ry=".96" fill={PANEL_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></ellipse>
            <polygon points="69.91 11.99 71.37 14.86 64.09 14.86 62.63 11.99 69.91 11.99" fill={WHITE_FILL} stroke={STROKE} stroke-linecap="round" stroke-linejoin="round" stroke-width=".5"></polygon>
            <g>
                <path d="M57.34,25.01c.73.79.73,2.66.73,2.66h-.82" fill={GREEN_FILL}></path>
                <path d="M57.52,24.84c.65.83.71,1.83.75,2.83,0,.12-.09.21-.21.21-.41-.02-1.07.2-1.09-.2,0-.15.12-.27.26-.26,0,0,.82.04.82.04l-.21.21c-.02-.44-.07-.91-.18-1.34-.1-.44-.27-.87-.53-1.16-.23-.24.17-.59.38-.33h0Z" fill={BLACK_FILL}></path>
            </g>
            <g>
                <path d="M57.34,22.36c.73.79.73,2.66.73,2.66h-.82" fill={GREEN_FILL}></path>
                <path d="M57.52,22.19c.65.83.71,1.83.75,2.83,0,.12-.09.21-.21.21-.41-.02-1.07.2-1.09-.2-.01-.43.68-.2,1.09-.22,0,0-.21.21-.21.21-.02-.44-.07-.91-.18-1.34-.1-.44-.27-.87-.53-1.16-.23-.24.17-.59.38-.33h0Z" fill={BLACK_FILL}></path>
            </g>
        </g>
    </g>
    <CostSquare
        x={COST_SQUARE_X}
        y={COST_SQUARE_Y}
        width={COST_SQUARE_WIDTH}
        squareHeight={COST_SQUARE_HEIGHT}
        amount={amount}
        color={color}
        rotation={costSquareRotation}
        counterMirrorX={costSquareCounterMirror}
    />
</g>
