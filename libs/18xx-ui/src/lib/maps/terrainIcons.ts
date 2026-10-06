import type { StationAppearance } from './stationPresentation.js'

export type TerrainIconName = 'mountain'

export const MountainIcon = {
    path: 'M0 5 L6 -6 L10 0 L13 -4 L19 5 Z',
    fill: '#936039',
    viewBox: '0 -6 19 11'
}

const TerrainIcons: Readonly<Record<TerrainIconName, typeof MountainIcon>> = {
    mountain: MountainIcon
}

export function terrainIconAppearance(icon: TerrainIconName): StationAppearance {
    const { path, fill, viewBox } = TerrainIcons[icon]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="${path}" fill="${fill}"/></svg>`
    return {
        label: icon,
        color: 'transparent',
        imageUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`
    }
}
