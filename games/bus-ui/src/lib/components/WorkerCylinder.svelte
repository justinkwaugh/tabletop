<script lang="ts">
    let {
        x,
        y,
        color = '#0c66b4',
        width = 32,
        height = 40,
        scale = 1,
        opacity = 1
    }: {
        x: number
        y: number
        color?: string
        width?: number
        height?: number
        scale?: number
        opacity?: number
    } = $props()

    const rx = $derived(width / 2)
    const topRy = $derived(Math.max(4.6, width * 0.235))
    const topY = $derived(-height / 2 + topRy)
    const bottomY = $derived(height / 2 - topRy)
    const bodyHeight = $derived(bottomY - topY)
    const stroke = $derived(mixHex(color, '#000000', 0.24))
    const topColor = $derived(mixHex(color, '#ffffff', 0.24))
    const topInnerInset = $derived(Math.max(1.8, width * 0.08))
    const topInnerRx = $derived(Math.max(1, rx - topInnerInset))
    const topInnerRy = $derived(Math.max(1, topRy - topInnerInset * 0.45))
    const baseCoverRx = $derived(rx + 0.8)
    const baseCoverRy = $derived(topRy + 0.35)
    const rimStrokeWidth = 1.1
    const sideAndBottomOutlinePath = $derived(
        `M ${-rx} ${topY} L ${-rx} ${bottomY} A ${rx} ${topRy} 0 0 0 ${rx} ${bottomY} L ${rx} ${topY}`
    )
    const topOutlinePath = $derived(`M ${-rx} ${topY} A ${rx} ${topRy} 0 0 0 ${rx} ${topY}`)

    function clamp255(value: number): number {
        return Math.max(0, Math.min(255, Math.round(value)))
    }

    function mixHex(a: string, b: string, t: number): string {
        const parsedA = parseHexColor(a)
        const parsedB = parseHexColor(b)
        if (!parsedA || !parsedB) {
            return a
        }
        const blend = (from: number, to: number) => clamp255(from + (to - from) * t)
        return (
            '#' +
            [blend(parsedA[0], parsedB[0]), blend(parsedA[1], parsedB[1]), blend(parsedA[2], parsedB[2])]
                .map((channel) => channel.toString(16).padStart(2, '0'))
                .join('')
        )
    }

    function parseHexColor(input: string): [number, number, number] | undefined {
        const normalized = input.trim()
        const shortMatch = normalized.match(/^#([0-9a-fA-F]{3})$/)
        if (shortMatch) {
            const [r, g, b] = shortMatch[1].split('').map((c) => parseInt(c + c, 16))
            return [r, g, b]
        }
        const longMatch = normalized.match(/^#([0-9a-fA-F]{6})$/)
        if (!longMatch) {
            return undefined
        }
        const hex = longMatch[1]
        return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16)
        ]
    }
</script>

<g
    transform={`translate(${x} ${y}) scale(${scale})`}
    opacity={opacity}
    class="pointer-events-none select-none"
    aria-hidden="true"
>
    <ellipse cx="0" cy={bottomY} rx={baseCoverRx} ry={baseCoverRy} fill={color} />
    <rect
        x={-rx}
        y={topY}
        width={width}
        height={bodyHeight}
        fill={color}
    />
    <path d={sideAndBottomOutlinePath} fill="none" stroke={stroke} stroke-width={rimStrokeWidth} />
    <ellipse cx="0" cy={topY} rx={rx} ry={topRy} fill={color} />
    <path d={topOutlinePath} fill="none" stroke={stroke} stroke-width={rimStrokeWidth} />
    <ellipse cx="0" cy={topY} rx={topInnerRx} ry={topInnerRy} fill={topColor} />
</g>
