import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    AnswerQuestion,
    Banner,
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerQuestionKind,
    PowerTiming,
    Search,
    SearchPlay,
    SearchResolve,
    SearchSource,
    powerIndexOf,
    type SearchResolveChoice
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

export const LAND_WARDEN = 'denizen.hearth.land-warden'
export const DAZZLE = 'denizen.arcane.dazzle'
export const LONGBOWS = 'denizen.order.longbows'
export const WRESTLERS = 'denizen.order.wrestlers'
export const SCOUTS = 'denizen.order.scouts'
export const INN = 'denizen.hearth.wayside-inn'
export const TENTS = 'denizen.nomad.tents'
export const ROWDY_PUB = 'denizen.hearth.rowdy-pub'
export const ROAR = 'denizen.beast.threatening-roar'
export const WOLVES = 'denizen.beast.wolves'
export const RANGERS = 'denizen.beast.rangers'
export const RIOTS = 'denizen.discord.riots'
export const STORYTELLER = 'denizen.hearth.storyteller'
export const PILGRIMAGE = 'denizen.nomad.pilgrimage'
const ELDERS = 'denizen.nomad.elders'

interface StackScene {
    revision?: OathRevision
    /** Dana's site. */
    danaAt?: string
    /** Dana's advisers, faceup; Land Warden among them is declared on the Search. */
    advisers: string[]
    denizensBySite: Record<string, string[]>
    /** The top of the world deck: the Search draws three. */
    deck: string[]
    /** The People's Favor on its Mob side (Riots). */
    mob?: boolean
    dispossessed?: string[]
    resolve: SearchResolveChoice
}

/**
 * Round 3, Dana's Act Phase: Dana (an Exile) searches the world deck, declaring Land Warden when they hold it, and
 * resolves the Search; the kept card's power asks the order of two cards going to one discard pile. Rhys is the
 * Chancellor, at Cradle 2.
 */
function stackScene({
    revision = CURRENT_OATH_REVISION,
    danaAt = 'c1',
    advisers,
    denizensBySite,
    deck,
    mob = false,
    dispossessed,
    resolve
}: StackScene): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: danaAt,
                favor: 4,
                secrets: 2,
                supply: 6,
                warbandsInPersonalBank: { Dana: 10 },
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
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
            oathRevision: revision,
            chancellorPlayerId: 'Rhys',
            round: 3,
            machineState: MachineState.ActPhase,
            denizensBySite: {
                c1: [],
                c2: [],
                p1: [],
                p2: [],
                p3: [],
                h1: [],
                h2: [],
                h3: [],
                ...denizensBySite
            },
            warbandsBySite: { [danaAt]: { Dana: 1 } },
            ...(mob
                ? {
                      banners: {
                          [Banner.PeoplesFavor]: { value: 1, mobSide: true },
                          [Banner.DarkestSecret]: { value: 1 }
                      }
                  }
                : {})
        }
    )
    openTurn(state, 'Dana')
    const vault = state.requireVault()
    vault.worldDeck = [...deck]
    if (dispossessed) {
        vault.dispossessed = [...dispossessed]
        state.dispossessedCount = dispossessed.length
    }
    const table = tableOf(state)
    const declared = advisers.includes(LAND_WARDEN)
        ? [{ cardId: LAND_WARDEN, powerIndex: powerIndexOf(LAND_WARDEN, PowerTiming.Modifier) }]
        : []
    return played(table, [
        createAction(Search, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            playerId: 'Dana',
            drawFrom: SearchSource.WorldDeck,
            modifiers: declared
        }),
        createAction(SearchResolve, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            playerId: 'Dana',
            ...resolve
        })
    ])
}

const LONGBOWS_SECOND: NonNullable<SearchResolveChoice['secondPlay']> = {
    cardId: LONGBOWS,
    play: SearchPlay.Adviser,
    faceUp: true,
    discardedAdviserCardIds: [TENTS]
}

/**
 * Land Warden, R-7.3.3: Dazzle, kept to Dana's site, discards Scouts and the Wayside Inn at Rhys's site to the
 * Provinces pile and asks their order. Longbows, played second to Dana's advisers at the limit, has already put
 * Tents on that pile when the question shows.
 */
export function landWardenStackTable(revision: OathRevision = CURRENT_OATH_REVISION): PlayedTable {
    return stackScene({
        revision,
        advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
        denizensBySite: { c2: [SCOUTS, INN] },
        deck: [DAZZLE, LONGBOWS, WRESTLERS],
        resolve: {
            keptCardId: DAZZLE,
            discardOrder: [WRESTLERS],
            play: SearchPlay.Site,
            secondPlay: LONGBOWS_SECOND
        }
    })
}

/** The same Search with no Land Warden: Dazzle kept, Longbows and the Wrestlers discarded by the Search. */
export function plainStackTable(): PlayedTable {
    return stackScene({
        advisers: [TENTS, ROWDY_PUB],
        denizensBySite: { c2: [SCOUTS, INN] },
        deck: [DAZZLE, LONGBOWS, WRESTLERS],
        resolve: { keptCardId: DAZZLE, discardOrder: [LONGBOWS, WRESTLERS], play: SearchPlay.Site }
    })
}

/** Land Warden below the adviser limit: Longbows second discards nothing. */
export function landWardenSecondDiscardsNothingTable(): PlayedTable {
    return stackScene({
        advisers: [LAND_WARDEN, ROWDY_PUB],
        denizensBySite: { c2: [SCOUTS, INN] },
        deck: [DAZZLE, LONGBOWS, WRESTLERS],
        resolve: {
            keptCardId: DAZZLE,
            discardOrder: [WRESTLERS],
            play: SearchPlay.Site,
            secondPlay: { cardId: LONGBOWS, play: SearchPlay.Adviser, faceUp: true }
        }
    })
}

/**
 * Riots kept with the People's Favor on its Mob side discards the Wayside Inn and Storyteller at Provinces 1 to the
 * Hinterland pile, while Longbows second puts Tents on the Provinces pile.
 */
export function landWardenOtherPileTable(): PlayedTable {
    return stackScene({
        mob: true,
        advisers: [LAND_WARDEN, TENTS, SCOUTS],
        denizensBySite: { p1: [INN, STORYTELLER] },
        deck: [RIOTS, LONGBOWS, WRESTLERS],
        resolve: {
            keptCardId: RIOTS,
            discardOrder: [WRESTLERS],
            play: SearchPlay.Site,
            secondPlay: LONGBOWS_SECOND
        }
    })
}

/** Threatening Roar kept to Dana's site discards itself and the Wolves at Rhys's; Longbows second discards Tents. */
export function landWardenRoarKeptTable(): PlayedTable {
    return stackScene({
        advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
        denizensBySite: { c2: [WOLVES] },
        deck: [ROAR, LONGBOWS, WRESTLERS],
        resolve: {
            keptCardId: ROAR,
            discardOrder: [WRESTLERS],
            play: SearchPlay.Site,
            secondPlay: LONGBOWS_SECOND
        }
    })
}

/**
 * Dazzle kept asks the order of Scouts and the Wayside Inn; Threatening Roar, second to Dana's advisers at the
 * limit, discards Tents and then asks the order of the Wolves and Rangers at Dana's site, behind Dazzle's question.
 * With `answered`, Dana has answered Dazzle's, so Roar's own is open.
 */
export function landWardenRoarSecondTable({ answered = false } = {}): PlayedTable {
    const table = stackScene({
        advisers: [LAND_WARDEN, TENTS, ROWDY_PUB],
        denizensBySite: { c1: [WOLVES, RANGERS], c2: [SCOUTS, INN] },
        deck: [DAZZLE, ROAR, WRESTLERS],
        resolve: {
            keptCardId: DAZZLE,
            discardOrder: [WRESTLERS],
            play: SearchPlay.Site,
            secondPlay: { ...LONGBOWS_SECOND, cardId: ROAR }
        }
    })
    if (!answered) return table
    return played(table, [
        createAction(AnswerQuestion, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            playerId: 'Dana',
            answer: { kind: PowerQuestionKind.OrderDiscards, order: [0, 1] }
        })
    ])
}

/**
 * Pilgrimage, kept to Dana's advisers in the Provinces, moves Scouts and the Wolves to the Dispossessed and draws two
 * back, to stack on the Provinces pile; Riots second, with the People's Favor on its Mob side, has already put the
 * Wayside Inn there.
 */
export function landWardenPilgrimageTable(
    revision: OathRevision = CURRENT_OATH_REVISION
): PlayedTable {
    return stackScene({
        revision,
        danaAt: 'p1',
        mob: true,
        advisers: [LAND_WARDEN],
        denizensBySite: { p1: [SCOUTS, WOLVES], c2: [INN], h1: [STORYTELLER] },
        deck: [PILGRIMAGE, RIOTS, WRESTLERS],
        dispossessed: [ELDERS, ROWDY_PUB, ROAR, TENTS, DAZZLE],
        resolve: {
            keptCardId: PILGRIMAGE,
            discardOrder: [WRESTLERS],
            play: SearchPlay.Adviser,
            faceUp: true,
            secondPlay: { cardId: RIOTS, play: SearchPlay.Site }
        }
    })
}
