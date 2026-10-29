<script lang="ts">
    import {
        dividedTextColor,
        revenueStageFills,
        type RevenueStageColors
    } from '../colors/revenueStageColors.js'
    import DividedRect from '../colors/DividedRect.svelte'
    import type { TileAppearance } from '../tiles/tileAppearance.js'
    import TileSymbol from '../tiles/TileSymbol.svelte'
    import {
        BonusArrowValueHeight,
        bonusArrowFooterText,
        type DrawnBonusArrow
    } from './bonusArrows.js'
    let {
        arrows,
        appearance,
        revenueStageColors = {}
    }: {
        arrows: readonly DrawnBonusArrow[]
        appearance: TileAppearance
        revenueStageColors?: RevenueStageColors
    } = $props()
    // A footer's symbol sits between its words, small enough to stay within the plaque.
    const FooterSymbolScale = 0.6
    const FooterSymbolRoom = 6.5
    const PortPaper = '#cfe8f3'
</script>

<g data-map-layer="bonus-arrows" pointer-events="none">
    {#each arrows as arrow (arrow.id)}
        {@const top = -arrow.height / 2}
        {@const footer = arrow.footer}
        {@const footerSize = bonusArrowFooterText(footer).length > 16 ? 5.6 : 6.5}
        <g
            data-map-bonus-arrow={arrow.id}
            transform={`translate(${arrow.center.x} ${arrow.center.y})`}
            role="img"
            aria-label={`${arrow.heading} ${arrow.values.map((value) => `${value.label} ${value.amount}`).join(', ')} ${typeof arrow.footer === 'string' ? arrow.footer : arrow.footer.spoken}`}
        >
            <path
                d={arrow.outline}
                fill="#ffffff"
                stroke={appearance.ink}
                stroke-width="1.4"
                stroke-linejoin="round"
            ></path>
            <text
                y={top + 9}
                text-anchor="middle"
                font-size="7"
                font-weight="700"
                letter-spacing="0.4"
                fill={appearance.ink}>{arrow.heading}</text
            >
            {#each arrow.values as value, index (value.label)}
                {@const y = top + 15 + index * BonusArrowValueHeight}
                {@const fills = revenueStageFills(
                    revenueStageColors,
                    value.stage,
                    appearance.colors[value.stage] ?? appearance.paper
                )}
                <DividedRect
                    x={-26}
                    {y}
                    width={22}
                    height={12}
                    rx={3}
                    {fills}
                    stroke={appearance.ink}
                    strokeWidth={0.8}
                />
                <text
                    x="-15"
                    y={y + 6}
                    text-anchor="middle"
                    dominant-baseline="central"
                    font-size="9"
                    font-weight="700"
                    fill={dividedTextColor(fills)}>{value.amount}</text
                >
                <text
                    x="2"
                    y={y + 6}
                    dominant-baseline="central"
                    font-size="8"
                    font-weight="600"
                    fill={appearance.ink}>{value.label}</text
                >
            {/each}
            {#if typeof footer === 'string'}
                <text
                    y={arrow.height / 2 - 4}
                    text-anchor="middle"
                    font-size={footerSize}
                    font-weight="700"
                    fill={appearance.ink}>{footer}</text
                >
            {:else}
                <g font-size={footerSize} font-weight="700" fill={appearance.ink}>
                    <text x={-FooterSymbolRoom} y={arrow.height / 2 - 4} text-anchor="end"
                        >{footer.before}</text
                    >
                    <g
                        transform={`translate(0 ${arrow.height / 2 - 6}) scale(${FooterSymbolScale})`}
                    >
                        <TileSymbol symbol={footer.symbol} ink={appearance.ink} paper={PortPaper} />
                    </g>
                    <text x={FooterSymbolRoom} y={arrow.height / 2 - 4}>{footer.after}</text>
                </g>
            {/if}
        </g>
    {/each}
</g>
