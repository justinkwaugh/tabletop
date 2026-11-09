import { assertExists } from '@tabletop/common'
import type { MapViewDefinition } from './stationPresentation.js'
import { CentredTextShift } from '../presentation/textBaseline.js'

/** Stands out from the black city circles of ordinary stations, on every colour of hex. */
export const SpecialStationOutline = '#f59a00'

/** A company's own logo, where a title draws one for every company. */
export function stationLogo(stations: MapViewDefinition['stations'], companyId: string): string {
    const imageUrl = stations?.[companyId]?.imageUrl
    assertExists(imageUrl, `Company ${companyId} has a logo`)
    return imageUrl
}

/** A white token bearing a company's initials, for a place the map prints for that company. */
export function companyInitialsMark(label: string): string {
    const size = label.length > 3 ? 11 : 13
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="18.5" fill="#fff" stroke="#111" stroke-width="3"/><text x="20" y="20" dy="${CentredTextShift}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="800" font-size="${size}" fill="#111">${label.replace('&', '&amp;')}</text></svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
