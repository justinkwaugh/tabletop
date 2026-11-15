import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    IMPERIAL_WARBANDS,
    MachineState,
    PlayerStatus,
    Region,
    Search,
    SearchSource,
    allMapSlots,
    mapSlotsFor
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

export const SEARCH_DRAW = [
    'denizen.order.longbows',
    'denizen.hearth.tavern-songs',
    'vision.conquest'
] as const

/**
 * R-5.1.2 — Dana's Act Phase at Standing Stones with 5 Supply: a Search of the world deck (2 Supply,
 * no Vision drawn yet) draws Longbows, Tavern Songs and the Vision of Conquest, in that order.
 */
export function zoomPagingSearchTable(): PlayedTable {
    const [stones] = mapSlotsFor(Region.Cradle)
    const [plains] = mapSlotsFor(Region.Provinces)
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: stones,
                supply: 5,
                favor: 1,
                secrets: 1,
                warbandsInPersonalBank: { Dana: 10 }
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: plains,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 18 }
            })
        ],
        {
            chancellorPlayerId: 'Rhys',
            round: 2,
            machineState: MachineState.ActPhase,
            map: allMapSlots(),
            siteCards: { [stones]: 'site.standing-stones', [plains]: 'site.plains' },
            denizensBySite: { [stones]: [], [plains]: ['denizen.hearth.a-round-of-ale'] }
        }
    )
    openTurn(state, 'Dana')
    const vault = state.requireVault()
    const drawn: readonly string[] = SEARCH_DRAW
    vault.worldDeck = [...SEARCH_DRAW, ...vault.worldDeck.filter((id) => !drawn.includes(id))]
    const table = tableOf(state)
    return played(table, [
        createAction(Search, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            playerId: 'Dana',
            drawFrom: SearchSource.WorldDeck
        })
    ])
}
