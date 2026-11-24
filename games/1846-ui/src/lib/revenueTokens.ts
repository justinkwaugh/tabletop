import {
    BoomtownLocation,
    MeatPackingLocations,
    RevenueSymbolMarkers,
    boomtownInPlay,
    revenueMarkerValue,
    type HydratedEighteenFortySixState,
    type RevenuePrivateId
} from '@tabletop/1846'
import {
    skylineMarkup,
    svgDataUrl,
    tileSymbolMarkup,
    type LocationMarkerArt,
    type MapMarkerArt,
    type TileSymbolName,
    type TokenPlacement
} from '@tabletop/18xx-ui'

type MarkerState = Pick<HydratedEighteenFortySixState, 'revenueMarkers' | 'steamboat'>
type MarkerArtState = MarkerState & Parameters<typeof boomtownInPlay>[0]
type PlacedRevenueMarker = {
    privateCompanyId: RevenuePrivateId
    companyId: string
    locationId: string
}
// The icons 1846's revenue privates draw, each one of the family's tile symbols.
type RevenueIcon = Extract<TileSymbolName, 'port' | 'horns' | 'skyline'>

const ArtRadius = 10.5
const Ink = '#1d1b18'
const Paper = '#ffffff'

const RevenuePrivates: Readonly<
    Record<RevenuePrivateId, { name: string; icon: RevenueIcon; place: TokenPlacement }>
> = {
    SC: { name: 'Steamboat', icon: 'port', place: { covers: 'port' } },
    MPC: { name: 'Meat Packing', icon: 'horns', place: { covers: 'horns' } },
    BT: { name: 'Boomtown', icon: 'skyline', place: { covers: 'skyline' } }
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
 * Each placed marker's token, with its bonus where it stands, in place of the icons it covers,
 * and the symbols no private can use any more hidden.
 */
export function revenueTokenArt(state: MarkerArtState): LocationMarkerArt {
    const art: Record<string, Record<string, MapMarkerArt>> = {}
    const add = (locationId: string, markerId: string, markerArt: MapMarkerArt) => {
        art[locationId] = { ...art[locationId], [markerId]: markerArt }
    }
    for (const { locationId, markerId } of unusableSymbols(state))
        add(locationId, markerId, { hidden: true })
    for (const marker of placedRevenueMarkers(state))
        add(marker.locationId, revenueMarkerKind(marker.companyId, marker.privateCompanyId), {
            token: {
                imageUrl: tokenImage(
                    marker.privateCompanyId,
                    revenueMarkerValue(marker.privateCompanyId, marker.locationId)
                ),
                place: RevenuePrivates[marker.privateCompanyId].place
            }
        })
    return art
}

/**
 * Once Meat Packing's marker is down, its other location no longer shows the horns. The board
 * prints no skyline, so Cincinnati shows one only while Boomtown is in play.
 */
function unusableSymbols(state: MarkerArtState): { locationId: string; markerId: string }[] {
    const meatPacking = state.revenueMarkers.find((marker) => marker.privateCompanyId === 'MPC')
    return [
        ...(meatPacking
            ? MeatPackingLocations.filter((locationId) => locationId !== meatPacking.locationId)
            : []
        ).map((locationId) => ({ locationId, markerId: RevenueSymbolMarkers.MPC })),
        ...(boomtownInPlay(state)
            ? []
            : [{ locationId: BoomtownLocation, markerId: RevenueSymbolMarkers.BT }])
    ]
}

function tokenImage(privateCompanyId: RevenuePrivateId, bonus: number): string {
    const { icon } = RevenuePrivates[privateCompanyId]
    const r = ArtRadius
    return svgDataUrl(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-r} ${-r} ${r * 2} ${r * 2}">` +
            `<circle r="${r - 0.2}" fill="${Ink}"/>` +
            `<g transform="${IconPlacement[icon]}">${iconMarkup(icon)}</g>` +
            `<text y="7.4" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="6.6" font-weight="800" fill="${Paper}">+${bonus}</text>` +
            '</svg>'
    )
}

// The token's skyline keeps the finer line it was first drawn with.
const TokenSkylineStroke = 0.7
function iconMarkup(icon: RevenueIcon): string {
    return icon === 'skyline'
        ? skylineMarkup(Paper, TokenSkylineStroke)
        : tileSymbolMarkup(icon, Paper)
}
