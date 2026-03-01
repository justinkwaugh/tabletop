<script lang="ts">
    import OilMarker from '$lib/components/OilMarker.svelte'
    import RiceMarker from '$lib/components/RiceMarker.svelte'
    import RubberMarker from '$lib/components/RubberMarker.svelte'
    import SiapSajiMarker from '$lib/components/SiapSajiMarker.svelte'
    import SpiceMarker from '$lib/components/SpiceMarker.svelte'
    import { shadeHexColor } from '$lib/utils/color.js'

    type MarkerGood = 'spice' | 'siapsaji' | 'oil' | 'rice' | 'rubber'
    type MarkerVariant = 'arch' | 'hex' | 'tab' | 'shield' | 'pennant'
    type MarkerDirection = 'north' | 'east' | 'south' | 'west'

    let {
        x,
        y,
        targetX = null,
        targetY = null,
        playerColor,
        goodType,
        goodsCount,
        variant,
        direction = 'east',
        height = 56,
        hatchPatternId = null,
        sampleLabel = null
    }: {
        x: number
        y: number
        targetX?: number | null
        targetY?: number | null
        playerColor: string
        goodType: MarkerGood
        goodsCount: number
        variant: MarkerVariant
        direction?: MarkerDirection
        height?: number
        hatchPatternId?: string | null
        sampleLabel?: string | null
    } = $props()

    const markerWidth = $derived(height * 1.36)
    const markerHeight = $derived(height * 0.83)
    const halfWidth = $derived(markerWidth / 2)
    const halfHeight = $derived(markerHeight / 2)
    const left = $derived(x - halfWidth)
    const right = $derived(x + halfWidth)
    const top = $derived(y - halfHeight)
    const bottom = $derived(y + halfHeight)
    const baseCenterY = $derived(y + markerHeight * 0.02)
    const pairCenterX = $derived.by(() => {
        if (variant !== 'pennant') {
            return x
        }
        if (direction === 'east') {
            return x - markerWidth * 0.085
        }
        if (direction === 'west') {
            return x + markerWidth * 0.085
        }
        return x
    })
    const pairCenterY = $derived.by(() => {
        if (variant !== 'pennant') {
            return baseCenterY
        }
        if (direction === 'north') {
            return baseCenterY + markerHeight * 0.085
        }
        if (direction === 'south') {
            return baseCenterY - markerHeight * 0.085
        }
        return baseCenterY
    })
    const pairHalfSeparation = $derived(markerWidth * 0.165)
    const stackHalfSeparation = $derived(markerHeight * 0.195)
    const verticalStackNudge = $derived(markerHeight * 0.07)
    const iconCenterX = $derived.by(() => {
        if (variant === 'pennant' && (direction === 'north' || direction === 'south')) {
            return pairCenterX
        }
        return pairCenterX - pairHalfSeparation
    })
    const iconCenterY = $derived.by(() => {
        if (variant === 'pennant' && (direction === 'north' || direction === 'south')) {
            return pairCenterY - stackHalfSeparation - verticalStackNudge
        }
        return pairCenterY
    })
    const primaryVisualHeight = $derived(height * 0.46)
    const iconHeight = $derived(primaryVisualHeight)
    const siapSajiIconHeight = $derived(iconHeight * 1.5)
    const countX = $derived.by(() => {
        if (variant === 'pennant' && (direction === 'north' || direction === 'south')) {
            return pairCenterX
        }
        return pairCenterX + pairHalfSeparation
    })
    const countY = $derived.by(() => {
        if (variant === 'pennant' && (direction === 'north' || direction === 'south')) {
            return pairCenterY + stackHalfSeparation + verticalStackNudge
        }
        return pairCenterY
    })
    const countFontSize = $derived(Math.max(18, primaryVisualHeight))
    const borderColor = $derived(shadeHexColor(playerColor, 0.48))
    const shadowColor = $derived(shadeHexColor(playerColor, 0.74))
    const numberStroke = $derived(shadeHexColor(playerColor, 0.64))
    const accentColor = $derived(shadeHexColor(playerColor, -0.16))
    const bodyRotationDegrees = $derived.by(() => {
        if (variant !== 'pennant') {
            return 0
        }
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
        const cx = x
        const cy = y
        const w = markerWidth
        const h = markerHeight
        const radius = h * 0.22

        if (variant === 'arch') {
            const bodyBottom = cy + h * 0.34
            const tailBaseX = l + w * 0.23
            const tailTipX = tailBaseX - h * 0.06
            const tailTipY = cy + h * 0.58
            const tailRightX = tailBaseX + h * 0.24
            return [
                `M ${l + radius} ${t}`,
                `H ${r - radius}`,
                `Q ${r} ${t} ${r} ${t + radius}`,
                `V ${bodyBottom - radius}`,
                `Q ${r} ${bodyBottom} ${r - radius} ${bodyBottom}`,
                `H ${tailRightX}`,
                `L ${tailTipX} ${tailTipY}`,
                `L ${tailBaseX} ${bodyBottom}`,
                `H ${l + radius}`,
                `Q ${l} ${bodyBottom} ${l} ${bodyBottom - radius}`,
                `V ${t + radius}`,
                `Q ${l} ${t} ${l + radius} ${t}`,
                'Z'
            ].join(' ')
        }

        if (variant === 'hex') {
            const inset = w * 0.16
            return [
                `M ${l + inset} ${t}`,
                `L ${r - inset} ${t}`,
                `L ${r} ${cy}`,
                `L ${r - inset} ${b}`,
                `L ${l + inset} ${b}`,
                `L ${l} ${cy}`,
                'Z'
            ].join(' ')
        }

        if (variant === 'tab') {
            const tailDepth = h * 0.22
            const tailSpan = w * 0.24

            if (direction === 'north') {
                return [
                    `M ${l + radius} ${t}`,
                    `H ${cx - tailSpan / 2}`,
                    `L ${cx} ${t - tailDepth}`,
                    `L ${cx + tailSpan / 2} ${t}`,
                    `H ${r - radius}`,
                    `Q ${r} ${t} ${r} ${t + radius}`,
                    `V ${b - radius}`,
                    `Q ${r} ${b} ${r - radius} ${b}`,
                    `H ${l + radius}`,
                    `Q ${l} ${b} ${l} ${b - radius}`,
                    `V ${t + radius}`,
                    `Q ${l} ${t} ${l + radius} ${t}`,
                    'Z'
                ].join(' ')
            }

            if (direction === 'south') {
                return [
                    `M ${l + radius} ${t}`,
                    `H ${r - radius}`,
                    `Q ${r} ${t} ${r} ${t + radius}`,
                    `V ${b - radius}`,
                    `Q ${r} ${b} ${r - radius} ${b}`,
                    `H ${cx + tailSpan / 2}`,
                    `L ${cx} ${b + tailDepth}`,
                    `L ${cx - tailSpan / 2} ${b}`,
                    `H ${l + radius}`,
                    `Q ${l} ${b} ${l} ${b - radius}`,
                    `V ${t + radius}`,
                    `Q ${l} ${t} ${l + radius} ${t}`,
                    'Z'
                ].join(' ')
            }

            if (direction === 'west') {
                return [
                    `M ${l + radius} ${t}`,
                    `H ${r - radius}`,
                    `Q ${r} ${t} ${r} ${t + radius}`,
                    `V ${b - radius}`,
                    `Q ${r} ${b} ${r - radius} ${b}`,
                    `H ${l + radius}`,
                    `Q ${l} ${b} ${l} ${b - radius}`,
                    `V ${cy + tailSpan / 2}`,
                    `L ${l - tailDepth} ${cy}`,
                    `L ${l} ${cy - tailSpan / 2}`,
                    `V ${t + radius}`,
                    `Q ${l} ${t} ${l + radius} ${t}`,
                    'Z'
                ].join(' ')
            }

            return [
                `M ${l + radius} ${t}`,
                `H ${r - radius}`,
                `Q ${r} ${t} ${r} ${t + radius}`,
                `V ${cy - tailSpan / 2}`,
                `L ${r + tailDepth} ${cy}`,
                `L ${r} ${cy + tailSpan / 2}`,
                `V ${b - radius}`,
                `Q ${r} ${b} ${r - radius} ${b}`,
                `H ${l + radius}`,
                `Q ${l} ${b} ${l} ${b - radius}`,
                `V ${t + radius}`,
                `Q ${l} ${t} ${l + radius} ${t}`,
                'Z'
            ].join(' ')
        }

        if (variant === 'shield') {
            return [
                `M ${cx} ${t}`,
                `L ${r} ${cy - h * 0.11}`,
                `L ${r - h * 0.1} ${cy + h * 0.24}`,
                `L ${cx} ${cy + h * 0.62}`,
                `L ${l + h * 0.1} ${cy + h * 0.24}`,
                `L ${l} ${cy - h * 0.11}`,
                'Z'
            ].join(' ')
        }

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

        const tailDepth = markerHeight * 0.22

        let startX = x
        let startY = y
        if (variant === 'tab') {
            if (direction === 'north') {
                startX = x
                startY = top - tailDepth
            } else if (direction === 'south') {
                startX = x
                startY = bottom + tailDepth
            } else if (direction === 'west') {
                startX = left - tailDepth
                startY = y
            } else {
                startX = right + tailDepth
                startY = y
            }
        } else if (variant === 'pennant') {
            const pennantTip = rotatePointAroundCenter(right, y, x, y, bodyRotationDegrees)
            startX = pennantTip.x
            startY = pennantTip.y
        } else if (variant === 'arch') {
            const tailBaseX = left + markerWidth * 0.23
            const tailTipX = tailBaseX - markerHeight * 0.06
            const tailTipY = y + markerHeight * 0.58
            startX = tailTipX
            startY = tailTipY
        } else {
            const dx = targetX - x
            const dy = targetY - y
            const distanceFromCenter = Math.hypot(dx, dy)
            if (distanceFromCenter > 0.001) {
                const unitX = dx / distanceFromCenter
                const unitY = dy / distanceFromCenter
                const startDistance = Math.min(markerWidth, markerHeight) * 0.42
                startX = x + unitX * startDistance
                startY = y + unitY * startDistance
            }
        }

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
        const bendDirection = variant === 'shield' || variant === 'pennant' ? -1 : 1
        const controlX = (startX + targetX) / 2 + orthX * controlScale * bendDirection
        const controlY = (startY + targetY) / 2 + orthY * controlScale * bendDirection
        return `M ${startX} ${startY} Q ${controlX} ${controlY} ${targetX} ${targetY}`
    })
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    {#if connectorPath && targetX !== null && targetY !== null}
        <path d={connectorPath} fill="none" stroke={shadowColor} stroke-width="5.5" opacity="0.24"></path>
        <path d={connectorPath} fill="none" stroke={borderColor} stroke-width="2.6"></path>
        <circle cx={targetX} cy={targetY} r="4.1" fill="#f8fafc" stroke={borderColor} stroke-width="1.6"></circle>
    {/if}

    <g transform={bodyTransform}>
        <path d={bodyPath} fill={shadowColor} opacity="0.28" transform="translate(1.8 2.1)"></path>
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

    {#if goodType === 'spice'}
        <SpiceMarker x={iconCenterX} y={iconCenterY} height={iconHeight} outline={false} />
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
        x={countX}
        y={countY}
        fill="#ffffff"
        stroke={numberStroke}
        stroke-width="1"
        paint-order="stroke fill"
        font-size={countFontSize}
        font-weight="800"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="'Trebuchet MS', 'Avenir Next', 'Segoe UI', sans-serif"
        letter-spacing="0.3"
    >
        {goodsCount}
    </text>

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
</g>
