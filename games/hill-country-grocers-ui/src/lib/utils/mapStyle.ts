import type { AxialCoordinates } from '@tabletop/common'
import { CityTier } from '@tabletop/hill-country-grocers'

export const TIER_FILL: Record<CityTier, string> = {
    [CityTier.White]: '#ffffff',
    [CityTier.Brown]: '#6b4636',
    [CityTier.Black]: '#1a1512'
}

export const MEADOW_TINTS = ['#c9c48a', '#c2c184', '#d0c890', '#bdbd7d', '#cdc48c', '#c6c788']
export const TOWN_GROUND = '#efe5c4'

// A stable pseudo-random value per hex so decoration never shifts between renders.
export function coordsSeed(coords: AxialCoordinates): number {
    const hash = Math.sin(coords.q * 12.9898 + coords.r * 78.233) * 43758.5453
    return hash - Math.floor(hash)
}
