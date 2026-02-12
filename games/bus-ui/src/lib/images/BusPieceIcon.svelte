<script lang="ts">
    import type { SVGAttributes } from 'svelte/elements'

    let {
        width = 56,
        height = 34,
        color = '#0c66b4',
        strokeColor,
        ...svgProps
    }: {
        width?: number
        height?: number
        color?: string
        strokeColor?: string
    } & SVGAttributes<SVGElement> = $props()

    const resolvedStroke = $derived(strokeColor ?? mixHex(color, '#000000', 0.34))
    const topColor = $derived(mixHex(color, '#ffffff', 0.28))

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
            [
                blend(parsedA[0], parsedB[0]),
                blend(parsedA[1], parsedB[1]),
                blend(parsedA[2], parsedB[2])
            ]
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

<svg
    {width}
    {height}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 60 38"
    preserveAspectRatio="none"
    aria-hidden="true"
    {...svgProps}
>
    <!-- Compact bus token silhouette with two wheel bumps -->
    <path
        d="M10 3 H50 Q57 3 57 10 V21 Q57 25 53 25 H51 A5 5 0 0 1 41 25 H19 A5 5 0 0 1 9 25 H7 Q3 25 3 21 V10 Q3 3 10 3 Z"
        fill={color}
        stroke={resolvedStroke}
        stroke-width="1.6"
        stroke-linejoin="round"
    ></path>

    <path d="M10 3 H50 Q57 3 57 10 V10 H3 V10 Q3 3 10 3 Z" fill={topColor} opacity="0.72"></path>

</svg>
