import { relativeLuminance } from './hexColor.js'

/** Black or white text for a background; non-hex backgrounds (gradients) are assumed dark. */
export function contrastingTextColor(color: string): string {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return '#ffffff'
    return relativeLuminance(color) > 0.1992 ? '#181818' : '#ffffff'
}
