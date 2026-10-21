import { Color } from '@tabletop/common'
import {
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    PlayerStatus,
    PowerTiming,
    Region,
    allMapSlots,
    mapSlotsFor,
    powerIndexOf,
    type HydratedOathGameState,
    type ModifierUse
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'

export const TENTS = 'denizen.nomad.tents'
export const FOREST_PATHS = 'denizen.beast.forest-paths'
export const PORTAL = 'denizen.arcane.portal'
export const WAY_STATION = 'denizen.nomad.way-station'
export const HOSPITALITY = 'denizen.nomad.hospitality'
export const COUNCIL_SEAT = 'denizen.order.council-seat'

/** A Travel card as the Travel declares it. */
export function travelCard(cardId: string): ModifierUse {
    return { cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) }
}

const [DROWNED_CITY, PLAINS] = mapSlotsFor(Region.Cradle)
const [WOOD, GREAT_SLUM, RIVER] = mapSlotsFor(Region.Provinces)
const [MOUNTAIN, HIDDEN_PLACE, WASTES] = mapSlotsFor(Region.Hinterland)

export const WOOD_SLOTS = {
    drownedCity: DROWNED_CITY,
    plains: PLAINS,
    wood: WOOD,
    greatSlum: GREAT_SLUM,
    river: RIVER,
    mountain: MOUNTAIN,
    hiddenPlace: HIDDEN_PLACE,
    wastes: WASTES
}

export interface WoodCardsScene {
    supply?: number
    favor?: number
    advisers?: string[]
}

/**
 * R-11.7 — Dana, an Exile, stands at the Shrouded Wood that Bea, another Exile (so an enemy), rules
 * with 2 warbands; the Portal is there. Ann, the Chancellor, rules the Great Slum (Way Station) with
 * an Imperial warband. Plains (Bracken) and The Hidden Place (Birdsong) are the Beast sites. Dana
 * holds 1 faceup secret and, by default, 3 Supply, 2 favor, Tents and Forest Paths.
 */
export function woodCardsState({
    supply = 3,
    favor = 2,
    advisers = [TENTS, FOREST_PATHS]
}: WoodCardsScene = {}): HydratedOathGameState {
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: WOOD,
                supply,
                favor,
                secrets: 1,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true })),
                warbandsOnBoard: { Dana: 3 }
            }),
            testPlayer({
                playerId: 'Bea',
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: MOUNTAIN,
                supply: 5,
                warbandsOnBoard: { Bea: 3 }
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: RIVER,
                supply: 5,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }
            })
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'Ann',
            map: allMapSlots(),
            siteCards: {
                [DROWNED_CITY]: 'site.drowned-city',
                [PLAINS]: 'site.plains',
                [WOOD]: 'site.shrouded-wood',
                [GREAT_SLUM]: 'site.great-slums',
                [RIVER]: 'site.river',
                [MOUNTAIN]: 'site.mountain',
                [HIDDEN_PLACE]: 'site.the-hidden-place',
                [WASTES]: 'site.wastes'
            },
            denizensBySite: {
                [DROWNED_CITY]: [],
                [PLAINS]: ['denizen.beast.bracken'],
                [WOOD]: [PORTAL],
                [GREAT_SLUM]: [WAY_STATION],
                [RIVER]: ['denizen.order.bear-traps'],
                [MOUNTAIN]: ['denizen.order.captains'],
                [HIDDEN_PLACE]: ['denizen.beast.birdsong'],
                [WASTES]: []
            },
            warbandsBySite: { [WOOD]: { Bea: 2 }, [GREAT_SLUM]: { [IMPERIAL_WARBANDS]: 1 } }
        }
    )
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    return state
}

/**
 * Dana with 1 Supply, 1 favor and `advisers`, no secret (so no Portal) and no Way Station on the
 * map (so the favor buys no site): without a card nothing is payable; Forest Paths frees the Beast sites.
 */
export function woodCardsLowState(advisers: string[] = [FOREST_PATHS]): HydratedOathGameState {
    const state = woodCardsState({ supply: 1, favor: 1, advisers })
    state.getPlayerState('Dana').secrets = 0
    state.denizensBySite = { ...state.denizensBySite, [GREAT_SLUM]: [] }
    return state
}

/**
 * R-11.7-H2 — Dana holds Hospitality (Nomad) and Council Seat (Order; an Exile may hold it) and sets
 * out from Bea's Wood, which holds no card. The River holds Bear Traps (Order) and Oracle (Nomad),
 * so the Order and Nomad banks both match there; the Mountain's Captains (Order) match one.
 */
export function woodHospitalityState(): HydratedOathGameState {
    const state = woodCardsState({ advisers: [HOSPITALITY, COUNCIL_SEAT] })
    state.denizensBySite = {
        ...state.denizensBySite,
        [WOOD]: [],
        [RIVER]: ['denizen.order.bear-traps', 'denizen.nomad.oracle']
    }
    return state
}
