import type { Point } from '@tabletop/common'
import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'

// Libre Baskerville's lining figures, in ems.
export const FIGURE_WIDTH = 0.66
export const FIGURE_HEIGHT = 0.72
// Room left between the number and the locale's nearest edge.
const MARGIN = 0.85
const LARGEST = 80

// The shade the border tint of Darker borders gives the open map.
export const LOCALE_NUMBER_INK = '#b6c1bd'

export interface LocaleNumber {
    locale: number
    at: Point
    size: number
}

/** The largest size at which the number fits within the circle clear of the locale's edges. */
export function localeNumberSize(locale: number, clearance: number): number {
    const halfWidth = (String(locale).length * FIGURE_WIDTH) / 2
    const halfDiagonal = Math.hypot(halfWidth, FIGURE_HEIGHT / 2)
    return Math.min(LARGEST, (clearance * MARGIN) / halfDiagonal)
}

export function localeNumbers(localeIds: readonly number[]): LocaleNumber[] {
    return localeIds.map((locale) => {
        const { anchor, clearance } = LOCALE_GEOMETRY[locale]
        return { locale, at: anchor, size: localeNumberSize(locale, clearance) }
    })
}
