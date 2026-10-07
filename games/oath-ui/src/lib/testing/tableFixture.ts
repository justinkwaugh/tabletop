import { mount, tick, unmount } from 'svelte'
import { ActionSource, Color, assertExists, createAction, range } from '@tabletop/common'
import {
    Banner,
    CampaignSacrifice,
    CampaignTargetKind,
    Campaign,
    EndActPhase,
    IMPERIAL_WARBANDS,
    LetPeek,
    LetPeekSubjectKind,
    MachineState,
    MoveWarbands,
    OathRevision,
    OathType,
    PlayerStatus,
    PowerQuestionKind,
    Region,
    Search,
    SearchPlay,
    SearchSource,
    SetupChoice,
    Suit,
    TOP_CRADLE_SLOT,
    Travel,
    WarbandMoveKind,
    allMapSlots,
    mapSlotId,
    mapSlotsFor,
    type PowerQuestion,
    type WarbandCounts,
    type WarbandGroup
} from '@tabletop/oath'
import {
    CRADLE,
    HINTERLAND,
    PROVINCES,
    campaignRecords,
    openTurn,
    testBanners,
    testPlayer,
    testState,
    testVaultWithDiscards,
    testVaultWithRelics
} from '@tabletop/oath/testing'
import GameTable from '$lib/components/GameTable.svelte'
import type { OathGameSession } from '$lib/model/session.svelte.js'
import {
    disposeSessions,
    openSessionOn,
    played,
    searchingTable,
    setupTable,
    tableOf,
    type PlayedTable
} from './sessionHarness.js'

export type TableName =
    | 'setup'
    | 'searching'
    | 'prophets'
    | 'offTurn'
    | 'actPhase'
    | 'warbandMoveAsked'
    | 'staleWarbandMoveAsked'
    | 'joinDefenceAsked'
    | 'exileDefeated'
    | 'imperialDefeated'
    | 'visionBacks'
    | 'restBanks'
    | 'restTurnFlow'
    | 'endOfRound'
    | 'goalsRail'
    | 'goalsRailThePeople'
    | 'goalsRailProtection'
    | 'goalsRailDevotion'
    | 'trade'
    | 'peek'
    | 'relics'
    | 'advisers'
    | 'moves'
    | 'campaign'
    | 'observatory'
    | 'cardOpensSearch'
    | 'cardChangesSearch'
    | 'cardsOpenTravel'
    | 'majorEvents'

const PROPHET_ADVISERS = [
    'denizen.order.messenger',
    'denizen.order.longbows',
    'denizen.hearth.herald'
]

function prophet(visionCardId: string): PowerQuestion {
    return {
        kind: PowerQuestionKind.PlayOrDiscardVision,
        cardId: 'denizen.discord.false-prophet',
        askedPlayerId: 'me',
        visionCardId
    }
}

/** Visual contract scenario 16: two False Prophet questions for one player, at the adviser limit. */
function prophetsTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                advisers: PROPHET_ADVISERS.map((cardId) => ({ cardId, faceUp: false }))
            }),
            testPlayer({
                playerId: 'holder',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2'
            })
        ],
        {
            machineState: MachineState.PowerQuestion,
            chancellorPlayerId: 'holder',
            pendingQuestions: {
                queue: [prophet('vision.conquest'), prophet('vision.faith')],
                askingPlayerId: 'holder',
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/** The let-peek coexistence rule off the clock: another seat's Act Phase, this seat holding a facedown adviser. */
function offTurnTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                advisers: [{ cardId: 'denizen.arcane.tutor', faceUp: false }]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1'
            })
        ],
        { machineState: MachineState.ActPhase, chancellorPlayerId: 'ann' }
    )
    openTurn(state, 'ann')
    state.activePlayerIds = ['ann']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/** R-9.4: another seat holds a facedown Vision among its advisers and a Vision in hand. */
function visionBacksTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1' }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                advisers: [
                    { cardId: 'vision.conquest', faceUp: false },
                    { cardId: 'denizen.arcane.tutor', faceUp: false }
                ],
                handIds: ['vision.conspiracy', 'denizen.order.scouts']
            })
        ],
        { machineState: MachineState.ActPhase, chancellorPlayerId: 'ann' }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/** R-4.3.5: a Rest with Vow of Obedience, whose power takes favor from a bank the player picks. */
function restBanksTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                advisers: [{ cardId: 'denizen.order.vow-of-obedience', faceUp: true }]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1'
            })
        ],
        { machineState: MachineState.RestPhase, chancellorPlayerId: 'ann' }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/** R-4.3.5, R-4.3-H1: the turn-flow Rest with Vow of Obedience and Insomnia, the Discord bank empty. */
function restTurnFlowTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                advisers: [
                    { cardId: 'denizen.order.vow-of-obedience', faceUp: true },
                    { cardId: 'denizen.discord.insomnia', faceUp: true }
                ]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1'
            })
        ],
        {
            machineState: MachineState.RestPhase,
            chancellorPlayerId: 'ann',
            oathRevision: OathRevision.TurnFlow,
            favorBank: { arcane: 3, beast: 2, discord: 0, hearth: 4, nomad: 1, order: 3 }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/** R-3.3, R-3.3-H1: the last seat of round six ends its Act Phase while the Chancellor holds the title. */
function endOfRoundTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1'
            }),
            testPlayer({ playerId: 'dev', color: Color.Yellow, siteId: 'c2' })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'ann',
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 } },
            round: 6,
            oathRevision: OathRevision.TurnFlow
        }
    )
    state.turnManager.turnOrder = ['ann', 'dev']
    openTurn(state, 'dev')
    state.activePlayerIds = ['dev']
    state.vault = testVaultWithRelics({})
    return played(tableOf(state), [
        createAction(EndActPhase, {
            gameId: state.gameId,
            source: ActionSource.User,
            playerId: 'dev'
        })
    ])
}

/** R-3: every live goal at once: a tied Oath held by the Chancellor, a revealed Vision, a Citizen. */
function goalsRailTable(oathType = OathType.Supremacy): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                revealedVisionId: 'vision.conquest'
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'p1'
            }),
            testPlayer({
                playerId: 'bo',
                color: Color.Yellow,
                status: PlayerStatus.Citizen,
                siteId: 'p2',
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 0, bo: 14 }
            }),
            testPlayer({ playerId: 'cy', color: Color.Blue, siteId: 'h1' })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            oathType,
            oathkeeperPlayerId: 'ann',
            // R-2.11 — under a banner Oath the title follows its banner.
            banners: testBanners({
                [Banner.PeoplesFavor]: oathType === OathType.ThePeople ? 'ann' : undefined,
                [Banner.DarkestSecret]: oathType === OathType.Devotion ? 'ann' : undefined
            }),
            warbandsBySite: {
                c1: { me: 1 },
                c2: { me: 1 },
                p1: { [IMPERIAL_WARBANDS]: 1 },
                p2: { [IMPERIAL_WARBANDS]: 1 },
                h1: { cy: 1 }
            }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

function envelope(table: PlayedTable) {
    return { gameId: table.state.gameId, source: ActionSource.User }
}

const FIXTURE_SITES: Record<Region, string[]> = {
    [Region.Cradle]: CRADLE,
    [Region.Provinces]: PROVINCES,
    [Region.Hinterland]: HINTERLAND
}

/** The board draws the engine's map slots, so the fixture sites are dealt onto them. */
function fixtureSitesOnTheBoard(): Record<string, string> {
    return Object.fromEntries(
        Object.values(Region).flatMap((region) =>
            mapSlotsFor(region).map((slotId, index) => [slotId, FIXTURE_SITES[region][index]])
        )
    )
}

/** This seat's Act Phase at the top Cradle site, which holds no card; the other Cradle site holds one. */
function actPhaseTable(): PlayedTable {
    const [home, next] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, favor: 3 }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0),
                advisers: [{ cardId: 'denizen.arcane.tutor', faceUp: false }]
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [], [next]: ['denizen.hearth.wayside-inn'] }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-5.1.2, R-2.11-H1: a world-deck Search stops on a Vision, and ruling a site takes the title from the Chancellor. */
function majorEventsTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, supply: 7 }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'ann',
            warbandsBySite: { [home]: { me: 1 } },
            oathRevision: OathRevision.TurnFlow
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    state.vault.worldDeck = [
        'denizen.hearth.wayside-inn',
        'vision.conquest',
        'denizen.order.wrestlers'
    ]
    return played(tableOf(state), [
        createAction(Search, {
            gameId: state.gameId,
            source: ActionSource.User,
            playerId: 'me',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true
        })
    ])
}

/** R-5.3.2: three denizens at the seat's site, one carrying favor, two Hearth advisers and an empty Discord bank. */
function tradeTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                secrets: 1,
                favor: 3,
                advisers: [
                    { cardId: 'denizen.hearth.a-round-of-ale', faceUp: true },
                    { cardId: 'denizen.hearth.armed-mob', faceUp: true }
                ]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: {
                [home]: [
                    'denizen.hearth.book-binders',
                    'denizen.order.council-seat',
                    'denizen.discord.assassin'
                ]
            },
            cardTokens: { 'denizen.order.council-seat': { favor: 1, secrets: 0 } },
            favorBank: {
                [Suit.Discord]: 0,
                [Suit.Arcane]: 3,
                [Suit.Order]: 3,
                [Suit.Hearth]: 3,
                [Suit.Beast]: 3,
                [Suit.Nomad]: 3
            }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-6.5.a — the Citizen asks to move two Imperial warbands off their site, so the Chancellor is asked. */
function warbandMoveAskedTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'cit',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { cit: 14 }
            }),
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'chan',
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 3 } }
        }
    )
    openTurn(state, 'cit')
    state.activePlayerIds = ['cit']
    const table = tableOf(state)
    return played(table, [
        createAction(MoveWarbands, {
            ...envelope(table),
            playerId: 'cit',
            move: { kind: WarbandMoveKind.SiteToBoard },
            owner: IMPERIAL_WARBANDS,
            count: 2
        })
    ])
}

/** The same request once the site holds one warband fewer, so the move would empty it (R-10.21). */
function staleWarbandMoveAskedTable(): PlayedTable {
    const table = warbandMoveAskedTable()
    table.state.warbandsBySite.c1 = { [IMPERIAL_WARBANDS]: 2 }
    return table
}

/** R-5.5.2.a — an Exile campaigns against the Chancellor with a Citizen's pawn in the battle. */
function joinDefenceAskedTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'att',
                color: Color.Red,
                siteId: 'c1',
                warbandsOnBoard: { att: 5 },
                warbandsInPersonalBank: { att: 9 }
            }),
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 18 }
            }),
            testPlayer({
                playerId: 'cit',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { cit: 14 }
            })
        ],
        { machineState: MachineState.ActPhase, chancellorPlayerId: 'chan' }
    )
    openTurn(state, 'att')
    state.activePlayerIds = ['att']
    const table = tableOf(state)
    return played(table, [
        createAction(Campaign, {
            ...envelope(table),
            playerId: 'att',
            defender: { kind: 'player', playerId: 'chan' },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
            attackDice: 3
        })
    ])
}

/** R-5.5.6.a — a won battle whose defending force spans two groups, so the defending side chooses. */
function defeatedTable(defence: 'exile' | 'imperial'): PlayedTable {
    const imperial = defence === 'imperial'
    const owner = imperial ? IMPERIAL_WARBANDS : 'def'
    const defendingForce: WarbandGroup[] = [
        { at: { kind: 'site', siteId: 'c1' }, owner, count: 2 },
        { at: { kind: 'board', playerId: imperial ? 'chan' : 'def' }, owner, count: 2 }
    ]
    const state = testState(
        [
            testPlayer({
                playerId: 'att',
                color: Color.Red,
                siteId: 'c1',
                warbandsOnBoard: { att: 4 },
                warbandsInPersonalBank: { att: 10 }
            }),
            testPlayer({
                playerId: 'def',
                color: imperial ? Color.Blue : Color.Yellow,
                status: imperial ? PlayerStatus.Citizen : PlayerStatus.Exile,
                siteId: 'c1',
                warbandsOnBoard: imperial ? {} : { def: 2 },
                warbandsInPersonalBank: { def: imperial ? 14 : 10 }
            }),
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: imperial ? 2 : 0 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 18 }
            })
        ],
        {
            machineState: MachineState.CampaignSacrifice,
            chancellorPlayerId: 'chan',
            warbandsBySite: { c1: { [owner]: 2 } },
            campaign: {
                attackerPlayerId: 'att',
                defenderPlayerId: 'def',
                nonImperialPlayerIds: [],
                allyPlayerIds: imperial ? ['chan'] : [],
                targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }],
                attackPool: 4,
                defensePool: 1,
                attackRoll: range(0, 4).map(() => ({ swords: 1, hollowSwords: 0, skulls: 0 })),
                defenseRoll: [{ shields: 1, doubling: false }],
                defense: 1,
                swords: 4,
                defendingForce,
                defendingBandits: 0,
                ...campaignRecords()
            }
        }
    )
    openTurn(state, 'att')
    state.activePlayerIds = ['att']
    const table = tableOf(state)
    return played(table, [
        createAction(CampaignSacrifice, { ...envelope(table), playerId: 'att', sacrifice: 0 })
    ])
}

/** R-5.5: the seat stands at the Chancellor's site, which the Empire rules. */
function campaignTable(): PlayedTable {
    const site = mapSlotId(Region.Provinces, 0)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: site,
                warbandsOnBoard: { me: 4 }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: site
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [site]: [] },
            warbandsBySite: { [site]: { [IMPERIAL_WARBANDS]: 2 } }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-6.5: the seat rules its site with three warbands there and four on its board. */
function movesTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                warbandsOnBoard: { me: 4 }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [] },
            warbandsBySite: { [home]: { me: 3 } }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-6.1: the seat's Act Phase with two facedown advisers to play. */
function advisersTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                advisers: [
                    { cardId: 'denizen.order.curfew', faceUp: false },
                    { cardId: 'denizen.nomad.elders', faceUp: false }
                ]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [] }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-6.3: two relics at the seat's site, the second already peeked by the seat. */
function peekTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const [first, second] = [`${home}.relic.0`, `${home}.relic.1`]
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                peekedRelicSlotIds: [second],
                peekedRelics: { [second]: 'relic.map' }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            relicsBySite: { [home]: [{ slotId: first }, { slotId: second }] },
            vault: testVaultWithRelics({ [first]: 'relic.cup-of-plenty', [second]: 'relic.map' })
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-5.4.1: the seat at the Ancient City, whose relic costs 3 favor placed in the Order bank, with the favor to pay. */
function relicsTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const relic = `${home}.relic.0`
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, favor: 3 }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: { ...fixtureSitesOnTheBoard(), [home]: 'site.ancient-city' },
            relicsBySite: { [home]: [{ slotId: relic }] },
            vault: testVaultWithRelics({ [relic]: 'relic.cup-of-plenty' })
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-7.4: the seat stands with the Observatory, the Cradle's pile empty and the others not. */
function observatoryTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, supply: 7 }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: ['denizen.arcane.observatory'] },
            discardPileCounts: { cradle: 0, provinces: 3, hinterland: 2 },
            vault: testVaultWithDiscards({
                [Region.Provinces]: [
                    'denizen.hearth.book-binders',
                    'denizen.order.council-seat',
                    'denizen.discord.assassin'
                ],
                [Region.Hinterland]: ['denizen.nomad.a-fast-steed', 'denizen.beast.wolves']
            })
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-7.4: the seat stands at Mushrooms with a secret to pay; a Search costs 2 Supply. */
function mushroomsTable(supply: number): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, supply, secrets: 3 }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: ['denizen.beast.mushrooms'] },
            discardPileCounts: { cradle: 2, provinces: 0, hinterland: 0 },
            vault: testVaultWithDiscards({
                [Region.Cradle]: ['denizen.hearth.book-binders', 'denizen.order.council-seat']
            })
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-7.4: no Supply to Travel with, and two advisers that each waive it. */
function travelCardsTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                supply: 0,
                favor: 2,
                advisers: [
                    { cardId: 'denizen.nomad.tents', faceUp: true },
                    { cardId: 'denizen.nomad.special-envoy', faceUp: true }
                ]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [] }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

const TABLES: Record<TableName, () => PlayedTable> = {
    setup: setupTable,
    searching: searchingTable,
    prophets: prophetsTable,
    offTurn: offTurnTable,
    actPhase: actPhaseTable,
    warbandMoveAsked: warbandMoveAskedTable,
    staleWarbandMoveAsked: staleWarbandMoveAskedTable,
    joinDefenceAsked: joinDefenceAskedTable,
    exileDefeated: () => defeatedTable('exile'),
    imperialDefeated: () => defeatedTable('imperial'),
    visionBacks: visionBacksTable,
    restBanks: restBanksTable,
    restTurnFlow: restTurnFlowTable,
    endOfRound: endOfRoundTable,
    goalsRail: () => goalsRailTable(),
    goalsRailThePeople: () => goalsRailTable(OathType.ThePeople),
    goalsRailProtection: () => goalsRailTable(OathType.Protection),
    goalsRailDevotion: () => goalsRailTable(OathType.Devotion),
    trade: tradeTable,
    peek: peekTable,
    relics: relicsTable,
    advisers: advisersTable,
    moves: movesTable,
    campaign: campaignTable,
    observatory: observatoryTable,
    cardOpensSearch: () => mushroomsTable(1),
    cardChangesSearch: () => mushroomsTable(2),
    cardsOpenTravel: travelCardsTable,
    majorEvents: majorEventsTable
}

let session: OathGameSession | undefined
let component: ReturnType<typeof mount> | undefined

function current(): OathGameSession {
    assertExists(session, 'A table is open')
    return session
}

async function settled(): Promise<void> {
    await tick()
    await current().waitForVisibleTransitionSettled()
    await new Promise(requestAnimationFrame)
}

export async function open(name: TableName): Promise<{ seatId: string | undefined }> {
    if (component) await unmount(component)
    disposeSessions()
    session = openSessionOn(TABLES[name]())
    const target = document.createElement('div')
    target.style.height = '100vh'
    document.body.replaceChildren(target)
    component = mount(GameTable, { target, props: { gameSession: session } })
    await settled()
    return { seatId: session.myPlayer?.id }
}

/** Another seat's Action arriving while this seat is mid-pick: a facedown adviser shown out of turn (R-9.4). */
export async function anotherSeatLetsPeek(): Promise<string> {
    const table = current()
    const seatId = table.myPlayer?.id
    const other = table.gameState.players.find(
        (player) => player.playerId !== seatId && player.advisers.some((row) => !row.faceUp)
    )
    assertExists(other, 'Another seat holds a facedown adviser')
    const adviserIds = other.adviserIds
    assertExists(adviserIds, 'A hotseat client holds every adviser')
    const cardId = adviserIds[other.advisers.findIndex((row) => !row.faceUp)]
    const toPlayerId = table.gameState.players.find(
        (player) => player.playerId !== other.playerId
    )?.playerId
    assertExists(toPlayerId, 'Someone can be shown it')
    await table.applyAction(
        createAction(LetPeek, {
            gameId: table.gameState.gameId,
            source: ActionSource.User,
            playerId: other.playerId,
            toPlayerId,
            subject: { kind: LetPeekSubjectKind.Adviser, cardId }
        })
    )
    await settled()
    return other.playerId
}

/** The Chancellor's setup choice at the top Cradle site, sent as its own client would send it (R-1.23). */
export async function seatMakesSetupChoice(): Promise<void> {
    const table = current()
    const seatId = table.myPlayer?.id
    assertExists(seatId, 'A seat is on the clock')
    const hand = table.gameState.getPlayerState(seatId).handIds
    assertExists(hand, 'The seat on the clock sees its hand')
    await table.applyAction(
        createAction(SetupChoice, {
            gameId: table.gameState.gameId,
            source: ActionSource.User,
            playerId: seatId,
            siteId: TOP_CRADLE_SLOT,
            adviserCardId: hand[0],
            discardOrder: hand.slice(1)
        })
    )
    await settled()
}

export function searchPicks(): { kept?: string; placement?: SearchPlay } {
    const search = current().search
    return { kept: search.kept, placement: search.placement?.play }
}

export function questionPicks(): { visionDiscard?: string; offered: string[]; queued: number } {
    const table = current()
    return {
        visionDiscard: table.question.visionDiscard,
        offered: table.question.visionDiscards,
        queued: table.gameState.pendingQuestions?.queue.length ?? 0
    }
}

export function viewOffTheClock(): string | undefined {
    const table = current()
    table.setViewingAsNonActivePlayer(true)
    return table.myPlayer?.id
}

export function letPeekState(): { open: boolean; staged: boolean; action?: string } {
    const table = current()
    return {
        open: table.letPeekOpen,
        staged: table.letPeekIsStaged,
        action: table.selection.action
    }
}

/** The seat on screen travels, sent as its own client would send it (R-5.6). */
export async function seatTravels(siteId: string): Promise<void> {
    const table = current()
    const seatId = table.myPlayer?.id
    assertExists(seatId, 'A seat is on the clock')
    await table.applyAction(
        createAction(Travel, {
            gameId: table.gameState.gameId,
            source: ActionSource.User,
            playerId: seatId,
            siteId
        })
    )
    await settled()
}

let heldSend: ((accepted: boolean) => void) | undefined

/** Keeps the next send in flight until `releaseSend` accepts or refuses it. */
export function holdNextSend(): void {
    const service = current().gameService
    const save = service.saveGameLocally.bind(service)
    service.saveGameLocally = async (input) => {
        service.saveGameLocally = save
        const accepted = await new Promise<boolean>((resolve) => {
            heldSend = resolve
        })
        if (!accepted) throw Error('The send was refused')
        await save(input)
    }
}

export function sendInFlight(): boolean {
    return heldSend !== undefined && current().processingActions
}

export async function releaseSend(accepted: boolean): Promise<void> {
    assertExists(heldSend, 'A send is held')
    heldSend(accepted)
    heldSend = undefined
    await settled()
}

/** A visible-state update under way, and its end with no new state shown. */
export async function setUpdatingVisibleState(updating: boolean): Promise<void> {
    current().updatingVisibleState = updating
    await tick()
}

export function tableFacts(): {
    seatId: string | undefined
    machineState: MachineState
    siteOf: Record<string, string | undefined>
    warbandsAt: Record<string, WarbandCounts>
    boardOf: Record<string, WarbandCounts>
    campaignUnderway: boolean
    staged: string | undefined
    favorOf: Record<string, number>
    favorBank: Record<Suit, number>
    secretsOn: Record<string, number>
} {
    const table = current()
    const state = table.gameState
    return {
        seatId: table.myPlayer?.id,
        machineState: state.machineState,
        siteOf: Object.fromEntries(state.players.map((player) => [player.playerId, player.siteId])),
        warbandsAt: state.warbandsBySite,
        boardOf: Object.fromEntries(
            state.players.map((player) => [player.playerId, player.warbandsOnBoard])
        ),
        campaignUnderway: state.campaign !== undefined,
        staged: table.selection.action,
        favorOf: Object.fromEntries(state.players.map((player) => [player.playerId, player.favor])),
        favorBank: state.favorBank,
        secretsOn: Object.fromEntries(
            Object.entries(state.cardTokens).map(([cardId, tokens]) => [cardId, tokens.secrets])
        )
    }
}

export function defeatPicks(): { required: number; picked: number[]; blockedBecause?: string } {
    const defeat = current().defeat
    return {
        required: defeat.required,
        picked: defeat.picked,
        blockedBecause: defeat.blockedBecause
    }
}

export function cardTokens(cardId: string): { favor: number; secrets: number } {
    return current().gameState.tokensOn(cardId)
}
