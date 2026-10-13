import { LOCALE_GEOMETRY } from './boardGeometry.js'

export function localeOutlinePoints(locale: number): string {
    return LOCALE_GEOMETRY[locale].outline.map((point) => `${point.x},${point.y}`).join(' ')
}
