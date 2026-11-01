import {
    MeatPackingLocations,
    revenueMarkerValue,
    type HydratedEighteenFortySixState,
    type RevenuePrivateId
} from '@tabletop/1846'
import {
    svgDataUrl,
    tileSymbolMarkup,
    type LocationMarkerArt,
    type MapMarkerArt,
    type TileSymbolName,
    type TokenPlacement
} from '@tabletop/18xx-ui'

type MarkerState = Pick<HydratedEighteenFortySixState, 'revenueMarkers' | 'steamboat'>
type PlacedRevenueMarker = {
    privateCompanyId: RevenuePrivateId
    companyId: string
    locationId: string
}
type RevenueIcon = TileSymbolName | 'skyline'

const ArtRadius = 10.5
const Ink = '#1d1b18'
const Paper = '#ffffff'
const SkylineMarkup =
    '<g transform="translate(-6.5 -5.5) scale(0.5)" stroke-width="1.4" stroke-linejoin="round"><path d="M1.5 21V10H7V21Z M7 21V4L10.5 1.5L14 4V21Z M14 21V7.5H19V21Z M19 21V12H24.5V21Z" fill="none"/><path d="M0.5 21H25.5" stroke-linecap="round"/></g>'

const RevenuePrivates: Readonly<
    Record<RevenuePrivateId, { name: string; icon: RevenueIcon; place: TokenPlacement }>
> = {
    SC: { name: 'Steamboat', icon: 'port', place: { covers: 'port' } },
    MPC: { name: 'Meat Packing', icon: 'horns', place: { covers: 'horns' } },
    BT: { name: 'Boomtown', icon: 'skyline', place: 'corner' }
}
// Horns are wide and flat, so they draw larger to read at the same weight.
const IconPlacement: Readonly<Record<RevenueIcon, string>> = {
    port: 'translate(0 -3.4) scale(0.62)',
    horns: 'translate(0 -4.2) scale(0.85)',
    skyline: 'translate(0 -3.4) scale(0.62)'
}

export function revenueMarkerKind(companyId: string, privateCompanyId: string): string {
    return `${companyId}:${privateCompanyId}`
}

/** Each revenue private's marker kinds, by the companies that may own one, with their names. */
export function revenueMarkerNames(companyIds: readonly string[]): Record<string, string> {
    return Object.fromEntries(
        companyIds.flatMap((companyId) =>
            Object.entries(RevenuePrivates).map(([privateCompanyId, { name }]) => [
                revenueMarkerKind(companyId, privateCompanyId),
                `${companyId} ${name}`
            ])
        )
    )
}

/** The revenue markers on the map, the Steamboat's assignment among them. */
export function placedRevenueMarkers(state: MarkerState): PlacedRevenueMarker[] {
    return [
        ...state.revenueMarkers,
        ...(state.steamboat ? [{ ...state.steamboat, privateCompanyId: 'SC' as const }] : [])
    ]
}

/**
 * Each placed marker's token, with its bonus where it stands, in place of the icons it covers;
 * once Meat Packing's is down, its other location no longer shows the horns.
 */
export function revenueTokenArt(state: MarkerState): LocationMarkerArt {
    const art: Record<string, Record<string, MapMarkerArt>> = {}
    const add = (locationId: string, markerId: string, markerArt: MapMarkerArt) => {
        art[locationId] = { ...art[locationId], [markerId]: markerArt }
    }
    for (const marker of placedRevenueMarkers(state)) {
        add(marker.locationId, revenueMarkerKind(marker.companyId, marker.privateCompanyId), {
            token: {
                imageUrl: tokenImage(
                    marker.privateCompanyId,
                    revenueMarkerValue(marker.privateCompanyId, marker.locationId)
                ),
                place: RevenuePrivates[marker.privateCompanyId].place
            }
        })
        if (marker.privateCompanyId === 'MPC')
            for (const locationId of MeatPackingLocations)
                if (locationId !== marker.locationId)
                    add(locationId, 'meat-packing', { hidden: true })
    }
    return art
}

function tokenImage(privateCompanyId: RevenuePrivateId, bonus: number): string {
    const { icon } = RevenuePrivates[privateCompanyId]
    const r = ArtRadius
    return svgDataUrl(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-r} ${-r} ${r * 2} ${r * 2}">` +
            `<circle r="${r - 0.2}" fill="${Ink}"/>` +
            `<g transform="${IconPlacement[icon]}">${iconMarkup(icon, Paper)}</g>` +
            `<text y="7.4" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="6.6" font-weight="800" fill="${Paper}">+${bonus}</text>` +
            '</svg>'
    )
}

function iconMarkup(icon: RevenueIcon, ink: string): string {
    return icon === 'skyline'
        ? `<g fill="none" stroke="${ink}">${SkylineMarkup}</g>`
        : tileSymbolMarkup(icon, ink)
}
