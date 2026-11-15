import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    Banner,
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    PlayerStatus,
    Search,
    SearchSource
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

export const RIOTS = 'denizen.discord.riots'
const ASSASSIN = 'denizen.discord.assassin'
const ZEALOTS = 'denizen.discord.zealots'
const INN = 'denizen.hearth.wayside-inn'
const STORYTELLER = 'denizen.hearth.storyteller'
const SCOUTS = 'denizen.order.scouts'
const TENTS = 'denizen.nomad.tents'

/**
 * Round 3, Dana's Act Phase. Dana (an Exile, red) is at Cradle 1; Rhys is the Chancellor at Cradle 2 and holds the
 * People's Favor, seized, so it is on its Mob side (R-2.5.3). The sites hold two Discord cards (the Assassin, the
 * Zealots) and two Hearth cards (the Wayside Inn, the Storyteller), with one Order and one Nomad card, so Discord and
 * Hearth tie for the most common suit. `facedown`: Dana holds Riots facedown among their advisers.
 */
function riotsTieState(facedown: boolean) {
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                favor: 4,
                secrets: 2,
                supply: 6,
                warbandsInPersonalBank: { Dana: 10 },
                advisers: facedown ? [{ cardId: RIOTS, faceUp: false }] : []
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2',
                favor: 2,
                secrets: 1,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 18 }
            })
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'Rhys',
            round: 3,
            machineState: MachineState.ActPhase,
            denizensBySite: {
                c1: [],
                c2: [],
                p1: [ASSASSIN, INN],
                p2: [ZEALOTS, STORYTELLER],
                p3: [SCOUTS],
                h1: [TENTS],
                h2: [],
                h3: []
            },
            warbandsBySite: { c1: { Dana: 1 } },
            banners: {
                [Banner.PeoplesFavor]: { value: 1, mobSide: true, holderPlayerId: 'Rhys' },
                [Banner.DarkestSecret]: { value: 1, mobSide: false }
            }
        }
    )
    openTurn(state, 'Dana')
    return state
}

/** R-5.1.4 — Dana searches the world deck and draws Riots, the Wrestlers and Longbows. */
export function riotsTieSearchTable(): PlayedTable {
    const state = riotsTieState(false)
    const vault = state.requireVault()
    vault.worldDeck = [
        RIOTS,
        'denizen.order.wrestlers',
        'denizen.order.longbows',
        ...vault.worldDeck
    ]
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

/** R-6.1 — Dana holds Riots facedown, to play it with "Turn faceup". */
export function riotsTieFacedownTable(): PlayedTable {
    const state = riotsTieState(true)
    state.activePlayerIds = ['Dana']
    return tableOf(state)
}
