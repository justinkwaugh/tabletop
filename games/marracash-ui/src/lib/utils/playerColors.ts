import { Color } from '@tabletop/common'

const DarkPlayerColors: ReadonlySet<Color> = new Set([Color.Black, Color.Brown])

export function signEdgeColor(color: Color): string {
    return DarkPlayerColors.has(color) ? '#ffffff' : '#1f1f1f'
}
