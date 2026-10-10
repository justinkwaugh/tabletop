<script lang="ts">
    import { GoodsType } from '@tabletop/fresh-fish'
    import GoodsIcon from './GoodsIcon.svelte'
    import { getGoodsName } from '$lib/utils/goodsNames.js'
    import { fitGoodsIcon } from '$lib/utils/goodsIconBounds.js'
    import { LABEL_LIGHT, PAINT_DARK, TRUCK_GROUND, TRUCK_WOOD } from '$lib/utils/pieceColors.js'
    import truckImg from '$lib/images/fish-truck.png'

    let { goodsType, size = 100 }: { goodsType?: GoodsType; size?: number } = $props()

    const id = `truck-${Math.random().toString(36).slice(2)}`
    const seed = Math.floor(Math.random() * 1000)

    let name = $derived(goodsType ? getGoodsName(goodsType).toUpperCase() : '')

    // The printed truck art's own outline is the stencil, so the wooden piece keeps its
    // rounded cartoon van shape exactly. The printed name below the van is cut off. Like the
    // discs, it is seen flat from above, so only its shadow shows its height.
    const TRUCK_ICON_EDGE = 'rgb(74 50 22 / 0.55)'
    const CARGO = { x: 28, y: 13, width: 62, height: 50 }

    // Narrow icons sit forward of the cargo box's middle, where the eye reads the van's body.
    const FORWARD_NUDGE: Partial<Record<GoodsType, number>> = {
        [GoodsType.IceCream]: -4,
        [GoodsType.Lemonade]: -4
    }

    let cargoIcon = $derived.by(() => {
        if (!goodsType) return undefined
        const fit = fitGoodsIcon(goodsType, CARGO, { fill: 0.86, maxCoverage: 0.45 })
        return `translate(${FORWARD_NUDGE[goodsType] ?? 0} 0) ${fit}`
    })
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
        <filter
            id="{id}-silhouette"
            x="0"
            y="0"
            width="100%"
            height="100%"
            color-interpolation-filters="sRGB"
        >
            <feColorMatrix
                type="matrix"
                values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.299 0.587 0.114 0 0"
            ></feColorMatrix>
            <feComponentTransfer>
                <feFuncA type="linear" slope="8" intercept="-2.2"></feFuncA>
            </feComponentTransfer>
        </filter>
        <clipPath id="{id}-vanArea"><rect x="0" y="0" width="100" height="77"></rect></clipPath>
        <mask id="{id}-van" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <g clip-path="url(#{id}-vanArea)">
                <image
                    href={truckImg}
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                    filter="url(#{id}-silhouette)"
                ></image>
            </g>
        </mask>
    </defs>

    <!-- The ground bleeds past the square so scaled boards show no seams. -->
    <rect x="-1" y="-1" width="102" height="102" fill={TRUCK_GROUND}></rect>
    <rect
        width="100"
        height="100"
        filter="url(#{id}-grain)"
        opacity="0.06"
        style="mix-blend-mode: screen"
    ></rect>

    <g transform="translate(-2 0)">
        <g filter="url(#{id}-soft)" opacity="0.5">
            <g transform="translate(2 3)" mask="url(#{id}-van)">
                <rect width="100" height="100" fill="#000"></rect>
            </g>
        </g>
        <g mask="url(#{id}-van)">
            <rect width="100" height="100" fill={TRUCK_WOOD}></rect>
            <rect
                width="100"
                height="100"
                filter="url(#{id}-grain)"
                opacity="0.13"
                style="mix-blend-mode: multiply"
            ></rect>
        </g>
        {#if cargoIcon}
            <g transform={cargoIcon}>
                <GoodsIcon {goodsType} color={PAINT_DARK} painted outline={TRUCK_ICON_EDGE} />
            </g>
        {/if}
    </g>

    <text
        x="50"
        y="97"
        text-anchor="middle"
        font-size="22"
        style="font-family: var(--ff-label-font, inherit)"
        letter-spacing="1"
        fill={LABEL_LIGHT}>{name}</text
    >
</svg>
