/** A ``#rrggbb`` color's red, green and blue channels, 0–255. */
export function hexChannels(color: string): [number, number, number] {
    const [red, green, blue] = [1, 3, 5].map((offset) =>
        parseInt(color.slice(offset, offset + 2), 16)
    )
    return [red, green, blue]
}

/** Relative luminance of a ``#rrggbb`` color. */
export function relativeLuminance(color: string): number {
    const [red, green, blue] = hexChannels(color).map((value) => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

/** ``base`` mixed toward ``toward``, keeping ``basePercent`` of ``base``. */
export function mixHex(base: string, toward: string, basePercent: number): string {
    const other = hexChannels(toward)
    return `#${hexChannels(base)
        .map((value, index) =>
            Math.round((value * basePercent + other[index] * (100 - basePercent)) / 100)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`
}
