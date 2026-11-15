import {
    getCompany,
    hasTurnMark,
    laidTileFace,
    sameStopCounts,
    type ConstructionState,
    type TileFace,
    type TrackRequest,
    type TrackRules
} from '@tabletop/18xx'
import { major1822, minor1822 } from './companies.js'
import {
    layRestriction1822,
    londonConsentPlayerId1822,
    londonOtherConsentPlayerIds1822
} from './layRestriction.js'
import { Map1822, OystermouthNodeId, SwanseaLocationId } from './map.js'
import {
    AdvancedLayMark,
    advancedColor1822,
    discountTokensSpent1822,
    extraLaysEndedTrack1822,
    humberBridgeLaid1822,
    spendDiscountTokens1822,
    terrainCost1822
} from './privatePowers.js'
import { setupOf1822, type TurnLays1822 } from './scenarios.js'
import { requireState1822 } from './state.js'
import { TileColorOrder1822, TileSet1822, tileDefinition1822 } from './tiles.js'
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

/** A minor company lays one tile a turn: a yellow tile or an upgrade (§5.8.13). */
const MinorLays: readonly TurnLays1822[] = [
    { yellow: 1, upgrades: 0 },
    { yellow: 0, upgrades: 1 }
]

/**
 * The tiles a company may lay in one turn, as the mixes of yellow tiles and upgrades open to it
 * (§5.8.13; scenario pack, General sheet).
 */
function turnLaysOpen(state: ConstructionState, minor: boolean): readonly TurnLays1822[] {
    if (minor) return MinorLays
    const { early, later } = setupOf1822(requireState1822(state)).majorLays
    return Phases1822.isAtLeast(state.phaseId, '3') ? later : early
}

function isCityFace(face: TileFace): boolean {
    return face.nodes.some((node) => node.kind === 'city')
}

/** Where a turn makes two upgrades, as the Mini Game allows, neither is of a city (General sheet). */
function secondUpgradeRestriction(
    state: ConstructionState,
    request: TrackRequest
): string | undefined {
    const { face } = tileDefinition1822(request.definitionId)
    if (face.color === Yellow) return undefined
    const upgraded = (state.trackStep?.lays ?? [])
        .map((lay) => laidTileFace(state, TrackRules1822, lay))
        .filter((laid) => laid.color !== Yellow)
    return upgraded.length && [face, ...upgraded].some(isCityFace)
        ? 'Two upgrades in a turn are of track and small stations only.'
        : undefined
}

export const TrackRules1822: TrackRules = {
    map: Map1822,
    tileSet: TileSet1822,
    colorOrder: TileColorOrder1822,
    availableColors: (state) => Phases1822.phase(state.phaseId).tileColors,
    // A minor company lays one tile a turn, yellow or from phase 3 a green upgrade. A major lays
    // one yellow tile in phase 2, and from phase 3 two yellow tiles or one upgrade (§5.8.13); the
    // full-map scenarios let it lay more (§6.2.1).
    allowance(state, color) {
        const companyId = state.trackStep?.companyId
        if (!companyId) return { reason: 'No company is laying track.' }
        const minor = getCompany(state, companyId).kind === 'minor'
        const { yellow, upgrades } = turnLays(state)
        // P11's early upgrade is the turn's track (Table 3).
        if (hasTurnMark(requireState1822(state), AdvancedLayMark))
            return { reason: 'The advanced tile lay was the turn’s track.' }
        if (extraLaysEndedTrack1822(requireState1822(state)))
            return { reason: 'P12’s extra tiles followed the turn’s track, which is over.' }
        // So are P21's tiles across the Humber (Table 3).
        if (humberBridgeLaid1822(requireState1822(state)))
            return { reason: 'The Humber bridge was the turn’s track.' }
        // The colour P11 lays early is the turn's track like any upgrade (§3.1.13).
        if (
            color !== Yellow &&
            !upgradeColors(state, minor).includes(color) &&
            color !== advancedColor1822(requireState1822(state), companyId)
        )
            return { reason: 'This company may not lay that colour.' }
        const next = {
            yellow: yellow + (color === Yellow ? 1 : 0),
            upgrades: upgrades + (color === Yellow ? 0 : 1)
        }
        if (
            turnLaysOpen(state, minor).some(
                (allowed) => next.yellow <= allowed.yellow && next.upgrades <= allowed.upgrades
            )
        )
            return { cost: 0 }
        if (color === Yellow) return { reason: 'No yellow tile remains this turn.' }
        return {
            reason: upgrades
                ? 'No upgrade remains this turn.'
                : 'The yellow tiles laid leave no upgrade this turn.'
        }
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
    restriction: (state, request) =>
        layRestriction1822(state, request) ?? secondUpgradeRestriction(state, request),
    consentPlayerId: londonConsentPlayerId1822,
    otherConsentPlayerIds: londonOtherConsentPlayerIds1822
}
