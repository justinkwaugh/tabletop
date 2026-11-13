import {
    getCompany,
    hasTurnMark,
    laidTileFace,
    sameStopCounts,
    type ConstructionState,
    type TrackRules
} from '@tabletop/18xx'
import { major1822, minor1822 } from './companies.js'
import { layRestriction1822, londonConsentPlayerId1822 } from './layRestriction.js'
import { Map1822, OystermouthNodeId, SwanseaLocationId } from './map.js'
import {
    AdvancedLayMark,
    advancedColor1822,
    discountTokensSpent1822,
    spendDiscountTokens1822,
    terrainCost1822
} from './privatePowers.js'
import { requireState1822 } from './state.js'
import { TileColorOrder1822, TileSet1822 } from './tiles.js'
import { Phases1822 } from './trains.js'

const Yellow = 'yellow'

/** The tiles laid this turn, each as yellow track or an upgrade. */
function turnLays(state: ConstructionState): { yellow: number; upgrades: number } {
    const colors = (state.trackStep?.lays ?? []).map(
        (lay) => laidTileFace(state, TrackRules1822, lay).color
    )
    const yellow = colors.filter((color) => color === Yellow).length
    return { yellow, upgrades: colors.length - yellow }
}

/** The colours a company may lay as upgrades: a minor green only, a major whatever is available (§5.8.13). */
function upgradeColors(state: ConstructionState, minor: boolean): readonly string[] {
    const available = Phases1822.phase(state.phaseId).tileColors.filter((color) => color !== Yellow)
    return minor ? available.filter((color) => color === 'green') : available
}

export const TrackRules1822: TrackRules = {
    map: Map1822,
    tileSet: TileSet1822,
    colorOrder: TileColorOrder1822,
    availableColors: (state) => Phases1822.phase(state.phaseId).tileColors,
    // A minor company lays one tile a turn, yellow or from phase 3 a green upgrade. A major lays
    // one yellow tile in phase 2, and from phase 3 two yellow tiles or one upgrade (§5.8.13).
    allowance(state, color) {
        const companyId = state.trackStep?.companyId
        if (!companyId) return { reason: 'No company is laying track.' }
        const minor = getCompany(state, companyId).kind === 'minor'
        const { yellow, upgrades } = turnLays(state)
        // P11's early upgrade is the turn's track (Table 3).
        if (hasTurnMark(requireState1822(state), AdvancedLayMark))
            return { reason: 'The advanced tile lay was the turn’s track.' }
        if (upgrades) return { reason: 'An upgrade is the turn’s only tile.' }
        if (color !== Yellow) {
            if (yellow) return { reason: 'A turn lays yellow tiles or one upgrade, not both.' }
            // The colour P11 lays early is the turn's track like any upgrade (§3.1.13).
            return upgradeColors(state, minor).includes(color) ||
                color === advancedColor1822(requireState1822(state), companyId)
                ? { cost: 0 }
                : { reason: 'This company may not lay that colour.' }
        }
        const limit = minor || !Phases1822.isAtLeast(state.phaseId, '3') ? 1 : 2
        return yellow < limit ? { cost: 0 } : { reason: 'No yellow tile remains this turn.' }
    },
    preservesStops: sameStopCounts,
    // The first tile on the Swansea hex is a yellow city tile, which takes away the printed small
    // station and its track (§5.8.4).
    removedStops: (locationId, before) =>
        locationId === SwanseaLocationId && before.color === 'white' ? [OystermouthNodeId] : [],
    terrainCost: (state, request, cost) => terrainCost1822(state, request, cost),
    // A lay spends the discount tokens its company said it was using (Table 3: P8, P10).
    afterLay(state, details) {
        const placements = { ...state.tileInventory.placements }
        if (details.previous) placements[details.locationId] = details.previous
        else delete placements[details.locationId]
        const before = { ...state, tileInventory: { ...state.tileInventory, placements } }
        const spent = discountTokensSpent1822(before, details)
        spendDiscountTokens1822(state, details.companyId, spent)
        return { payments: [], closedPrivateIds: [] }
    },
    // Of the brown and grey city tiles with five and six exits, the six-exit tile is used where
    // it can be (§5.8.17).
    mostExits: (before) =>
        before.nodes.some((node) => node.kind === 'city') && !before.labels.length,
    // The Metropolitan Railway's home token and a destination token may stand beside a full city
    // (§5.10.3, §5.11.8).
    sharesFullCities: true,
    // A tile is laid on a company's home, or where some of its new track or its station is on
    // the company's route (§5.8.6).
    useful: ({ home, newTrack, connectedCity, connectedTown }) =>
        home || newTrack || connectedCity || connectedTown,
    homeLocations: (companyId) => {
        const major = major1822(companyId)
        if (major) return [major.home.locationId]
        const home = minor1822(companyId)?.home
        return home ? [home.locationId] : []
    },
    restriction: layRestriction1822,
    consentPlayerId: londonConsentPlayerId1822
}
