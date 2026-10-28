<script lang="ts">
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    import type { TileAppearance } from '../tiles/tileAppearance.js'
    import { BonusArrowValueHeight, type DrawnBonusArrow } from './bonusArrows.js'
    let {
        arrows,
        appearance,
        revenueStageColors = {}
    }: {
        arrows: readonly DrawnBonusArrow[]
        appearance: TileAppearance
        revenueStageColors?: Readonly<Record<string, string>>
    } = $props()
    const stageColor = (stage: string) =>
        revenueStageColors[stage] ?? appearance.colors[stage] ?? appearance.paper
</script>

<g data-map-layer="bonus-arrows" pointer-events="none">
    {#each arrows as arrow (arrow.id)}
        {@const top = -arrow.height / 2}
        <g
            data-map-bonus-arrow={arrow.id}
            transform={`translate(${arrow.center.x} ${arrow.center.y})`}
            role="img"
            aria-label={`${arrow.heading} ${arrow.values.map((value) => `${value.label} ${value.amount}`).join(', ')} ${arrow.footer}`}
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
                {@const color = stageColor(value.stage)}
                <rect
                    x="-26"
                    {y}
                    width="22"
                    height="12"
                    rx="3"
                    fill={color}
                    stroke={appearance.ink}
                    stroke-width="0.8"
                ></rect>
                <text
                    x="-15"
                    y={y + 6}
                    text-anchor="middle"
                    dominant-baseline="central"
                    font-size="9"
                    font-weight="700"
                    fill={contrastingTextColor(color)}>{value.amount}</text
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
            <text
                y={arrow.height / 2 - 4}
                text-anchor="middle"
                font-size={arrow.footer.length > 16 ? 5.6 : 6.5}
                font-weight="700"
                fill={appearance.ink}>{arrow.footer}</text
            >
        </g>
    {/each}
</g>
