import type { StationAppearance } from './stationPresentation.js'
import { svgDataUrl } from '../presentation/svgDataUrl.js'

export type TerrainIconName = 'peak' | 'mountain' | 'range' | 'cactus' | 'marsh'

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

/** A saguaro, for desert, as 18MEX's board prints it. */
export const CactusIcon = {
    path: 'M8 5 V-5 Q9.5 -6.5 11 -5 V-1 H13 V-3.5 Q14 -4.5 15 -3.5 V1 Q15 2 14 2 H11 V5 Z M8 1 H5 Q4 1 4 0 V-2.5 Q5 -3.5 6 -2.5 V-1 H8 Z',
    fill: '#4f8a3c',
    viewBox: MountainIcon.viewBox
}

/** Three tufts of reeds on a waterline, for swamp. */
export const MarshIcon = {
    path: 'M2 4.2 L4 -1 L5.4 4.2 Z M6.6 4.2 L9.5 -4.5 L11.2 4.2 Z M12.6 4.2 L15 -2 L16.4 4.2 Z M1 4.2 H18 V5.2 H1 Z',
    fill: '#5f7a34',
    viewBox: MountainIcon.viewBox
}

const TerrainIcons: Readonly<Record<TerrainIconName, typeof MountainIcon>> = {
    peak: PeakIcon,
    mountain: MountainIcon,
    range: RangeIcon,
    cactus: CactusIcon,
    marsh: MarshIcon
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
