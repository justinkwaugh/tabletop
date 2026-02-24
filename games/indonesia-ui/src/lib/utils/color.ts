export function shadeHexColor(hex: string, darknessShift: number): string {
    const normalized = hex.trim().replace('#', '')
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return hex
    }

    const shift = Math.max(-0.9, Math.min(0.9, darknessShift))
    const channels = [0, 2, 4].map((offset) =>
        Number.parseInt(normalized.slice(offset, offset + 2), 16)
    )

    const shifted = channels.map((channel) => {
        if (shift >= 0) {
            return Math.round(channel * (1 - shift))
        }
        return Math.round(channel + (255 - channel) * -shift)
    })

    const toHex = (value: number) => value.toString(16).padStart(2, '0')
    return `#${toHex(shifted[0])}${toHex(shifted[1])}${toHex(shifted[2])}`
}
