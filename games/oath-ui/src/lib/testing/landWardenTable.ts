import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    OathType,
    PlayerStatus,
    PowerTiming,
    Region,
    Search,
    SearchSource,
    allMapSlots,
    mapSlotsFor,
    powerIndexOf
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

export const LAND_WARDEN = 'denizen.hearth.land-warden'
export const WOLVES = 'denizen.beast.wolves'
export const RANGERS = 'denizen.beast.rangers'
export const LONGBOWS = 'denizen.order.longbows'
export const INN = 'denizen.hearth.wayside-inn'
export const WRESTLERS = 'denizen.order.wrestlers'

/**
 * R-5.1.4.II, Land Warden — round 3, Dana's Act Phase. Dana (an Exile) holds Land Warden, Wolves and Rangers
 * faceup, 3 of 3, and stands at the Plains (capacity 3, empty), which they rule with one warband. Rhys is the
 * Chancellor and Oathkeeper, at the River. Dana searches the world deck with Land Warden declared and draws the
 * Wayside Inn (played only to a site), Longbows and Wrestlers.
 */
export function landWardenSecondAdviser(): PlayedTable {
    const [plains, river] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: plains,
                favor: 3,
                secrets: 2,
                supply: 6,
                warbandsOnBoard: { Dana: 3 },
                warbandsInPersonalBank: { Dana: 10 },
                advisers: [LAND_WARDEN, WOLVES, RANGERS].map((cardId) => ({
                    cardId,
                    faceUp: true
                }))
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: river,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 18 }
            })
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'Rhys',
            round: 3,
            machineState: MachineState.ActPhase,
            map: allMapSlots(),
            denizensBySite: { [plains]: [], [river]: [] },
            warbandsBySite: { [plains]: { Dana: 1 }, [river]: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { [plains]: 'site.plains', [river]: 'site.river' },
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'Rhys'
        }
    )
    openTurn(state, 'Dana')
    const vault = state.requireVault()
    vault.worldDeck = [INN, LONGBOWS, WRESTLERS, ...vault.worldDeck]
    const table = tableOf(state)
    return played(table, [
        createAction(Search, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            playerId: 'Dana',
            drawFrom: SearchSource.WorldDeck,
            modifiers: [
                {
                    cardId: LAND_WARDEN,
                    powerIndex: powerIndexOf(LAND_WARDEN, PowerTiming.Modifier)
                }
            ]
        })
    ])
}
