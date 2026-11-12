import type { StationAppearance } from './stationPresentation.js'
import { svgDataUrl } from '../presentation/svgDataUrl.js'

export type TerrainIconName = 'mountain' | 'hill' | 'rough'

export const MountainIcon = {
    path: 'M0 5 L6 -6 L10 0 L13 -4 L19 5 Z',
    fill: '#936039',
    viewBox: '0 -6 19 11'
}

/** Rounded hills, lower than a mountain, as 1849's hill hexes print (§10.3.1). */
export const HillIcon = {
    path: 'M0 5 C1.5 -2 6 -4 9 -0.5 C11.5 -3.5 16.5 -2.5 19 5 Z',
    fill: '#a8794a',
    viewBox: '0 -6 19 11'
}

/** Scattered rocks for rough ground, as 1849's rough hexes print (§10.3.1). */
export const RoughIcon = {
    path: 'M0.5 5 L3.5 0.5 L6.5 5 Z M6.5 5 L10 -2 L13.5 5 Z M13 5 L15.8 1.5 L18.5 5 Z',
    fill: '#8f8160',
    viewBox: '0 -6 19 11'
}

const TerrainIcons: Readonly<Record<TerrainIconName, typeof MountainIcon>> = {
    mountain: MountainIcon,
    hill: HillIcon,
    rough: RoughIcon
}

const TerrainIconsByKind: ReadonlyMap<string, typeof MountainIcon> = new Map(
    Object.entries(TerrainIcons)
)

/** The icon drawn for a terrain kind, where the family has one. */
export function terrainIcon(kind: string): typeof MountainIcon | undefined {
    return TerrainIconsByKind.get(kind)
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
