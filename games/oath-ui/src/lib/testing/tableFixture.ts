import { mount, tick, unmount } from 'svelte'
import { ActionSource, Color, assertExists, createAction, range } from '@tabletop/common'
import {
    Banner,
    CampaignDefend,
    CampaignSacrifice,
    CampaignTargetKind,
    Campaign,
    HydratedCampaignSacrifice,
    HydratedOathGameState,
    EndActPhase,
    HydratedTravel,
    IMPERIAL_WARBANDS,
    LetPeek,
    LetPeekSubjectKind,
    MachineState,
    MoveWarbands,
    OathRevision,
    OfferCitizenship,
    OathType,
    PlayerStatus,
    PowerQuestionKind,
    Region,
    RerolledRollKind,
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
    reliquarySlotId,
    type CitizenshipTransfer,
    type OathPlayerState,
    type OathProjectedState,
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
    | 'leavingBuriedGiant'
    | 'warbandMoveAsked'
    | 'staleWarbandMoveAsked'
    | 'joinDefenceAsked'
    | 'exileDefeated'
    | 'imperialDefeated'
    | 'visionBacks'
    | 'restBanks'
    | 'restTurnFlow'
    | 'wakeMob'
    | 'wakeSite'
    | 'wakeForced'
    | 'endOfRound'
    | 'goalsRail'
    | 'goalsRailThePeople'
    | 'goalsRailProtection'
    | 'goalsRailDevotion'
    | 'trade'
    | 'careless'
    | 'musterEmptyBank'
    | 'recover'
    | 'peek'
    | 'relics'
    | 'searchToll'
    | 'advisers'
    | 'moves'
    | 'campaign'
    | 'observatory'
    | 'cardOpensSearch'
    | 'cardChangesSearch'
    | 'cardsOpenTravel'
    | 'travelToll'
    | 'majorEvents'
    | 'stackOrder'
    | 'sneakAttack'
    | 'citizenship'
    | 'citizenshipShort'
    | 'citizenshipNone'
    | 'citizenshipEnough'
    | 'freeTravel'
    | 'askedOffTurn'
    | 'defenderPlans'
    | 'oathkeeperChoice'
    | 'sneakAttackHeld'
    | 'searchTollByCole'
    | 'searchConspiracy'
    | 'campaignTwoDefenders'
    | 'battleDefenderPlans'
    | 'attackerPlans'
    | 'sacrifice'
    | 'sacrificeMixed'
    | 'wonOutright'
    | 'spoils'
    | QuestionTableName

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

/** Inquisitor found the Conspiracy among ann's advisers; ann holds a relic to take. */
function inquisitorTable(advisers: string[]): PlayedTable {
    return questionTable(
        {
            kind: PowerQuestionKind.PlayOrDiscardConspiracy,
            cardId: 'denizen.arcane.inquisitor',
            askedPlayerId: 'me',
            holderPlayerId: 'ann',
            index: 0
        },
        {
            me: { advisers: advisers.map((cardId) => ({ cardId, faceUp: true })) },
            ann: {
                advisers: [
                    { cardId: 'vision.conspiracy', faceUp: false },
                    { cardId: 'denizen.arcane.alchemist', faceUp: true }
                ],
                relicIds: ['relic.ring-of-devotion']
            }
        }
    )
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

type Seat = Parameters<typeof testPlayer>[0]

const RING = 'relic.ring-of-devotion'
const CUP = 'relic.cup-of-plenty'
const faceup = (cardId: string) => ({ cardId, faceUp: true })

/**
 * R-X.1 — a power's question put to this seat, asked by the Chancellor, both pawns at the top
 * Cradle site of a dealt board. `me` holds 4 favor and 2 secrets.
 */
function questionTable(
    question: PowerQuestion,
    seats: { me?: Partial<Seat>; ann?: Partial<Seat> } = {}
): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                favor: 4,
                secrets: 2,
                ...seats.me
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: home,
                favor: 3,
                ...seats.ann
            })
        ],
        {
            machineState: MachineState.PowerQuestion,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            pendingQuestions: {
                queue: [question],
                askingPlayerId: 'ann',
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    openTurn(state, 'ann')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

const asked = { askedPlayerId: 'me' } as const

/** R-7.3.3 — a Search kept Fabled Feast, whose When Played power asks for one favor bank of several. */
function fabledFeastTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                favor: 2,
                handIds: [
                    'denizen.hearth.fabled-feast',
                    'denizen.arcane.tutor',
                    'denizen.order.scouts'
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
            machineState: MachineState.Searching,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [] }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/** Each power question, as the asked seat sees it. */
const QUESTION_TABLES = {
    askRevelation: () =>
        questionTable({
            kind: PowerQuestionKind.BurnFavorForSecrets,
            cardId: 'denizen.arcane.revelation',
            ...asked
        }),
    askBlackmail: () =>
        questionTable(
            {
                kind: PowerQuestionKind.PayOrLoseRelic,
                cardId: 'denizen.discord.blackmail',
                ...asked,
                takerPlayerId: 'ann',
                relicCardId: RING,
                price: 3
            },
            { me: { relicIds: [RING] } }
        ),
    askHerald: () =>
        questionTable({
            kind: PowerQuestionKind.PickFavorBank,
            cardId: 'denizen.hearth.herald',
            ...asked,
            amount: 1
        }),
    askTinkersFair: () =>
        questionTable(
            {
                kind: PowerQuestionKind.Exchange,
                cardId: 'denizen.hearth.tinkers-fair',
                ...asked,
                proposerPlayerId: 'ann',
                terms: { fromProposer: { favor: 2 }, fromCounterparty: { relicCardIds: [RING] } }
            },
            { me: { relicIds: [RING] } }
        ),
    askGatheringJoin: () =>
        questionTable({
            kind: PowerQuestionKind.JoinSite,
            cardId: 'denizen.nomad.the-gathering',
            ...asked,
            siteId: mapSlotsFor(Region.Provinces)[0]
        }),
    askGatheringFloor: () =>
        questionTable({
            kind: PowerQuestionKind.GatheringFloor,
            cardId: 'denizen.nomad.the-gathering',
            ...asked,
            siteId: mapSlotsFor(Region.Cradle)[0]
        }),
    askHeirloom: () =>
        questionTable({
            kind: PowerQuestionKind.KeepOrBottomRelic,
            cardId: 'denizen.hearth.family-heirloom',
            ...asked,
            relicCardId: CUP
        }),
    askFaeMerchant: () =>
        questionTable(
            {
                kind: PowerQuestionKind.BottomRelic,
                cardId: 'denizen.beast.fae-merchant',
                ...asked,
                relicCardId: CUP
            },
            { me: { relicIds: [RING] } }
        ),
    askSkeletonKey: () =>
        questionTable({
            kind: PowerQuestionKind.TakeOrLeaveRelic,
            cardId: 'relic.skeleton-key',
            ...asked,
            slotId: 'reliquary.1',
            relicCardId: RING
        }),
    askJinx: () =>
        questionTable(
            {
                kind: PowerQuestionKind.RerollDice,
                cardId: 'denizen.arcane.jinx',
                ...asked,
                powerIndex: 0,
                roll: { kind: RerolledRollKind.GamblingHall, bank: Suit.Arcane, shields: 2 }
            },
            { me: { advisers: [faceup('denizen.arcane.jinx')] } }
        ),
    askRelicThief: () =>
        questionTable(
            {
                kind: PowerQuestionKind.RelicThiefRoll,
                cardId: 'denizen.discord.relic-thief',
                ...asked,
                powerIndex: 0,
                takerPlayerId: 'ann',
                relicCardIds: [RING]
            },
            { me: { advisers: [faceup('denizen.discord.relic-thief')] }, ann: { relicIds: [RING] } }
        ),
    askBrassHorse: () =>
        questionTable({
            kind: PowerQuestionKind.TravelFreeTo,
            cardId: 'relic.brass-horse',
            ...asked,
            siteIds: [
                ...mapSlotsFor(Region.Provinces).slice(0, 2),
                mapSlotsFor(Region.Hinterland)[0]
            ]
        }),
    askSneakAttack: () =>
        questionTable({
            kind: PowerQuestionKind.SneakAttack,
            cardId: 'denizen.discord.sneak-attack',
            ...asked,
            defenderPlayerId: 'ann'
        }),
    askInquisitor: () => inquisitorTable(['denizen.arcane.jinx', 'denizen.arcane.tutor']),
    // R-5.1.4.II — the finder already holds three advisers.
    askInquisitorAtLimit: () =>
        inquisitorTable(['denizen.hearth.herald', 'denizen.arcane.tutor', 'denizen.arcane.jinx']),
    askWildMounts: () =>
        questionTable(
            {
                kind: PowerQuestionKind.DiscardInstead,
                cardId: 'denizen.nomad.wild-mounts',
                ...asked,
                planCardIds: ['denizen.nomad.horse-archers', 'denizen.nomad.lancers'],
                insteadCardIds: ['denizen.beast.war-tortoise', 'denizen.beast.wolves'],
                actingPlayerId: 'me'
            },
            { me: { advisers: ['denizen.beast.war-tortoise', 'denizen.beast.wolves'].map(faceup) } }
        ),
    askPilgrimage: () =>
        questionTable({
            kind: PowerQuestionKind.OrderDrawnCards,
            cardId: 'denizen.nomad.pilgrimage',
            ...asked,
            region: Region.Provinces,
            cardCount: 3,
            cardIds: [
                'denizen.arcane.alchemist',
                'denizen.discord.assassin',
                'denizen.hearth.book-binders'
            ]
        }),
    askFalseProphet: () =>
        questionTable(prophet('vision.conquest'), {
            me: { advisers: PROPHET_ADVISERS.map((cardId) => ({ cardId, faceUp: false })) }
        }),
    fabledFeast: fabledFeastTable
} satisfies Record<string, () => PlayedTable>

export type QuestionTableName = keyof typeof QUESTION_TABLES

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

type WakeScene = 'mob' | 'site' | 'forced'

/**
 * R-4.1.1 to R-4.1.4: this seat's Wake at the Drowned City, which holds a secret. On the Mob side
 * it holds the People's Favor with the Discord and Order banks tied for least; at the site alone
 * it holds no banner; forced, the People's Favor holds 1 favor, so the one step is a Place, and
 * the site holds nothing to take.
 */
function wakeTable(scene: WakeScene): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const peoplesFavor = {
        mob: { value: 3, mobSide: true, holderPlayerId: 'me' },
        site: { value: 3, mobSide: false, holderPlayerId: 'ann' },
        forced: { value: 1, mobSide: false, holderPlayerId: 'me' }
    }[scene]
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, favor: 4 }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.WakePhase,
            chancellorPlayerId: 'ann',
            oathRevision: OathRevision.TurnFlow,
            map: allMapSlots(),
            siteCards: { ...fixtureSitesOnTheBoard(), [home]: 'site.drowned-city' },
            cardTokens: { 'site.drowned-city': { favor: 0, secrets: scene === 'forced' ? 0 : 1 } },
            banners: { ...testBanners(), [Banner.PeoplesFavor]: peoplesFavor },
            favorBank: { arcane: 2, beast: 2, discord: 1, hearth: 3, nomad: 2, order: 1 }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
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

/** R-11.12: this seat's Act Phase at the Buried Giant with a secret, so a destination has two ways to pay. */
function leavingBuriedGiantTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, supply: 3, secrets: 1 }),
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
            siteCards: { ...fixtureSitesOnTheBoard(), [home]: 'site.buried-giant' },
            denizensBySite: { [home]: [] }
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

const TRADE_BANKS: Record<Suit, number> = {
    [Suit.Discord]: 0,
    [Suit.Arcane]: 3,
    [Suit.Order]: 3,
    [Suit.Hearth]: 3,
    [Suit.Beast]: 3,
    [Suit.Nomad]: 3
}

/** Three denizens at the seat's site, one carrying favor, and two Hearth advisers. */
function tradeSiteTable(
    me: Partial<OathPlayerState> = {},
    over: Partial<OathProjectedState> = {},
    chancellor: 'me' | 'ann' = 'ann'
): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    // The Chancellor's pieces are purple; an Exile has no purple avatar.
    const seat = (playerId: 'me' | 'ann', exileColor: Color) =>
        playerId === chancellor
            ? { status: PlayerStatus.Chancellor, color: Color.Purple }
            : { status: PlayerStatus.Exile, color: exileColor }
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                ...seat('me', Color.Red),
                siteId: home,
                secrets: 1,
                favor: 3,
                advisers: [
                    { cardId: 'denizen.hearth.a-round-of-ale', faceUp: true },
                    { cardId: 'denizen.hearth.armed-mob', faceUp: true }
                ],
                ...me
            }),
            testPlayer({
                playerId: 'ann',
                ...seat('ann', Color.Blue),
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: chancellor,
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
            favorBank: TRADE_BANKS,
            ...over
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-5.3.2: the Discord bank empty. */
function tradeTable(): PlayedTable {
    return tradeSiteTable()
}

/** R-6.6.2.a: the seat is the Chancellor with Careless's Reliquary space uncovered, every bank holding favor. */
function carelessTable(): PlayedTable {
    return tradeSiteTable(
        {},
        {
            favorBank: { ...TRADE_BANKS, [Suit.Discord]: 3 },
            reliquary: [0, 1, 3].map((space) => ({ slotId: reliquarySlotId(space) }))
        },
        'me'
    )
}

/** R-5.2, R-9.3: the seat's warband bank is empty. */
function musterEmptyBankTable(): PlayedTable {
    return tradeSiteTable({ warbandsInPersonalBank: { me: 0 } })
}

/** R-5.4: a relic at the Ancient City, priced in favor, and both banners on the rail. */
function recoverTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const slotId = `${home}.relic.0`
    return tradeSiteTable(
        { favor: 4, secrets: 3 },
        {
            siteCards: { ...fixtureSitesOnTheBoard(), [home]: 'site.ancient-city' },
            relicsBySite: { [home]: [{ slotId }] },
            vault: testVaultWithRelics({ [slotId]: 'relic.cup-of-plenty' })
        }
    )
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

/** R-5.5.5 — the attacker's sacrifice after a won roll, against a defending force in two groups. */
function wonBattle(defence: 'exile' | 'imperial') {
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
    return state
}

/** R-5.5.6.a — a won battle whose defending force spans two groups, so the defending side chooses. */
function defeatedTable(defence: 'exile' | 'imperial'): PlayedTable {
    const table = tableOf(wonBattle(defence))
    return played(table, [
        createAction(CampaignSacrifice, { ...envelope(table), playerId: 'att', sacrifice: 0 })
    ])
}

/** R-5.5.3 — the defender answers with battle plans before anything is rolled, on the attacker's turn. */
function defenderPlansTable(): PlayedTable {
    const state = wonBattle('exile')
    const campaign = state.campaign
    assertExists(campaign, 'The battle is a Campaign')
    state.machineState = MachineState.CampaignPlans
    state.campaign = {
        ...campaign,
        attackRoll: [],
        defenseRoll: [],
        pendingDefenderPlans: { queue: ['def'] }
    }
    state.activePlayerIds = ['def']
    return tableOf(state)
}

/** Sneak Attack — the campaigner chooses a sacrifice while the defender's own turn is paused. */
function sneakAttackHeldTable(): PlayedTable {
    const state = wonBattle('exile')
    openTurn(state, 'def')
    state.heldTurn = { queue: [], askingPlayerId: 'def', resumeMachineState: MachineState.ActPhase }
    return tableOf(state)
}

/** R-X.1 — a card asks a seat whose turn it is not (Herald, during another seat's Act Phase). */
function askedOffTurnTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1'
            }),
            testPlayer({ playerId: 'dev', color: Color.Red, siteId: 'c2' })
        ],
        {
            machineState: MachineState.PowerQuestion,
            chancellorPlayerId: 'ann',
            pendingQuestions: {
                queue: [
                    {
                        kind: PowerQuestionKind.PickFavorBank,
                        cardId: 'denizen.hearth.herald',
                        askedPlayerId: 'ann',
                        amount: 1
                    }
                ],
                askingPlayerId: 'dev',
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    openTurn(state, 'dev')
    state.activePlayerIds = ['ann']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/** R-2.11.b — the outgoing Oathkeeper names the new holder during another seat's turn. */
function oathkeeperChoiceTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1'
            }),
            testPlayer({ playerId: 'dev', color: Color.Red, siteId: 'c2' }),
            testPlayer({ playerId: 'cal', color: Color.Blue, siteId: 'c2' })
        ],
        {
            machineState: MachineState.OathkeeperChoice,
            chancellorPlayerId: 'ann',
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'ann',
            pendingOathkeeperChoice: {
                holderPlayerId: 'ann',
                candidates: ['dev', 'cal'],
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    openTurn(state, 'dev')
    state.activePlayerIds = ['ann']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/**
 * R-5.5: the seat stands at the Chancellor's site, which the Empire rules, so the Chancellor is
 * the one defender; with the site unheld, the bandits may be attacked too.
 */
function campaignTable(imperialHeld = true): PlayedTable {
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
            warbandsBySite: imperialHeld ? { [site]: { [IMPERIAL_WARBANDS]: 2 } } : {}
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

type BattleStep =
    'defenderPlans' | 'attackerPlans' | 'sacrifice' | 'sacrificeMixed' | 'wonOutright' | 'spoils'

const WILD_MOUNTS = 'denizen.nomad.wild-mounts'
const HORSE_ARCHERS = 'denizen.nomad.horse-archers'

/**
 * R-5.5.3 to R-5.5.7 — one step of a Campaign the seat 'att' declared against the Exile 'def' at
 * the top Provinces site, which 'def' rules: the defender's plans, the attacker's plans after the
 * Citizens answered, the sacrifice (one group, two, or none needed) and the spoils.
 */
function battleTable(step: BattleStep): PlayedTable {
    const site = mapSlotId(Region.Provinces, 0)
    const mixed = step === 'sacrificeMixed'
    const rolled = {
        attackPool: 3,
        defensePool: 2,
        attackRoll: range(0, 3).map(() => ({ swords: 1, hollowSwords: 0, skulls: 0 })),
        defenseRoll: [
            { shields: 1, doubling: false },
            { shields: 1, doubling: false }
        ]
    }
    const battle = {
        defenderPlans: {},
        attackerPlans: {},
        sacrifice: { ...rolled, swords: 1, defense: 3 },
        sacrificeMixed: { ...rolled, swords: 1, defense: 2 },
        wonOutright: { ...rolled, swords: 3, defense: 2 },
        spoils: { ...rolled, swords: 3, defense: 2, attackerVictorious: true }
    }[step]
    const state = testState(
        [
            testPlayer({
                playerId: 'att',
                color: Color.Red,
                siteId: site,
                warbandsOnBoard: mixed ? { att: 4, [IMPERIAL_WARBANDS]: 1 } : { att: 4 },
                warbandsInPersonalBank: { att: 10 },
                advisers: [{ cardId: HORSE_ARCHERS, faceUp: true }]
            }),
            testPlayer({
                playerId: 'def',
                color: Color.Yellow,
                siteId: site,
                favor: 4,
                warbandsOnBoard: { def: 2 },
                warbandsInPersonalBank: { def: 10 },
                advisers: [{ cardId: WILD_MOUNTS, faceUp: true }]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Hinterland, 0)
            })
        ],
        {
            machineState: {
                defenderPlans: MachineState.CampaignPlans,
                attackerPlans: MachineState.CampaignPlans,
                sacrifice: MachineState.CampaignSacrifice,
                sacrificeMixed: MachineState.CampaignSacrifice,
                wonOutright: MachineState.CampaignSacrifice,
                spoils: MachineState.CampaignVictory
            }[step],
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            warbandsBySite: { [site]: { def: 1 } },
            banners: testBanners({ [Banner.PeoplesFavor]: 'def' }),
            pendingCampaign:
                step === 'attackerPlans'
                    ? {
                          declaration: {
                              attackerPlayerId: 'att',
                              defenderPlayerId: 'def',
                              targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
                              attackDice: 3,
                              plans: [],
                              forceSiteIds: [],
                              allyPlayerIds: [],
                              attackerSiteId: site
                          },
                          toAsk: ['def'],
                          awaitingAttackerPlans: true
                      }
                    : undefined,
            campaign:
                step === 'attackerPlans'
                    ? undefined
                    : {
                          attackerPlayerId: 'att',
                          defenderPlayerId: 'def',
                          nonImperialPlayerIds: [],
                          allyPlayerIds: [],
                          targets: [
                              { kind: CampaignTargetKind.Site, siteId: site },
                              { kind: CampaignTargetKind.Banner, banner: Banner.PeoplesFavor },
                              { kind: CampaignTargetKind.PawnAndFavor }
                          ],
                          attackPool: 3,
                          defensePool: 2,
                          attackRoll: [],
                          defenseRoll: [],
                          defense: 0,
                          swords: 0,
                          defendingForce: [
                              { at: { kind: 'site', siteId: site }, owner: 'def', count: 1 }
                          ],
                          defendingBandits: 0,
                          pendingDefenderPlans:
                              step === 'defenderPlans' ? { queue: ['def'] } : undefined,
                          ...campaignRecords(),
                          ...battle
                      }
        }
    )
    openTurn(state, 'att')
    state.activePlayerIds = [step === 'defenderPlans' ? 'def' : 'att']
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

/** R-7.1.4: Forced Labor at the seat's site, which the Chancellor rules, so a Search gives her 1 favor. */
function searchTollTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
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
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: ['denizen.order.forced-labor'] },
            warbandsBySite: { [home]: { [IMPERIAL_WARBANDS]: 2 } }
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

/**
 * R-7.1.4 — Toll Roads stands at the first Provinces site, which the Empire rules: travelling there
 * gives the Chancellor (ann) a favor. The seat is at the top Cradle site with Supply to spare.
 */
function travelTollTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const tolled = mapSlotId(Region.Provinces, 0)
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, supply: 6, favor: 3 }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Hinterland, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [], [tolled]: ['denizen.order.toll-roads'] },
            warbandsBySite: { [tolled]: { [IMPERIAL_WARBANDS]: 2 } }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

const STACKED_CARDS = [
    'denizen.order.longbows',
    'denizen.hearth.wayside-inn',
    'denizen.beast.wolves'
]

/** R-10.5: Pilgrimage asks the seat to stack three drawn cards onto the Cradle discard pile. */
function stackOrderTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1' }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1'
            })
        ],
        {
            machineState: MachineState.PowerQuestion,
            chancellorPlayerId: 'ann',
            pendingQuestions: {
                queue: [
                    {
                        kind: PowerQuestionKind.OrderDrawnCards,
                        cardId: 'denizen.nomad.pilgrimage',
                        askedPlayerId: 'me',
                        region: Region.Cradle,
                        cardCount: STACKED_CARDS.length,
                        cardIds: STACKED_CARDS
                    }
                ],
                askingPlayerId: 'me',
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/** R-7.1.4-H2: ann's Campaign against the seat ends, and the seat's Sneak Attack asks it to strike back. */
function sneakAttackTable(): PlayedTable {
    const site = mapSlotId(Region.Provinces, 0)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: site,
                warbandsOnBoard: { me: 4 },
                advisers: [{ cardId: 'denizen.discord.sneak-attack', faceUp: true }]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: site,
                supply: 6,
                warbandsOnBoard: { ann: 6 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [site]: [] }
        }
    )
    openTurn(state, 'ann')
    state.activePlayerIds = ['ann']
    state.vault = testVaultWithRelics({})
    const table = tableOf(state)
    const campaign = played(table, [
        createAction(Campaign, {
            ...envelope(table),
            playerId: 'ann',
            defender: { kind: 'player', playerId: 'me' },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
            attackDice: 0,
            plans: []
        })
    ])
    const defended =
        campaign.state.machineState === MachineState.CampaignPlans
            ? played(campaign, [
                  createAction(CampaignDefend, { ...envelope(table), playerId: 'me', plans: [] })
              ])
            : campaign
    const defeatKills = HydratedCampaignSacrifice.attackerDefeatKills(
        new HydratedOathGameState(defended.state),
        0
    )
    return played(defended, [
        createAction(CampaignSacrifice, {
            ...envelope(table),
            playerId: 'ann',
            sacrifice: 0,
            defeatKills
        })
    ])
}

const RELIQUARY_RELICS = [
    'relic.dowsing-sticks',
    'relic.oracular-pig',
    'relic.brass-horse',
    'relic.truthful-harp'
]

/** R-6.6.1: the seat is the Chancellor holding the Scepter, and ann is an Exile it may offer Citizenship. */
function citizenshipTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                relicIds: ['relic.grand-scepter']
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c2',
                favor: 2
            })
        ],
        { machineState: MachineState.ActPhase, chancellorPlayerId: 'me' }
    )
    state.reliquary = state.reliquary.map((slot, index) => ({
        ...slot,
        cardId: RELIQUARY_RELICS[index]
    }))
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/**
 * R-6.6.1, R-6.6.2, R-9.3 — the Chancellor offers the Exile Citizenship for 2 favor; the Exile has
 * three warbands on their board and two at Fertile Valley, and the Empire this many to replace them.
 */
function citizenshipOfferedTable(imperial: number, fromExile?: CitizenshipTransfer): PlayedTable {
    const valley = mapSlotId(Region.Cradle, 1)
    const state = testState(
        [
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0),
                favor: 4,
                relicIds: ['relic.grand-scepter'],
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: imperial }
            }),
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: valley,
                favor: 2,
                secrets: 2,
                warbandsOnBoard: { me: 3 },
                warbandsInPersonalBank: { me: 9 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: { ...fixtureSitesOnTheBoard(), [valley]: 'site.fertile-valley' },
            denizensBySite: { [valley]: [] },
            warbandsBySite: { [valley]: { me: 2 } }
        }
    )
    state.vault = testVaultWithRelics(
        Object.fromEntries(
            [
                'relic.book-of-records',
                'relic.brass-horse',
                'relic.cracked-horn',
                'relic.grand-mask'
            ].map((relicId, index) => [reliquarySlotId(index), relicId])
        )
    )
    openTurn(state, 'ann')
    state.activePlayerIds = ['ann']
    const table = tableOf(state)
    return played(table, [
        createAction(OfferCitizenship, {
            ...envelope(table),
            playerId: 'ann',
            exilePlayerId: 'me',
            reliquarySlotId: reliquarySlotId(0),
            terms: { fromScepterHolder: { favor: 2 }, fromExile }
        })
    ])
}

/** R-10.2: a granted free Travel is due, so only it, giving it up or ending the phase is offered. */
function freeTravelTable(): PlayedTable {
    const [home, next] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, supply: 3, favor: 3 }),
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
            denizensBySite: { [home]: ['denizen.hearth.wayside-inn'], [next]: [] }
        }
    )
    state.getPlayerState('me').freeTravelAtAction = state.actionCount
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-7.1.4: Cole rules this seat's site with Forced Labor, so a Search gives him a favor. */
function searchTollByColeTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, supply: 7, favor: 3 }),
            testPlayer({ playerId: 'cole', color: Color.Blue, siteId: home }),
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
            denizensBySite: { [home]: ['denizen.order.forced-labor'] },
            warbandsBySite: { [home]: { cole: 2 } },
            discardPileCounts: { cradle: 3, provinces: 0, hinterland: 0 },
            vault: testVaultWithDiscards({
                [Region.Cradle]: [
                    'denizen.hearth.book-binders',
                    'denizen.order.council-seat',
                    'denizen.beast.wolves'
                ]
            })
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-5.1.4.IV: the Conspiracy drawn by a Search, with Cole at this seat's site holding a relic. */
function searchConspiracyTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                secrets: 2,
                handIds: ['vision.conspiracy', 'denizen.arcane.tutor'],
                advisers: ['denizen.hearth.wayside-inn', 'denizen.hearth.awaited-return'].map(
                    (cardId) => ({ cardId, faceUp: true })
                )
            }),
            testPlayer({
                playerId: 'cole',
                color: Color.Blue,
                siteId: home,
                relicIds: ['relic.cup-of-plenty'],
                advisers: [{ cardId: 'denizen.hearth.salad-days', faceUp: true }]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0)
            })
        ],
        {
            machineState: MachineState.Searching,
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
    leavingBuriedGiant: leavingBuriedGiantTable,
    warbandMoveAsked: warbandMoveAskedTable,
    staleWarbandMoveAsked: staleWarbandMoveAskedTable,
    joinDefenceAsked: joinDefenceAskedTable,
    exileDefeated: () => defeatedTable('exile'),
    imperialDefeated: () => defeatedTable('imperial'),
    visionBacks: visionBacksTable,
    restBanks: restBanksTable,
    restTurnFlow: restTurnFlowTable,
    wakeMob: () => wakeTable('mob'),
    wakeSite: () => wakeTable('site'),
    wakeForced: () => wakeTable('forced'),
    endOfRound: endOfRoundTable,
    goalsRail: () => goalsRailTable(),
    goalsRailThePeople: () => goalsRailTable(OathType.ThePeople),
    goalsRailProtection: () => goalsRailTable(OathType.Protection),
    goalsRailDevotion: () => goalsRailTable(OathType.Devotion),
    trade: tradeTable,
    careless: carelessTable,
    musterEmptyBank: musterEmptyBankTable,
    recover: recoverTable,
    peek: peekTable,
    relics: relicsTable,
    searchToll: searchTollTable,
    advisers: advisersTable,
    moves: movesTable,
    campaign: campaignTable,
    observatory: observatoryTable,
    cardOpensSearch: () => mushroomsTable(1),
    cardChangesSearch: () => mushroomsTable(2),
    cardsOpenTravel: travelCardsTable,
    travelToll: travelTollTable,
    majorEvents: majorEventsTable,
    stackOrder: stackOrderTable,
    sneakAttack: sneakAttackTable,
    citizenship: citizenshipTable,
    citizenshipShort: () => citizenshipOfferedTable(3, { secrets: 1 }),
    citizenshipNone: () => citizenshipOfferedTable(0, { secrets: 1 }),
    citizenshipEnough: () => citizenshipOfferedTable(5),
    freeTravel: freeTravelTable,
    askedOffTurn: askedOffTurnTable,
    defenderPlans: defenderPlansTable,
    oathkeeperChoice: oathkeeperChoiceTable,
    sneakAttackHeld: sneakAttackHeldTable,
    searchTollByCole: searchTollByColeTable,
    searchConspiracy: searchConspiracyTable,
    campaignTwoDefenders: () => campaignTable(false),
    battleDefenderPlans: () => battleTable('defenderPlans'),
    attackerPlans: () => battleTable('attackerPlans'),
    sacrifice: () => battleTable('sacrifice'),
    sacrificeMixed: () => battleTable('sacrificeMixed'),
    wonOutright: () => battleTable('wonOutright'),
    spoils: () => battleTable('spoils'),
    ...QUESTION_TABLES
}

/** Every table a scenario can open. */
export function tableNames(): TableName[] {
    return Object.keys(TABLES).filter(isTableName)
}

function isTableName(name: string): name is TableName {
    return name in TABLES
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

export function questionPicks(): {
    visionDiscard?: string
    offered: string[]
    stacked: string[]
    queued: number
} {
    const table = current()
    return {
        visionDiscard: table.question.visionDiscard,
        offered: table.question.visionDiscards,
        stacked: table.question.stackTapped,
        queued: table.gameState.pendingQuestions?.queue.length ?? 0
    }
}

/** The kind of the question open on the table, if any. */
export function openQuestionKind(): PowerQuestionKind | undefined {
    return current().gameState.pendingQuestions?.queue[0]?.kind
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

/** R-5.6 — the destinations the engine accepts for the seat on screen's Travel, with no modifier declared. */
export function legalTravelDestinations(): string[] {
    const table = current()
    const seatId = table.myPlayer?.id
    assertExists(seatId, 'A seat is on the clock')
    return HydratedTravel.legalDestinations(table.gameState, seatId, [])
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
