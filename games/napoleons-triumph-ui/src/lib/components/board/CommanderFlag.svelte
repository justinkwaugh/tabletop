<script lang="ts">
    import {
        BANNER_HEIGHT,
        FlagSide,
        NAME_INSET,
        STAFF_HEIGHT,
        bannerWidth,
        type FlagMark,
        type FlagView
    } from '$lib/utils/flagLayout.js'

    let { flag, view }: { flag: FlagMark; view: FlagView } = $props()

    const STRIPE = 6
    const SWALLOWTAIL = 7
    const MUTED_INK_OPACITY = 0.45
    const width = $derived(bannerWidth(flag.name))
    const flies = $derived(flag.side === FlagSide.Left ? -1 : 1)
    const bannerLeft = $derived(flag.side === FlagSide.Left ? -width : 0)
    const inkOpacity = $derived(flag.hasCommanded ? MUTED_INK_OPACITY : 1)
</script>

<g
    transform="translate({flag.at.x} {flag.at.y}) rotate({-view.rotation}) scale({view.scale})"
    class="pointer-events-none"
>
    <line x1="0" y1="0" x2="0" y2={-STAFF_HEIGHT} stroke="#3b3b3b" stroke-width="2"></line>
    <circle cx="0" cy="0" r="2.6" fill="#3b3b3b"></circle>
    <path
        d="M0 {-STAFF_HEIGHT} h{flies * width} l{-flies * SWALLOWTAIL} {BANNER_HEIGHT / 2} l{flies *
            SWALLOWTAIL} {BANNER_HEIGHT / 2} h{-flies * width} z"
        fill="#f1ecdc"
    ></path>
    <g opacity={inkOpacity}>
        <path
            d="M0 {-STAFF_HEIGHT} h{flies * STRIPE} v{BANNER_HEIGHT} h{-flies * STRIPE} z"
            fill={flag.colors.block}
        ></path>
        <g transform="translate({bannerLeft} 0)">
            <text x={NAME_INSET} y="-16.5" font-size="13" font-style="italic" fill="#2b2620"
                >{flag.name}</text
            >
            <text
                x={width - 9}
                y="-16.5"
                font-size="12"
                text-anchor="end"
                fill={flag.colors.block}
                font-weight="700">{flag.count}</text
            >
        </g>
    </g>
</g>
