<script lang="ts">
    import OilMarker from '$lib/components/OilMarker.svelte'
    import RiceMarker from '$lib/components/RiceMarker.svelte'
    import RubberMarker from '$lib/components/RubberMarker.svelte'
    import SiapSajiMarker from '$lib/components/SiapSajiMarker.svelte'
    import SpiceMarker from '$lib/components/SpiceMarker.svelte'
    import { Good } from '@tabletop/indonesia'

    type DemandGood = Good

    type DemandEntry = {
        good: DemandGood
        count: number
    }

    type DemandStyle = {
        fill: string
        stroke: string
        text: string
    }

    let {
        x,
        y,
        targetX,
        targetY,
        demandMet = false,
        highlighted = false,
        hovered = false,
        darkened = false,
        darkenedBrightness = 0.34,
        demands
    }: {
        x: number
        y: number
        targetX: number
        targetY: number
        demandMet?: boolean
        highlighted?: boolean
        hovered?: boolean
        darkened?: boolean
        darkenedBrightness?: number
        demands: readonly DemandEntry[]
    } = $props()

    function entryWidthForGood(good: DemandGood): number {
        if (good === Good.SiapSaji) {
            return 38
        }
        return 38
    }

    function entryWidth(entry: DemandEntry): number {
        return entryWidthForGood(entry.good) + (entry.count >= 10 ? 4 : 0)
    }

    const DEMAND_STYLE_BY_GOOD: Readonly<Record<DemandGood, DemandStyle>> = {
        [Good.Rice]: { fill: '#e3d8c0', stroke: '#b2a38c', text: '#6c5a46' },
        [Good.Spice]: { fill: '#d5e1b1', stroke: '#94a982', text: '#425735' },
        [Good.SiapSaji]: { fill: '#f3eeea', stroke: '#b08fa0', text: '#6f4c5f' },
        [Good.Rubber]: { fill: '#c1bdbb', stroke: '#9c9c9c', text: '#131113' },
        [Good.Oil]: { fill: '#baa8ca', stroke: '#8a7f9b', text: '#23344f' }
    }

    const chipHeight = 28
    const entryGap = 0
    const boardWidth = 2646
    const boardHeight = 1280
    const demandMetLabel = 'DEMAND MET'
    const demandMetWidth = 94
    const pageBackgroundFill = '#ede2dc'
    const demandMetTextColor = '#55412d'
    const isDemandMetMarker = $derived(demandMet || demands.length === 0)

    const totalEntriesWidth = $derived.by(() => {
        if (isDemandMetMarker) {
            return demandMetWidth
        }
        if (demands.length === 0) {
            return 0
        }
        return (
            demands.reduce((sum, entry) => sum + entryWidth(entry), 0) +
            entryGap * (demands.length - 1)
        )
    })

    const markerWidth = $derived(Math.max(18, totalEntriesWidth))
    const markerHeight = $derived(chipHeight)
    const halfWidth = $derived(markerWidth / 2)
    const halfHeight = $derived(markerHeight / 2)
    const stripCornerRadius = 7

    const clampedX = $derived(Math.max(halfWidth + 4, Math.min(boardWidth - halfWidth - 4, x)))
    const clampedY = $derived(Math.max(halfHeight + 4, Math.min(boardHeight - halfHeight - 4, y)))

    const left = $derived(clampedX - halfWidth)
    const top = $derived(clampedY - halfHeight)
    const clipPathId = $derived(
        `city-demand-strip-clip-${Math.round(clampedX)}-${Math.round(clampedY)}-${demands.length}`
    )
    const hoverScale = $derived(hovered ? 1.08 : 1)
    const rootTransform = $derived(
        hoverScale === 1
            ? undefined
            : `translate(${clampedX} ${clampedY}) scale(${hoverScale}) translate(${-clampedX} ${-clampedY})`
    )

    const wirePath = $derived.by(() => {
        const dx = targetX - clampedX
        const dy = targetY - clampedY
        const distance = Math.hypot(dx, dy)
        if (distance <= 0.001) {
            return null
        }

        const ux = dx / distance
        const uy = dy / distance
        const sx = Math.abs(ux) / halfWidth
        const sy = Math.abs(uy) / halfHeight
        const edgeScale = 1 / Math.max(sx, sy)
        const startX = clampedX + ux * edgeScale
        const startY = clampedY + uy * edgeScale
        const mx = (startX + targetX) / 2
        const my = (startY + targetY) / 2
        const ox = -uy
        const oy = ux
        const bend = Math.max(5, Math.min(12, distance * 0.16))
        const cx = mx + ox * bend
        const cy = my + oy * bend
        return `M ${startX} ${startY} Q ${cx} ${cy} ${targetX} ${targetY}`
    })

    const laidOutEntries = $derived.by(() => {
        const entries: Array<{
            good: DemandGood
            count: number
            chipX: number
            chipY: number
            chipWidth: number
            style: DemandStyle
            iconX: number
            countX: number
        }> = []
        let cursor = left
        const rowCenterY = clampedY

        for (const entry of demands) {
            const width = entryWidth(entry)
            const style = DEMAND_STYLE_BY_GOOD[entry.good]
            const iconOffset = 13.2
            entries.push({
                good: entry.good,
                count: entry.count,
                chipX: cursor,
                chipY: top,
                chipWidth: width,
                style,
                iconX: cursor + iconOffset,
                countX: cursor + width - 10.8
            })
            cursor += width + entryGap
        }

        return {
            rowCenterY,
            entries
        }
    })
</script>

<g
    class="pointer-events-none select-none"
    aria-hidden="true"
    transform={rootTransform}
    style={`filter:${darkened ? `brightness(${darkenedBrightness})` : 'none'}`}
>
    {#if wirePath}
        <path d={wirePath} fill="none" stroke="#a99f93" stroke-width="1.25" stroke-linecap="round"></path>
    {/if}

    <defs>
        <clipPath id={clipPathId}>
            <rect
                x={left}
                y={top}
                width={markerWidth}
                height={markerHeight}
                rx={stripCornerRadius}
                ry={stripCornerRadius}
            ></rect>
        </clipPath>
    </defs>

    {#if isDemandMetMarker}
        <rect
            x={left}
            y={top}
            width={markerWidth}
            height={markerHeight}
            rx={stripCornerRadius}
            ry={stripCornerRadius}
            fill={pageBackgroundFill}
            fill-opacity="1"
        ></rect>
    {:else}
        <g clip-path={`url(#${clipPathId})`}>
            {#each laidOutEntries.entries as entry (entry.good)}
                <rect
                    x={entry.chipX}
                    y={entry.chipY}
                    width={entry.chipWidth}
                    height={markerHeight}
                    fill={entry.style.fill}
                    fill-opacity="1"
                ></rect>
            {/each}

            {#each laidOutEntries.entries as entry, entryIndex (entry.good)}
                {#if entryIndex > 0}
                    <line
                        x1={entry.chipX}
                        y1={top}
                        x2={entry.chipX}
                        y2={top + markerHeight}
                        stroke="rgba(28, 24, 19, 0.32)"
                        stroke-width="0.9"
                    ></line>
                {/if}
            {/each}
        </g>
    {/if}

    <rect
        x={left}
        y={top}
        width={markerWidth}
        height={markerHeight}
        rx={stripCornerRadius}
        ry={stripCornerRadius}
        fill={isDemandMetMarker ? pageBackgroundFill : 'none'}
        fill-opacity={isDemandMetMarker ? 1 : 0}
        stroke="#2b2620"
        stroke-width="1"
    ></rect>

    {#if highlighted}
        <rect
            x={left}
            y={top}
            width={markerWidth}
            height={markerHeight}
            rx={stripCornerRadius}
            ry={stripCornerRadius}
            fill="none"
            stroke="#fff8d7"
            stroke-width={hovered ? 5.1 : 4.2}
            stroke-linejoin="round"
            stroke-linecap="round"
            opacity="0.96"
        ></rect>
        <rect
            x={left}
            y={top}
            width={markerWidth}
            height={markerHeight}
            rx={stripCornerRadius}
            ry={stripCornerRadius}
            fill="none"
            stroke="#1f2937"
            stroke-width={hovered ? 2.35 : 1.9}
            stroke-linejoin="round"
            stroke-linecap="round"
            opacity="0.92"
        ></rect>
    {/if}

    {#if isDemandMetMarker}
        <text
            x={clampedX}
            y={laidOutEntries.rowCenterY}
            fill={demandMetTextColor}
            font-size="12.4"
            font-weight="800"
            text-anchor="middle"
            dominant-baseline="central"
            font-family="'Trebuchet MS', 'Avenir Next', 'Segoe UI', sans-serif"
            letter-spacing="0.4"
            style="font-variant-numeric: tabular-nums;"
        >
            {demandMetLabel}
        </text>
    {:else}
        {#each laidOutEntries.entries as entry (entry.good)}
            {#if entry.good === Good.Rice}
                <RiceMarker x={entry.iconX} y={laidOutEntries.rowCenterY} height={18.5} outline={false} />
            {:else if entry.good === Good.Spice}
                <SpiceMarker x={entry.iconX} y={laidOutEntries.rowCenterY} height={18.5} outline={false} />
            {:else if entry.good === Good.Rubber}
                <RubberMarker x={entry.iconX} y={laidOutEntries.rowCenterY} height={18.5} outline={false} />
            {:else if entry.good === Good.Oil}
                <OilMarker x={entry.iconX} y={laidOutEntries.rowCenterY} height={18.5} outline={false} />
            {:else}
                <SiapSajiMarker x={entry.iconX} y={laidOutEntries.rowCenterY} height={17} outline={false} />
            {/if}

            <text
                x={entry.countX}
                y={laidOutEntries.rowCenterY}
                fill={entry.style.text}
                font-size="16.8"
                font-weight="800"
                text-anchor="middle"
                dominant-baseline="central"
                font-family="'Trebuchet MS', 'Avenir Next', 'Segoe UI', sans-serif"
                letter-spacing="-0.1"
                style="font-variant-numeric: tabular-nums;"
            >
                {entry.count}
            </text>
        {/each}
    {/if}
</g>
