type Rgb = readonly [number, number, number]

function rgb(hex: string): Rgb {
    const value = Number.parseInt(hex.slice(1, 7), 16)
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function linear(channel: number): number {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
    const [r, g, b] = rgb(hex).map(linear)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** A `#rrggbbaa` colour laid over an opaque `#rrggbb` one, as the screen shows them. */
export function laidOver(base: string, overlay: string): string {
    const alpha = overlay.length === 9 ? Number.parseInt(overlay.slice(7, 9), 16) / 255 : 1
    const top = rgb(overlay)
    const mixed = rgb(base).map((channel, index) =>
        Math.round(channel * (1 - alpha) + top[index] * alpha)
    )
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** WCAG 2 contrast ratio of two opaque `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
    const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
    return (light + 0.05) / (dark + 0.05)
}

function lab(hex: string): Rgb {
    const [r, g, b] = rgb(hex).map(linear)
    const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** CIE76 colour difference (ΔE) of two opaque `#rrggbb` colours. */
function colourDifference(a: string, b: string): number {
    const [l1, a1, b1] = lab(a)
    const [l2, a2, b2] = lab(b)
    return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

export type NamedColour = { name: string; value: string }

/** Every pair, one from each list (or within one list), closer than `minimum`. */
export function closePairs(
    minimum: number,
    first: readonly NamedColour[],
    second: readonly NamedColour[] = first
): string[] {
    const sameList = first === second
    return first.flatMap((a, i) =>
        second
            .filter((_, j) => !sameList || j > i)
            .filter((b) => colourDifference(a.value, b.value) < minimum)
            .map((b) => `${a.name} ${a.value} ~ ${b.name} ${b.value}`)
    )
}
