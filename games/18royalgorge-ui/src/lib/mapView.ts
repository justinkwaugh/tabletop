import { assertExists } from '@tabletop/common'
import RGLogo from './images/logos/RG.svg'
import SFLogo from './images/logos/SF.svg'
import KPLogo from './images/logos/KP.svg'
import SPPLogo from './images/logos/SPP.svg'
import PAVLogo from './images/logos/PAV.svg'
import NOLogo from './images/logos/NO.svg'
import CMLogo from './images/logos/CM.svg'
import SLogo from './images/logos/S.svg'
import FCCLogo from './images/logos/FCC.svg'
import CSCCLogo from './images/logos/CSCC.svg'
import CSLogo from './images/logos/CS.svg'
import CFILogo from './images/logos/CFI.svg'
import VGCLogo from './images/logos/VGC.svg'
import MineArt from './images/tokens/mine.svg'
import GoldArt from './images/tokens/gold.svg'
import GhostTownArt from './images/tokens/ghost-town.svg'
import StCloudArt from './images/tokens/st-cloud.svg'
import {
    BrownGorgeTileIds,
    GoldMines,
    GreenGorgeTileIds,
    GhostTownBonus,
    GoldBonus,
    GorgeEastId,
    GorgeLocationIds,
    GorgeTownId,
    GorgeWestId,
    MapRoyalGorge,
    SpecialTileIds,
    StCloudBonus,
    StCloudId,
    TileSetRoyalGorge,
    TitleRulesRoyalGorge,
    privateCompanyHolder,
    mapStateRoyalGorge,
    requireStateRoyalGorge,
    stCloudLocation
} from '@tabletop/18royalgorge'
import type { TileEdge } from '@tabletop/18xx'
import {
    StandardTileLayouts,
    moneyFormat,
    type MapMarkerArt,
    type MapViewDefinition,
    type StateMarker
} from '@tabletop/18xx-ui'
import { CompanyNamesRoyalGorge } from './companyPresentation.js'
import { PhaseColorsRoyalGorge } from './trainPresentation.js'

/**
 * Company colours, the two greens, the two blacks and KP's gray apart from CF&I's toned so each
 * reads as its own.
 */
export const CompanyColorsRoyalGorge: Readonly<Record<string, string>> = {
    RG: '#d81e3e',
    SF: '#6a2c91',
    KP: '#8a8a8a',
    SPP: '#f48221',
    PAV: '#1660b0',
    NO: '#141414',
    CM: '#1d6e35',
    S: '#ffffff',
    FCC: '#ffe11a',
    CSCC: '#8cc63f',
    CS: '#3b3f4a',
    CFI: '#5a6a78',
    VGC: '#d9a91a'
}

function companyInitials(companyId: string): string {
    const names = CompanyNamesRoyalGorge[companyId]
    assertExists(names, `Company ${companyId} has its names`)
    return names.initials
}

const Logos: Readonly<Record<string, string>> = {
    RG: RGLogo,
    SF: SFLogo,
    KP: KPLogo,
    SPP: SPPLogo,
    PAV: PAVLogo,
    NO: NOLogo,
    CM: CMLogo,
    S: SLogo,
    FCC: FCCLogo,
    CSCC: CSCCLogo,
    CS: CSLogo,
    CFI: CFILogo,
    VGC: VGCLogo
}

/** A hex's mines, gold cubes and markers, each its own kind so each keeps its place. */
const mineKind = (index: number) => `mine-${index + 1}`
const goldKind = (index: number) => `gold-${index + 1}`
export const GhostTownKind = 'ghost-town'
export const StCloudKind = 'st-cloud'
const MostPerHex = Math.max(...Object.values(GoldMines))
const Slots = Array.from({ length: MostPerHex }, (_, index) => index)

const token = (imageUrl: string): MapMarkerArt => ({ token: { imageUrl, place: 'corner' } })

/**
 * The printed mines until a tile covers them, the gold cubes their first yellow tile brought,
 * the ghost towns, and the St. Cloud Hotel while a railroad owns it (GO-1, Y2, Y1).
 */
export function stateMarkersRoyalGorge(state: object): StateMarker[] {
    const title = requireStateRoyalGorge(state)
    const map = mapStateRoyalGorge(title)
    const mines = Object.entries(GoldMines).flatMap(([locationId, count]) => {
        if (map.tile(locationId).placement) return []
        return Slots.slice(0, count).map((index) => ({ locationId, kind: mineKind(index) }))
    })
    const gold = Object.entries(title.goldCubes).flatMap(([locationId, count]) =>
        Slots.slice(0, count).map((index) => ({ locationId, kind: goldKind(index) }))
    )
    const ghosts = title.ghostTowns.map((locationId) => ({ locationId, kind: GhostTownKind }))
    const hotel = privateCompanyHolder(title, StCloudId)
        ? [{ locationId: stCloudLocation(title.phaseId), kind: StCloudKind }]
        : []
    return [...mines, ...gold, ...ghosts, ...hotel]
}

const money = moneyFormat(TitleRulesRoyalGorge.currencySymbol)

/** The gorge's three hexes print as one area, joined across these sides. */
const GorgeJoinedEdges: Readonly<Record<string, readonly TileEdge[]>> = {
    [GorgeWestId]: [5],
    [GorgeTownId]: [2, 4],
    [GorgeEastId]: [1]
}
const gorgeJoins = (
    tileIds: Readonly<Record<string, string>>
): Readonly<Record<string, readonly TileEdge[]>> =>
    Object.fromEntries(
        Object.entries(GorgeJoinedEdges).map(([locationId, edges]) => [tileIds[locationId], edges])
    )

const spikeValues = (y: number) => ({
    revenuePositions: { offboard: { x: 0, y } },
    revenueStack: 'row' as const
})

export const MapViewRoyalGorge: MapViewDefinition = {
    map: MapRoyalGorge,
    tileSet: TileSetRoyalGorge,
    boardAreas: {
        market: { x: -76, y: -200, width: 1020, height: 122 },
        depot: { x: 960, y: -200, width: 381, height: 187 },
        panel: { x: 1120, y: 120, width: 380, height: 360 }
    },
    stations: Object.fromEntries(
        Object.entries(CompanyColorsRoyalGorge).map(([companyId, color]) => [
            companyId,
            {
                label: companyInitials(companyId),
                color,
                imageUrl: Logos[companyId]
            }
        ])
    ),
    terrainCostPrefix: TitleRulesRoyalGorge.currencySymbol,
    revenueStageColors: {
        yellow: PhaseColorsRoyalGorge.yellow,
        green: PhaseColorsRoyalGorge.green,
        brown: PhaseColorsRoyalGorge.brown,
        gray: PhaseColorsRoyalGorge.silver
    },
    // Each red area prints as one area across its hexes, as does the Royal Gorge.
    joinedEdges: {
        A3: [4],
        B2: [1],
        J2: [4],
        K1: [1, 5],
        L2: [2],
        O3: [0],
        O5: [3],
        O15: [0],
        O17: [3],
        C15: [0],
        C17: [3],
        ...GorgeJoinedEdges
    },
    joinedTileEdges: { ...gorgeJoins(GreenGorgeTileIds), ...gorgeJoins(BrownGorgeTileIds) },
    // The brown gorge is one tile across the gorge's three hexes (RG-1).
    tileGroups: [GorgeLocationIds],
    // Florence's and Fountain's home cities and the green gorge are laid by setup and the
    // Treaty, never from the supply (Rule 1, DB-1).
    boardTiles: Object.fromEntries(SpecialTileIds.map((id) => [id, {}])),
    nameTurns: { K1: -45 },
    hideLocationNames: ['A3', 'J2', 'L2', 'O3', 'O17', 'C15', GorgeWestId, GorgeEastId],
    layouts: {
        ...StandardTileLayouts,
        A3: spikeValues(-18),
        O3: spikeValues(-18),
        O17: spikeValues(18),
        C15: spikeValues(-16),
        K1: { revenuePositions: { city: { x: 26, y: 0 } }, revenueStack: 'column' },
        B2: { hideRevenue: true },
        O5: { hideRevenue: true },
        O15: { hideRevenue: true },
        C17: { hideRevenue: true },
        J2: { hideRevenue: true },
        L2: { hideRevenue: true }
    },
    markerArt: {
        ...Object.fromEntries(Slots.map((index) => [mineKind(index), token(MineArt)])),
        ...Object.fromEntries(Slots.map((index) => [goldKind(index), token(GoldArt)])),
        [GhostTownKind]: token(GhostTownArt),
        [StCloudKind]: token(StCloudArt)
    },
    stateMarkers: stateMarkersRoyalGorge,
    locationMarkerNames: {
        ...Object.fromEntries(
            Slots.map((index) => [
                mineKind(index),
                'Gold mine: its first yellow tile brings a gold cube'
            ])
        ),
        ...Object.fromEntries(
            Slots.map((index) => [
                goldKind(index),
                `Gold: a railroad running here may ship it for ${money(GoldBonus)}`
            ])
        ),
        [GhostTownKind]: `Ghost town: ${money(GhostTownBonus)} to the Ghost Town Tour Co.’s railroad for each run through it`,
        [StCloudKind]: `St. Cloud Hotel: ${money(StCloudBonus)} to its railroad’s trains stopping here`
    }
}
