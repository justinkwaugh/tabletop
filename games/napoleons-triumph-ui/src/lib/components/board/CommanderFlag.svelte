<script lang="ts">
    import UnitSymbol from '$lib/components/UnitSymbol.svelte'
    import {
        BANNER_HEIGHT,
        FlagSide,
        NAME_INSET,
        STAFF_HEIGHT,
        TALLY_WIDTH,
        bannerWidth,
        nameWidth,
        type FlagMark,
        type FlagView
    } from '$lib/utils/flagLayout.js'

    let { flag, view }: { flag: FlagMark; view: FlagView } = $props()

    const STRIPE = 6
    const SWALLOWTAIL = 7
    const TALLY_SYMBOL = { width: 12, height: 9, top: -4.5, lineWidth: 1.2, dotRadius: 2 }
    const MUTED_INK_OPACITY = 0.45
    const width = $derived(bannerWidth(flag.name, flag.tallies.length))
    const talliesAt = $derived(nameWidth(flag.name))
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
            {#each flag.tallies as tally, index (tally.type)}
                <g transform="translate({talliesAt + index * TALLY_WIDTH} -21)">
                    <UnitSymbol type={tally.type} ink={flag.colors.block} {...TALLY_SYMBOL} />
                    <text x="15" y="4.5" font-size="12" font-weight="700" fill={flag.colors.block}
                        >{tally.count}</text
                    >
                </g>
            {/each}
            {#if flag.tallies.length === 0}
                <text
                    x={width - 9}
                    y="-16.5"
                    font-size="12"
                    text-anchor="end"
                    fill={flag.colors.block}
                    font-weight="700">{flag.count}</text
                >
            {/if}
        </g>
    </g>
</g>
