<script lang="ts">
    import { GoodsType } from '@tabletop/fresh-fish'
    import GoodsIcon from './GoodsIcon.svelte'
    import { getGoodsName } from '$lib/utils/goodsNames.js'
    import { LABEL_LIGHT, PAINT_DARK, TRUCK_GROUND, TRUCK_WOOD } from '$lib/utils/pieceColors.js'
    import truckImg from '$lib/images/fish-truck.png'

    let { goodsType, size = 100 }: { goodsType?: GoodsType; size?: number } = $props()

    const id = `truck-${Math.random().toString(36).slice(2)}`
    const seed = Math.floor(Math.random() * 1000)

    let name = $derived(goodsType ? getGoodsName(goodsType).toUpperCase() : '')

    // The printed truck art's own outline is the stencil, so the wooden piece keeps its
    // rounded cartoon van shape exactly. The printed name below the van is cut off.
    const DEPTH = 5
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
            <g transform="translate(5 3)" mask="url(#{id}-van)">
                <rect width="100" height="100" fill="#000"></rect>
            </g>
        </g>
        {#each Array.from({ length: DEPTH }, (_, i) => DEPTH - i) as i (i)}
            <g transform="translate({i} {-i})" mask="url(#{id}-van)">
                <rect width="100" height="100" fill={TRUCK_WOOD}></rect>
                <rect width="100" height="100" fill="#000" opacity="0.3"></rect>
            </g>
        {/each}
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
        <g transform="translate(32 14) scale(2.4)" opacity="0.92">
            <GoodsIcon {goodsType} color={PAINT_DARK} />
        </g>
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
