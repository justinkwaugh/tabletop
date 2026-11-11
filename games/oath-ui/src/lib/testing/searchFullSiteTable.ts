import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    Banner,
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
import { openTurn, testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const ALCHEMIST = 'denizen.arcane.alchemist'
const LONGBOWS = 'denizen.order.longbows'
const WRESTLERS = 'denizen.order.wrestlers'

/**
 * R-5.1.4.I, Crop Rotation — round 3, Dana's Act Phase. Dana (an Exile) holds the People's Favor and Crop Rotation
 * faceup, and stands at the Plains (capacity 3), full with the Wolves, the Tents and Tavern Songs. The River
 * (capacity 2), in the same region, is full with Rowdy Pub and the Gambling Hall; Rhys is the Chancellor there.
 * Dana searches the world deck with Crop Rotation declared and draws Alchemist, Longbows and Wrestlers. With `room`,
 * the Plains holds only the Wolves and the Tents.
 */
export function searchFullSiteTable(room = false): PlayedTable {
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
                warbandsInPersonalBank: { Dana: 10 },
                advisers: [{ cardId: CROP_ROTATION, faceUp: true }]
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
            banners: testBanners({ [Banner.PeoplesFavor]: 'Dana' }),
            denizensBySite: {
                [plains]: [
                    'denizen.beast.wolves',
                    'denizen.nomad.tents',
                    ...(room ? [] : ['denizen.hearth.tavern-songs'])
                ],
                [river]: ['denizen.hearth.rowdy-pub', 'denizen.discord.gambling-hall']
            },
            warbandsBySite: { [river]: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { [plains]: 'site.plains', [river]: 'site.river' },
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'Rhys'
        }
    )
    openTurn(state, 'Dana')
    const vault = state.requireVault()
    vault.worldDeck = [ALCHEMIST, LONGBOWS, WRESTLERS, ...vault.worldDeck]
    const table = tableOf(state)
    return played(table, [
        createAction(Search, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            playerId: 'Dana',
            drawFrom: SearchSource.WorldDeck,
            modifiers: [
                {
                    cardId: CROP_ROTATION,
                    powerIndex: powerIndexOf(CROP_ROTATION, PowerTiming.Modifier)
                }
            ]
        })
    ])
}
