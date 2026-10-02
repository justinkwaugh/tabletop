export function withLightness(hex: string, lightness: number): string {
    const [red, green, blue] = [1, 3, 5].map(
        (start) => parseInt(hex.slice(start, start + 2), 16) / 255
    )
    const max = Math.max(red, green, blue)
    const min = Math.min(red, green, blue)
    const chroma = max - min
    const currentLightness = (max + min) / 2
    const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * currentLightness - 1))
    const hue =
        chroma === 0
            ? 0
            : max === red
              ? 60 * (((green - blue) / chroma + 6) % 6)
              : max === green
                ? 60 * ((blue - red) / chroma + 2)
                : 60 * ((red - green) / chroma + 4)
    return `hsl(${hue} ${saturation * 100}% ${lightness * 100}%)`
}
