import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    Banner,
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    PlayerStatus,
    PowerQuestionKind,
    PowerTiming,
    Region,
    Suit,
    UseActionPower,
    allMapSlots,
    mapSlotId,
    mapSlotsFor,
    powerIndexOf
} from '@tabletop/oath'
import {
    CRADLE,
    HINTERLAND,
    PROVINCES,
    openTurn,
    testBanners,
    testPlayer,
    testState,
    testVaultWithRelics
} from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

const VOW = 'denizen.nomad.vow-of-kinship'
const PLAGUE_ENGINES = 'denizen.arcane.plague-engines'
const DISSENT = 'denizen.discord.dissent'

const FIXTURE_SITES: Record<Region, string[]> = {
    [Region.Cradle]: CRADLE,
    [Region.Provinces]: PROVINCES,
    [Region.Hinterland]: HINTERLAND
}

function sites(): Record<string, string> {
    return Object.fromEntries(
        Object.values(Region).flatMap((region) =>
            mapSlotsFor(region).map((slotId, index) => [slotId, FIXTURE_SITES[region][index]])
        )
    )
}

const RIVER = mapSlotId(Region.Cradle, 0)
const MOUNTAIN = mapSlotId(Region.Hinterland, 0)
const WOOD = mapSlotId(Region.Provinces, 2)

/**
 * Dana (an Exile) holds Vow of Kinship, so nothing is on their board and their favor is in the
 * Nomad bank (3). Bea is an Exile; Ann, the Chancellor.
 */
function kinshipSeats(bea: Record<string, unknown> = {}, dana: Record<string, unknown> = {}) {
    return [
        testPlayer({
            playerId: 'dana',
            color: Color.Red,
            siteId: RIVER,
            favor: 0,
            secrets: 1,
            advisers: [{ cardId: VOW, faceUp: true }],
            ...dana
        }),
        testPlayer({
            playerId: 'bea',
            color: Color.Yellow,
            siteId: WOOD,
            favor: 3,
            secrets: 3,
            ...bea
        }),
        testPlayer({
            playerId: 'ann',
            color: Color.Purple,
            status: PlayerStatus.Chancellor,
            siteId: mapSlotId(Region.Provinces, 0),
            favor: 3
        })
    ]
}

/**
 * Vow of Kinship's Q&A at the Wake: Dana holds the People's Favor at 1 with an empty board and
 * Nomad favor, so the place is offered and may be left (R-10.10-H1, R-4.1.1.I).
 */
export function kinshipWakeTable(): PlayedTable {
    const state = testState(kinshipSeats(), {
        machineState: MachineState.WakePhase,
        chancellorPlayerId: 'ann',
        oathRevision: CURRENT_OATH_REVISION,
        map: allMapSlots(),
        siteCards: sites(),
        banners: {
            ...testBanners(),
            [Banner.PeoplesFavor]: { value: 1, mobSide: false, holderPlayerId: 'dana' }
        }
    })
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/**
 * Bea uses Plague Engines, an adviser: Ann rules two sites with the Empire's warbands, Bea one, Dana
 * two. Ann and Bea pay from their boards; Dana's board pays nothing, so Dana is asked about 2.
 */
export function kinshipPlagueTable(): PlayedTable {
    const [slum, drowned] = [mapSlotId(Region.Provinces, 0), mapSlotId(Region.Provinces, 1)]
    const state = testState(
        kinshipSeats({ advisers: [{ cardId: PLAGUE_ENGINES, faceUp: true }] }),
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            oathRevision: CURRENT_OATH_REVISION,
            map: allMapSlots(),
            siteCards: sites(),
            warbandsBySite: {
                [slum]: { [IMPERIAL_WARBANDS]: 1 },
                [drowned]: { [IMPERIAL_WARBANDS]: 1 },
                [WOOD]: { bea: 1 },
                [RIVER]: { dana: 1 },
                [MOUNTAIN]: { dana: 1 }
            }
        }
    )
    state.turnManager.turnOrder = ['ann', 'bea', 'dana']
    openTurn(state, 'bea')
    state.activePlayerIds = ['bea']
    state.vault = testVaultWithRelics({})
    const table = tableOf(state)
    return played(table, [
        createAction(UseActionPower, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            playerId: 'bea',
            cardId: PLAGUE_ENGINES,
            powerIndex: powerIndexOf(PLAGUE_ENGINES, PowerTiming.Action)
        })
    ])
}

/**
 * Bea has played Dissent to their advisers: Ann holds the People's Favor and is skipped, Bea paid 2
 * from their board, and Dana, who rules Vow of Kinship (Nomad) and Bear Traps (Order), is asked
 * about the 2 their board could not pay.
 */
export function kinshipDissentTable(): PlayedTable {
    const state = testState(
        kinshipSeats({ favor: 1, advisers: [{ cardId: DISSENT, faceUp: true }] }),
        {
            machineState: MachineState.PowerQuestion,
            chancellorPlayerId: 'ann',
            oathRevision: CURRENT_OATH_REVISION,
            map: allMapSlots(),
            siteCards: sites(),
            denizensBySite: { [RIVER]: ['denizen.order.bear-traps'] },
            warbandsBySite: { [RIVER]: { dana: 1 } },
            cardTokens: { [DISSENT]: { favor: 2, secrets: 0 } },
            banners: {
                ...testBanners(),
                [Banner.PeoplesFavor]: { value: 2, mobSide: false, holderPlayerId: 'ann' }
            },
            pendingQuestions: {
                queue: [
                    {
                        kind: PowerQuestionKind.PayFromHomeBank,
                        cardId: DISSENT,
                        askedPlayerId: 'dana',
                        owed: 2
                    }
                ],
                askingPlayerId: 'bea',
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    state.favorBank[Suit.Nomad] = 3
    state.turnManager.turnOrder = ['ann', 'bea', 'dana']
    openTurn(state, 'bea')
    state.activePlayerIds = ['dana']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}
