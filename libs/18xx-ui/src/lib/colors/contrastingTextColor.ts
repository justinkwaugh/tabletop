/** Black or white text for a background; non-hex backgrounds (gradients) are assumed dark. */
export function contrastingTextColor(color: string): string {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return '#ffffff'
    const channels = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
    const linear = channels.map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    )
    const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    return luminance > 0.1992 ? '#181818' : '#ffffff'
}
