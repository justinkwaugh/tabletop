import type { StationAppearance } from './stationPresentation.js'
import { svgDataUrl } from '../presentation/svgDataUrl.js'

export type TerrainIconName = 'peak' | 'mountain' | 'range'

export const MountainIcon = {
    path: 'M0 5 L6 -6 L10 0 L13 -4 L19 5 Z',
    fill: '#936039',
    viewBox: '0 -6 19 11'
}

/** A single peak, for the least of a title's mountain terrain. */
export const PeakIcon = {
    path: 'M3 5 L9.5 -5 L16 5 Z',
    fill: MountainIcon.fill,
    viewBox: MountainIcon.viewBox
}

/**
 * Three peaks, the middle highest, for the greatest of a title's mountain terrain: taller than the
 * two-peak mountain, with shallow valleys, so it reads as more mass than it within the same width.
 */
export const RangeIcon = {
    path: 'M0 5 L3.5 -3.5 L5.5 -1.5 L9.5 -9 L13.5 -1.5 L15.5 -3.5 L19 5 Z',
    fill: MountainIcon.fill,
    viewBox: '0 -9 19 14'
}

const TerrainIcons: Readonly<Record<TerrainIconName, typeof MountainIcon>> = {
    peak: PeakIcon,
    mountain: MountainIcon,
    range: RangeIcon
}

/** The icons terrain kinds draw where a map view names none: a mountain's two peaks. */
export const DefaultTerrainIcons: Readonly<Record<string, TerrainIconName>> = {
    mountain: 'mountain'
}

/** The icon drawn for a terrain kind under the view's choice of icons, if it has one. */
export function terrainIcon(
    kind: string,
    icons: Readonly<Record<string, TerrainIconName>>
): typeof MountainIcon | undefined {
    const name = new Map(Object.entries(icons)).get(kind)
    return name ? TerrainIcons[name] : undefined
}

export function terrainIconAppearance(icon: TerrainIconName): StationAppearance {
    const { path, fill, viewBox } = TerrainIcons[icon]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="${path}" fill="${fill}"/></svg>`
    return {
        label: icon,
        color: 'transparent',
        imageUrl: svgDataUrl(svg)
    }
}
