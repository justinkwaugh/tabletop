<script lang="ts">
    import { GoodsType } from '@tabletop/fresh-fish'
    import GoodsIcon from './GoodsIcon.svelte'
    import { getGoodsName } from '$lib/utils/goodsNames.js'
    import {
        isLightColor,
        LABEL_DARK,
        LABEL_LIGHT,
        luminance,
        PAINT_DARK,
        PAINT_LIGHT,
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

    const SHADE = 0.75

    const id = `stall-${Math.random().toString(36).slice(2)}`
    const seed = Math.floor(Math.random() * 1000)
    const grainAngle = Math.floor(Math.random() * 40) - 20

    let name = $derived(goodsType ? getGoodsName(goodsType).toUpperCase() : '')
    let light = $derived(isLightColor(color))
    let paint = $derived(light ? PAINT_DARK : PAINT_LIGHT)
    let groundRgb = $derived(rgbOf(color).map((channel) => Math.round(channel * SHADE)))
    let ground = $derived(`rgb(${groundRgb.join(' ')})`)
    let nameColor = $derived(luminance(groundRgb) > 150 ? LABEL_DARK : LABEL_LIGHT)

    // The goods icon centred on the counter front. Fish and cheese are wide and flat, so they
    // draw larger; the cheese wedge and gelato cone sit low in their boxes, so they move up.
    let counterIcon = $derived.by(() => {
        const scale = goodsType === GoodsType.Fish || goodsType === GoodsType.Cheese ? 1.85 : 1.5
        const dy = goodsType === GoodsType.Cheese ? -3 : goodsType === GoodsType.IceCream ? -2 : 0
        return `translate(50 ${65 + dy}) scale(${scale}) translate(-10 -10)`
    })

    // Alternate awning stripes: a pale tint of the player's colour, or on light colours
    // (yellow), a deeper shade, since a paler stripe would wash out.
    let softStripe = $derived.by(() => {
        const [r, g, b] = rgbOf(color)
        if (light)
            return `rgb(${Math.round(r * 0.78)} ${Math.round(g * 0.72)} ${Math.round(b * 0.6)})`
        const [cr, cg, cb] = rgbOf(PAINT_LIGHT)
        const mix = (a: number, c: number) => Math.round(a * 0.45 + c * 0.55)
        return `rgb(${mix(r, cr)} ${mix(g, cg)} ${mix(b, cb)})`
    })

    const DEPTH = { x: 7, y: -5 }
    const COUNTER = { left: 22, right: 78, top: 48, bottom: 80 }
    const POST = 3.5
    const CANOPY = { left: 19, right: 81, front: 25, back: 17, valance: 5 }
    const STRIPES = 7
    const stripeWidth = (CANOPY.right - CANOPY.left) / STRIPES
    const stripes = Array.from({ length: STRIPES }, (_, k) => {
        const x0 = CANOPY.left + k * stripeWidth
        const x1 = x0 + stripeWidth
        const bottom = CANOPY.front + CANOPY.valance
        return {
            k,
            roof: `${x0},${CANOPY.front} ${x1},${CANOPY.front} ${x1 + DEPTH.x},${CANOPY.back + DEPTH.y} ${x0 + DEPTH.x},${CANOPY.back + DEPTH.y}`,
            valance: `M${x0} ${CANOPY.front} H${x1} V${bottom} A${stripeWidth / 2} ${stripeWidth / 2.6} 0 0 1 ${x0} ${bottom} Z`
        }
    })
    const canopyRoof = `${CANOPY.left},${CANOPY.front} ${CANOPY.right},${CANOPY.front} ${CANOPY.right + DEPTH.x},${CANOPY.back + DEPTH.y} ${CANOPY.left + DEPTH.x},${CANOPY.back + DEPTH.y}`
    const canopySide = `${CANOPY.right},${CANOPY.front} ${CANOPY.right + DEPTH.x},${CANOPY.back + DEPTH.y} ${CANOPY.right + DEPTH.x},${CANOPY.back + DEPTH.y + CANOPY.valance} ${CANOPY.right},${CANOPY.front + CANOPY.valance}`
    const counterFront = `${COUNTER.left},${COUNTER.top} ${COUNTER.right},${COUNTER.top} ${COUNTER.right},${COUNTER.bottom} ${COUNTER.left},${COUNTER.bottom}`
    const counterTop = `${COUNTER.left},${COUNTER.top} ${COUNTER.right},${COUNTER.top} ${COUNTER.right + DEPTH.x},${COUNTER.top + DEPTH.y} ${COUNTER.left + DEPTH.x},${COUNTER.top + DEPTH.y}`
    const counterSide = `${COUNTER.right},${COUNTER.top} ${COUNTER.right + DEPTH.x},${COUNTER.top + DEPTH.y} ${COUNTER.right + DEPTH.x},${COUNTER.bottom + DEPTH.y} ${COUNTER.right},${COUNTER.bottom}`
    const frontPosts = [COUNTER.left, COUNTER.right - POST].map((x) => ({
        x,
        y: CANOPY.front,
        h: COUNTER.top - CANOPY.front
    }))
    const backPosts = [COUNTER.left, COUNTER.right - POST].map((x) => ({
        x: x + DEPTH.x,
        y: CANOPY.back + DEPTH.y,
        h: COUNTER.top - CANOPY.back
    }))
    const backBoard = `${COUNTER.left + DEPTH.x},${CANOPY.back + DEPTH.y} ${COUNTER.right + DEPTH.x},${CANOPY.back + DEPTH.y} ${COUNTER.right + DEPTH.x},${COUNTER.top + DEPTH.y} ${COUNTER.left + DEPTH.x},${COUNTER.top + DEPTH.y}`
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
        <filter id="{id}-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3"></feGaussianBlur>
        </filter>
        <clipPath id="{id}-booth">
            <polygon points={canopyRoof}></polygon>
            <polygon points={canopySide}></polygon>
            <polygon points={counterFront}></polygon>
            <polygon points={counterTop}></polygon>
            <polygon points={counterSide}></polygon>
            {#each [...frontPosts, ...backPosts] as post (post.x)}
                <rect x={post.x} y={post.y} width={POST} height={post.h}></rect>
            {/each}
        </clipPath>
    </defs>

    <!-- The ground bleeds past the square so scaled boards show no seams. -->
    <rect x="-1" y="-1" width="102" height="102" fill={ground}></rect>

    <g transform={showName ? 'translate(-3 -7)' : 'translate(-3 3)'}>
        <g filter="url(#{id}-soft)" opacity="0.45">
            <polygon points="22,80 78,80 90,73 88,60 34,60" fill="#000"></polygon>
        </g>

        <polygon points={backBoard} fill={color}></polygon>
        <polygon points={backBoard} fill="#000" opacity="0.5"></polygon>
        {#each backPosts as post (post.x)}
            <rect x={post.x} y={post.y} width={POST} height={post.h} fill={color}></rect>
            <rect x={post.x} y={post.y} width={POST} height={post.h} fill="#000" opacity="0.35"
            ></rect>
        {/each}

        <polygon points={counterSide} fill={color}></polygon>
        <polygon points={counterSide} fill="#000" opacity="0.38"></polygon>
        <polygon points={counterTop} fill={color}></polygon>
        <polygon points={counterTop} fill="#fff" opacity="0.12"></polygon>
        <polygon points={counterFront} fill={color}></polygon>

        {#each frontPosts as post (post.x)}
            <rect x={post.x} y={post.y} width={POST} height={post.h} fill={color}></rect>
            <rect
                x={post.x + POST - 1}
                y={post.y}
                width="1"
                height={post.h}
                fill="#000"
                opacity="0.3"
            ></rect>
        {/each}

        <polygon points={canopySide} fill={color}></polygon>
        <polygon points={canopySide} fill="#000" opacity="0.4"></polygon>
        {#each stripes as stripe (stripe.k)}
            <polygon points={stripe.roof} fill={stripe.k % 2 ? softStripe : color}></polygon>
        {/each}
        <polygon points={canopyRoof} fill="#fff" opacity="0.1"></polygon>
        {#each stripes as stripe (stripe.k)}
            <path d={stripe.valance} fill={stripe.k % 2 ? softStripe : color}></path>
        {/each}

        <g clip-path="url(#{id}-booth)">
            <rect
                width="100"
                height="100"
                filter="url(#{id}-grain)"
                opacity="0.13"
                style="mix-blend-mode: multiply"
                transform="rotate({grainAngle} 50 50)"
            ></rect>
        </g>
        <g
            fill="none"
            stroke="#000"
            stroke-opacity="0.28"
            stroke-width="0.7"
            stroke-linejoin="round"
        >
            <polygon points={counterFront}></polygon>
            <polygon points={counterSide}></polygon>
            <polygon points={canopyRoof}></polygon>
        </g>

        <g transform={counterIcon} opacity="0.92">
            <GoodsIcon {goodsType} color={paint} />
        </g>
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
