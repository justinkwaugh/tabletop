<script lang="ts">
    import { GoodsType } from '@tabletop/fresh-fish'
    import GoodsIcon from './GoodsIcon.svelte'
    import { getGoodsName } from '$lib/utils/goodsNames.js'
    import { fitGoodsIcon } from '$lib/utils/goodsIconBounds.js'
    import {
        LABEL_DARK,
        LABEL_LIGHT,
        CHALKBOARD,
        luminance,
        PAINT_DARK,
        rgbOf
    } from '$lib/utils/pieceColors.js'

    let {
        color,
        goodsType,
        showName = true,
        size = 100
    }: {
        color: string
        goodsType?: GoodsType
        /** Without the name the piece is centred, for small sizes where text beside it names it. */
        showName?: boolean
        size?: number
    } = $props()

    const SIGN_TINT = 0.25

    // A sidewalk A-frame sign board, seen from the front, with the back leaf's rail leaning
    // away behind its right edge.
    const FRONT = { left: 8, right: 82, top: 6, bottom: 70 }
    const FOOT = 80
    const RAIL = 5
    const BACK_FOOT_X = 93
    const HEADER = 11
    const SLOT = { width: 18, height: 4, inset: 3 }
    const BOARD = {
        x: FRONT.left + RAIL,
        y: FRONT.top + HEADER,
        width: FRONT.right - FRONT.left - 2 * RAIL,
        height: FRONT.bottom - RAIL - FRONT.top - HEADER
    }
    const ICON_AREA = {
        x: BOARD.x + 2,
        y: BOARD.y + 2,
        width: BOARD.width - 4,
        height: BOARD.height - 4
    }

    const id = `stall-${Math.random().toString(36).slice(2)}`
    const seed = Math.floor(Math.random() * 1000)
    const grainAngle = Math.floor(Math.random() * 40) - 20

    let name = $derived(goodsType ? getGoodsName(goodsType).toUpperCase() : '')
    // The lot is the player's own colour and the sign a lighter tint of it, so neighbouring
    // players' lots stay distinct and clear of both grass shades.
    let rgb = $derived(rgbOf(color))
    let ground = $derived(color)
    let sign = $derived(
        `rgb(${rgb.map((channel) => Math.round(channel + (255 - channel) * SIGN_TINT)).join(' ')})`
    )
    let nameColor = $derived(luminance(rgb) > 150 ? LABEL_DARK : LABEL_LIGHT)

    let boardIcon = $derived(
        goodsType ? fitGoodsIcon(goodsType, ICON_AREA, { fill: 0.86 }) : undefined
    )

    const front = `${FRONT.left},${FRONT.top} ${FRONT.right},${FRONT.top} ${FRONT.right},${FOOT} ${FRONT.right - RAIL},${FOOT} ${FRONT.right - RAIL},${FRONT.bottom} ${FRONT.left + RAIL},${FRONT.bottom} ${FRONT.left + RAIL},${FOOT} ${FRONT.left},${FOOT}`
    const backRail = `${FRONT.right - RAIL},${FRONT.top + 1} ${FRONT.right},${FRONT.top + 1} ${BACK_FOOT_X},${FOOT - 3} ${BACK_FOOT_X - RAIL},${FOOT - 3}`
</script>

<svg
    class="pointer-events-none"
    overflow="visible"
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
>
    <defs>
        <filter id="{id}-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.18" numOctaves="2" {seed}
            ></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
        </filter>
        <clipPath id="{id}-sign">
            <polygon points={front}></polygon>
        </clipPath>
    </defs>

    <!-- The ground bleeds past the square so scaled boards show no seams. -->
    <rect x="-1" y="-1" width="102" height="102" fill={ground}></rect>

    <g transform={showName ? 'translate(2 0)' : 'translate(2 8)'}>
        <polygon points={backRail} fill={sign}></polygon>
        <polygon points={backRail} fill="#000" opacity="0.45"></polygon>

        <polygon points={front} fill={sign}></polygon>
        <g clip-path="url(#{id}-sign)">
            <rect
                width="100"
                height="100"
                filter="url(#{id}-grain)"
                opacity="0.13"
                style="mix-blend-mode: multiply"
                transform="rotate({grainAngle} 50 50)"
            ></rect>
        </g>
        <rect
            x={(FRONT.left + FRONT.right - SLOT.width) / 2}
            y={FRONT.top + SLOT.inset}
            width={SLOT.width}
            height={SLOT.height}
            rx={SLOT.height / 2}
            fill={ground}
        ></rect>
        <rect x={BOARD.x} y={BOARD.y} width={BOARD.width} height={BOARD.height} fill={CHALKBOARD}
        ></rect>
        <rect
            x={BOARD.x}
            y={BOARD.y}
            width={BOARD.width}
            height={BOARD.height}
            filter="url(#{id}-grain)"
            opacity="0.08"
            style="mix-blend-mode: screen"
        ></rect>
        <polygon
            points={front}
            fill="none"
            stroke="#000"
            stroke-opacity="0.25"
            stroke-width="0.7"
            stroke-linejoin="round"
        ></polygon>

        {#if boardIcon}
            <g transform={boardIcon}>
                <GoodsIcon {goodsType} color={PAINT_DARK} painted />
            </g>
        {/if}
    </g>

    {#if showName}
        <text
            x="50"
            y="97"
            text-anchor="middle"
            font-size="22"
            font-weight="800"
            style="font-family: var(--ff-label-font, inherit)"
            letter-spacing="1"
            fill={nameColor}>{name}</text
        >
    {/if}
</svg>
