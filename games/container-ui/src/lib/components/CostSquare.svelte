<script lang="ts">
    import oneDollarSvg from '$lib/images/1-dollar.svg'
    import twoDollarSvg from '$lib/images/2-dollar.svg'
    import threeDollarSvg from '$lib/images/3-dollar.svg'
    import fourDollarSvg from '$lib/images/4-dollar.svg'
    import fiveDollarSvg from '$lib/images/5-dollar.svg'
    import sixDollarSvg from '$lib/images/6-dollar.svg'

    const BG_WIDTH = 42.18
    const BG_HEIGHT = 41.94
    const STROKE = '#332626'
    const DOLLAR_INSET_X_RATIO = 0.2
    const DOLLAR_INSET_Y_RATIO = 0.2
    const DOLLAR_ASSET_BY_AMOUNT = {
        1: oneDollarSvg,
        2: twoDollarSvg,
        3: threeDollarSvg,
        4: fourDollarSvg,
        5: fiveDollarSvg,
        6: sixDollarSvg
    } as const

    let {
        x,
        y,
        width,
        amount,
        color,
        squareHeight,
        rotation = 0,
        counterMirrorX = false
    }: {
        x: number
        y: number
        width: number
        amount: 1 | 2 | 3 | 4 | 5 | 6
        color: string
        squareHeight?: number
        rotation?: number
        counterMirrorX?: boolean
    } = $props()

    const height = $derived(squareHeight ?? width * (BG_HEIGHT / BG_WIDTH))
    const dollarHref = $derived(DOLLAR_ASSET_BY_AMOUNT[amount])
    const dollarInsetX = $derived(width * DOLLAR_INSET_X_RATIO)
    const dollarInsetY = $derived(height * DOLLAR_INSET_Y_RATIO)
    const dollarWidth = $derived(width - dollarInsetX * 2)
    const dollarHeight = $derived(height - dollarInsetY * 2)
    const transform = $derived.by(() => {
        if (rotation === 0 && !counterMirrorX) {
            return `translate(${x} ${y})`
        }

        const centerX = x + width / 2
        const centerY = y + height / 2
        const rotatePart = rotation === 0 ? '' : ` rotate(${rotation})`
        const mirrorPart = counterMirrorX ? ' scale(-1 1)' : ''
        return `translate(${centerX} ${centerY})${rotatePart}${mirrorPart} translate(${-width / 2} ${-height / 2})`
    })
</script>

<g transform={transform}>
    <rect
        x="0"
        y="0"
        width={width}
        height={height}
        fill={color}
        stroke={STROKE}
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width=".5"
    ></rect>
    <image
        href={dollarHref}
        x={dollarInsetX}
        y={dollarInsetY}
        width={dollarWidth}
        height={dollarHeight}
        preserveAspectRatio="xMidYMid meet"
    ></image>
</g>
