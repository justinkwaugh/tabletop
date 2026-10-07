import { Color } from '@tabletop/common'
import { SignCream } from '$lib/utils/shopSign.js'

const DarkPlayerColors: ReadonlySet<Color> = new Set([Color.Black, Color.Brown])

export function signEdgeColor(color: Color): string {
    return DarkPlayerColors.has(color) ? '#ffffff' : '#1f1f1f'
}

// A sign's inner frame and ornaments are cream, which vanishes on a white sign.
const SignInkOnLight = '#7a6a52'

export function signFrameColor(color: Color): string {
    return color === Color.White ? SignInkOnLight : SignCream
}
