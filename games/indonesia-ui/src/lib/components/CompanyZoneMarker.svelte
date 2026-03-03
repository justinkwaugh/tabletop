<script lang="ts">
    import OilMarker from '$lib/components/OilMarker.svelte'
    import RiceMarker from '$lib/components/RiceMarker.svelte'
    import RubberMarker from '$lib/components/RubberMarker.svelte'
    import SiapSajiMarker from '$lib/components/SiapSajiMarker.svelte'
    import SpiceMarker from '$lib/components/SpiceMarker.svelte'
    import { shadeHexColor } from '$lib/utils/color.js'

    type MarkerGood = 'spice' | 'siapsaji' | 'oil' | 'rice' | 'rubber'
    type MarkerDirection = 'north' | 'east' | 'south' | 'west'
    let {
        x,
        y,
        targetX = null,
        targetY = null,
        playerColor,
        goodType,
        goodsCount,
        direction = 'east',
        height = 56,
        hatchPatternId = null,
        highlighted = false,
        masked = false,
        sampleLabel = null
    }: {
        x: number
        y: number
        targetX?: number | null
        targetY?: number | null
        playerColor: string
        goodType: MarkerGood
        goodsCount: number
        direction?: MarkerDirection
        height?: number
        hatchPatternId?: string | null
        highlighted?: boolean
        masked?: boolean
        sampleLabel?: string | null
    } = $props()

    const isDoubleDigitCount = $derived(Math.abs(goodsCount) >= 10)
    const markerBaseWidth = $derived(height * 1.36 + 4)
    const markerWidth = $derived(markerBaseWidth + (isDoubleDigitCount ? 18 : 0))
    const markerHeight = $derived(height * 0.83)
    const halfWidth = $derived(markerWidth / 2)
    const halfHeight = $derived(markerHeight / 2)
    const left = $derived(x - halfWidth)
    const right = $derived(x + halfWidth)
    const top = $derived(y - halfHeight)
    const bottom = $derived(y + halfHeight)
    const pairCenterX = $derived.by(() => {
        if (direction === 'east') {
            return x - markerBaseWidth * 0.03 + 2 - (isDoubleDigitCount ? 2 : 0)
        }
        if (direction === 'west') {
            return x + markerBaseWidth * 0.07 + 2
        }
        return x
    })
    const pairCenterY = $derived(y)
    const pairHalfSeparation = $derived(markerWidth * 0.19)
    const iconCenterX = $derived(pairCenterX - pairHalfSeparation)
    const iconCenterY = $derived(pairCenterY)
    const iconHeight = $derived(height * 0.56)
    const spiceIconHeight = $derived(iconHeight * 0.92)
    const siapSajiIconHeight = $derived(iconHeight * 0.94)
    const countX = $derived(pairCenterX + pairHalfSeparation)
    const countY = $derived(pairCenterY)
    const primaryVisualHeight = $derived(height * 0.46)
    const countFontSize = $derived(Math.max(18, primaryVisualHeight))
    const borderColor = $derived(shadeHexColor(playerColor, 0.48))
    const shadowColor = $derived(shadeHexColor(playerColor, 0.74))
    const accentColor = $derived(shadeHexColor(playerColor, -0.16))
    const bodyRotationDegrees = $derived.by(() => {
        if (direction === 'north') {
            return -90
        }
        if (direction === 'south') {
            return 90
        }
        if (direction === 'west') {
            return 180
        }
        return 0
    })
    const bodyTransform = $derived.by(() => `rotate(${bodyRotationDegrees} ${x} ${y})`)
    const bodyScaleTransform = $derived.by(() => {
        if (!highlighted) {
            return bodyTransform
        }
        return `${bodyTransform} translate(${x} ${y}) scale(1.05) translate(${-x} ${-y})`
    })
    const contentScaleTransform = $derived.by(() => {
        if (!highlighted) {
            return undefined
        }
        return `translate(${x} ${y}) scale(1.05) translate(${-x} ${-y})`
    })
    const connectorHaloStrokeWidth = $derived(highlighted ? 7.1 : 5.5)
    const connectorMainStrokeWidth = $derived(highlighted ? 3.5 : 2.6)
    const connectorTargetRadius = $derived(highlighted ? 5.1 : 4.1)
    const connectorTargetStrokeWidth = $derived(highlighted ? 2 : 1.6)
    const connectorHaloOpacity = $derived(highlighted ? 0.82 : 0.24)
    const bodyHaloStrokeWidth = $derived(highlighted ? 5.4 : 0)

    function rotatePointAroundCenter(
        pointX: number,
        pointY: number,
        centerX: number,
        centerY: number,
        degrees: number
    ): { x: number; y: number } {
        if (degrees === 0) {
            return { x: pointX, y: pointY }
        }
        const radians = (degrees * Math.PI) / 180
        const cosine = Math.cos(radians)
        const sine = Math.sin(radians)
        const translatedX = pointX - centerX
        const translatedY = pointY - centerY
        return {
            x: centerX + translatedX * cosine - translatedY * sine,
            y: centerY + translatedX * sine + translatedY * cosine
        }
    }

    const bodyPath = $derived.by(() => {
        const l = left
        const r = right
        const t = top
        const b = bottom
        const cy = y
        const w = markerWidth
        const h = markerHeight
        const radius = h * 0.22

        return [
            `M ${l} ${t + radius}`,
            `Q ${l} ${t} ${l + radius} ${t}`,
            `H ${r - w * 0.2}`,
            `L ${r} ${cy}`,
            `L ${r - w * 0.2} ${b}`,
            `H ${l + radius}`,
            `Q ${l} ${b} ${l} ${b - radius}`,
            `V ${t + radius}`,
            'Z'
        ].join(' ')
    })

    const connectorPath = $derived.by(() => {
        if (targetX === null || targetY === null) {
            return null
        }

        const pennantTip = rotatePointAroundCenter(right, y, x, y, bodyRotationDegrees)
        const startX = pennantTip.x
        const startY = pennantTip.y

        const dx = targetX - startX
        const dy = targetY - startY
        const distance = Math.hypot(dx, dy)
        if (distance < 2) {
            return null
        }
        const unitX = dx / distance
        const unitY = dy / distance
        const controlScale = Math.max(16, Math.min(40, distance * 0.24))
        const orthX = -unitY
        const orthY = unitX
        const bendDirection = -1
        const controlX = (startX + targetX) / 2 + orthX * controlScale * bendDirection
        const controlY = (startY + targetY) / 2 + orthY * controlScale * bendDirection
        return `M ${startX} ${startY} Q ${controlX} ${controlY} ${targetX} ${targetY}`
    })
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    {#if connectorPath && targetX !== null && targetY !== null}
        <path
            d={connectorPath}
            fill="none"
            stroke="#fff8d7"
            stroke-width={connectorHaloStrokeWidth}
            opacity={connectorHaloOpacity}
        ></path>
        <path
            d={connectorPath}
            fill="none"
            stroke={shadowColor}
            stroke-width={connectorHaloStrokeWidth}
            opacity="0.24"
        ></path>
        <path d={connectorPath} fill="none" stroke={borderColor} stroke-width={connectorMainStrokeWidth}></path>
        <circle
            cx={targetX}
            cy={targetY}
            r={connectorTargetRadius}
            fill="#f8fafc"
            stroke={borderColor}
            stroke-width={connectorTargetStrokeWidth}
        ></circle>
    {/if}

    <g transform={bodyScaleTransform}>
        <path d={bodyPath} fill={shadowColor} opacity="0.28" transform="translate(1.8 2.1)"></path>
        {#if highlighted}
            <path
                d={bodyPath}
                fill="none"
                stroke="#fff8d7"
                stroke-width={bodyHaloStrokeWidth}
                stroke-linejoin="round"
                opacity="0.86"
            ></path>
        {/if}
        <path
            d={bodyPath}
            fill={playerColor}
            stroke={borderColor}
            stroke-width="2.2"
            stroke-linejoin="round"
        ></path>
        {#if hatchPatternId}
            <path
                d={bodyPath}
                fill={`url(#${hatchPatternId})`}
                stroke="none"
                stroke-width="0"
                opacity="0.9"
            ></path>
            <path
                d={bodyPath}
                fill={`url(#${hatchPatternId})`}
                stroke="none"
                stroke-width="0"
                opacity="0.55"
            ></path>
        {/if}
        <path
            d={bodyPath}
            fill="none"
            stroke={accentColor}
            stroke-width="1"
            stroke-linejoin="round"
            opacity="0.38"
            transform="translate(0.4 0.4)"
        ></path>
    </g>

    <g transform={contentScaleTransform}>
        {#if goodType === 'spice'}
            <SpiceMarker x={iconCenterX} y={iconCenterY} height={spiceIconHeight} outline={false} />
        {:else if goodType === 'siapsaji'}
            <SiapSajiMarker x={iconCenterX} y={iconCenterY} height={siapSajiIconHeight} outline={false} />
        {:else if goodType === 'oil'}
            <OilMarker x={iconCenterX} y={iconCenterY} height={iconHeight} outline={false} />
        {:else if goodType === 'rice'}
            <RiceMarker x={iconCenterX} y={iconCenterY} height={iconHeight} outline={false} />
        {:else}
            <RubberMarker x={iconCenterX} y={iconCenterY} height={iconHeight} outline={false} />
        {/if}

        <text
            x={countX + 1}
            y={countY + 1}
            fill="#000000"
            opacity="0.5"
            font-size={countFontSize}
            font-weight="800"
            text-anchor="middle"
            dominant-baseline="central"
            font-family="'Trebuchet MS', 'Avenir Next', 'Segoe UI', sans-serif"
            letter-spacing="-1.2"
        >
            {goodsCount}
        </text>
        <text
            x={countX}
            y={countY}
            fill="#ffffff"
            font-size={countFontSize}
            font-weight="800"
            text-anchor="middle"
            dominant-baseline="central"
            font-family="'Trebuchet MS', 'Avenir Next', 'Segoe UI', sans-serif"
            letter-spacing="-1.2"
        >
            {goodsCount}
        </text>
    </g>

    {#if sampleLabel}
        <text
            x={right + markerHeight * 0.14}
            y={top - markerHeight * 0.08}
            fill={shadeHexColor(borderColor, 0.45)}
            stroke="#ffffff"
            stroke-width="0.9"
            paint-order="stroke fill"
            font-size={Math.max(11, markerHeight * 0.24)}
            font-weight="800"
            text-anchor="middle"
            dominant-baseline="middle"
            font-family="'Trebuchet MS', 'Avenir Next', 'Segoe UI', sans-serif"
            letter-spacing="0.2"
        >
            {sampleLabel}
        </text>
    {/if}

    {#if masked}
        {#if connectorPath && targetX !== null && targetY !== null}
            <path
                d={connectorPath}
                fill="none"
                stroke="#000000"
                stroke-width={connectorHaloStrokeWidth + 0.8}
                opacity="0.34"
            ></path>
            <circle
                cx={targetX}
                cy={targetY}
                r={connectorTargetRadius + 0.8}
                fill="#000000"
                opacity="0.36"
            ></circle>
        {/if}
        <path d={bodyPath} fill="#000000" opacity="0.42" transform={bodyScaleTransform}></path>
    {/if}
</g>
