<script lang="ts">
    import { Good } from '@tabletop/indonesia'

    type DemandEntry = {
        good: Good
        count: number
    }

    type DemandStyle = {
        fill: string
        text: string
    }

    let {
        x,
        y,
        demands,
        innerRadius = 18,
        outerRadius = 30
    }: {
        x: number
        y: number
        demands: readonly DemandEntry[]
        innerRadius?: number
        outerRadius?: number
    } = $props()

    const DEMAND_STYLE_BY_GOOD: Readonly<Record<Good, DemandStyle>> = {
        [Good.Rice]: { fill: '#e3d8c0', text: '#6c5a46' },
        [Good.Spice]: { fill: '#d5e1b1', text: '#425735' },
        [Good.SiapSaji]: { fill: '#f3eeea', text: '#6f4c5f' },
        [Good.Rubber]: { fill: '#c1bdbb', text: '#131113' },
        [Good.Oil]: { fill: '#baa8ca', text: '#23344f' }
    }

    const visibleDemands = $derived(demands.filter((entry) => entry.count > 0))
    const segmentCount = $derived(visibleDemands.length)
    const ringMidRadius = $derived((innerRadius + outerRadius) / 2)
    const ringStrokeWidth = $derived(Math.max(0, outerRadius - innerRadius))

    function segmentLabelRadius(
        startRadians: number,
        endRadians: number,
        rInner: number,
        rOuter: number
    ): number {
        const theta = Math.abs(endRadians - startRadians)
        if (theta <= 0.00001 || rOuter <= 0) {
            return ringMidRadius
        }

        const r2Diff = rOuter * rOuter - rInner * rInner
        if (r2Diff <= 0.00001) {
            return ringMidRadius
        }

        const r3Diff = rOuter * rOuter * rOuter - rInner * rInner * rInner
        const centroidAlongBisector =
            (4 * r3Diff * Math.sin(theta / 2)) / (3 * r2Diff * theta)

        return Math.max(0, Math.min(rOuter - 0.8, centroidAlongBisector))
    }

    function polarPoint(centerX: number, centerY: number, radius: number, angleRadians: number) {
        return {
            x: centerX + Math.cos(angleRadians) * radius,
            y: centerY + Math.sin(angleRadians) * radius
        }
    }

    function donutSlicePath(
        centerX: number,
        centerY: number,
        rInner: number,
        rOuter: number,
        startRadians: number,
        endRadians: number
    ): string {
        const outerStart = polarPoint(centerX, centerY, rOuter, startRadians)
        const outerEnd = polarPoint(centerX, centerY, rOuter, endRadians)
        const innerEnd = polarPoint(centerX, centerY, rInner, endRadians)
        const innerStart = polarPoint(centerX, centerY, rInner, startRadians)
        const delta = endRadians - startRadians
        const largeArcFlag = Math.abs(delta) > Math.PI ? 1 : 0

        return [
            `M ${outerStart.x} ${outerStart.y}`,
            `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
            `L ${innerEnd.x} ${innerEnd.y}`,
            `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
            'Z'
        ].join(' ')
    }

    const segments = $derived.by(() => {
        if (segmentCount === 0) {
            return []
        }
        if (segmentCount === 1) {
            const only = visibleDemands[0]
            if (!only) {
                return []
            }
            return [
                {
                    key: only.good,
                    good: only.good,
                    count: only.count,
                    start: -Math.PI / 2,
                    end: Math.PI * 1.5
                }
            ]
        }

        const step = (Math.PI * 2) / segmentCount
        const startOffset = -Math.PI / 2
        return visibleDemands.map((entry, index) => {
            const start = startOffset + step * index
            const end = start + step
            return {
                key: entry.good,
                good: entry.good,
                count: entry.count,
                start,
                end
            }
        })
    })
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    {#if segmentCount === 1}
        {@const only = segments[0]}
        {#if only}
            <circle
                cx={x}
                cy={y}
                r={ringMidRadius}
                fill="none"
                stroke={DEMAND_STYLE_BY_GOOD[only.good].fill}
                stroke-width={ringStrokeWidth}
                opacity="1"
            ></circle>
            <text
                x={x}
                y={y}
                fill={DEMAND_STYLE_BY_GOOD[only.good].text}
                stroke="#ffffff"
                stroke-width="1.2"
                paint-order="stroke fill"
                font-size="20"
                font-weight="900"
                text-anchor="middle"
                dominant-baseline="middle"
                dy="0.55"
                font-family="'Arial Black', 'Trebuchet MS', 'Verdana', sans-serif"
                font-variant-numeric="tabular-nums"
            >
                {only.count}
            </text>
        {/if}
    {:else}
        {#each segments as segment (segment.key)}
            <path
                d={donutSlicePath(x, y, innerRadius, outerRadius, segment.start, segment.end)}
                fill={DEMAND_STYLE_BY_GOOD[segment.good].fill}
                opacity="1"
            ></path>

            {@const midAngle = (segment.start + segment.end) / 2}
            {@const labelRadius = segmentLabelRadius(
                segment.start,
                segment.end,
                innerRadius,
                outerRadius
            )}
            {@const labelPosition = polarPoint(x, y, labelRadius, midAngle)}
            <text
                x={labelPosition.x}
                y={labelPosition.y}
                fill={DEMAND_STYLE_BY_GOOD[segment.good].text}
                stroke="#ffffff"
                stroke-width="1.2"
                paint-order="stroke fill"
                font-size="20"
                font-weight="900"
                text-anchor="middle"
                dominant-baseline="middle"
                dy="0.55"
                font-family="'Arial Black', 'Trebuchet MS', 'Verdana', sans-serif"
                font-variant-numeric="tabular-nums"
            >
                {segment.count}
            </text>
        {/each}
    {/if}

    <circle
        cx={x}
        cy={y}
        r={outerRadius}
        fill="none"
        stroke="#2b2620"
        stroke-width="1.45"
        opacity="1"
    ></circle>
    {#if innerRadius > 0.25}
        <circle
            cx={x}
            cy={y}
            r={innerRadius}
            fill="none"
            stroke="#2b2620"
            stroke-width="0.95"
            opacity="1"
        ></circle>
    {/if}

    {#if segmentCount > 1}
        {#each segments as segment (segment.key)}
            {@const boundary = polarPoint(x, y, outerRadius, segment.start)}
            {@const boundaryInner = polarPoint(x, y, innerRadius, segment.start)}
            <line
                x1={boundaryInner.x}
                y1={boundaryInner.y}
                x2={boundary.x}
                y2={boundary.y}
                stroke="#f5f2ea"
                stroke-width="0.7"
                opacity="0.95"
            ></line>
        {/each}
    {/if}

</g>
