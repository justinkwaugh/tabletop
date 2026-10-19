import { mount, tick, unmount } from 'svelte'
import {
    ActionSource,
    Color,
    assertExists,
    calculateActionChecksum,
    createAction,
    range,
    type GameAction
} from '@tabletop/common'
import {
    ActionType,
    AnswerQuestion,
    CardKind,
    Banner,
    CampaignDefend,
    CampaignSacrifice,
    CampaignTargetKind,
    Campaign,
    CURRENT_OATH_REVISION,
    ConsentRequestKind,
    HydratedCampaignSacrifice,
    HydratedOathGameState,
    EndActPhase,
    HydratedTravel,
    IMPERIAL_WARBANDS,
    LetPeek,
    LetPeekSubjectKind,
    isLetPeek,
    MachineState,
    MoveWarbands,
    OBSIDIAN_CAGE_ID,
    OathRevision,
    OfferCitizenship,
    OathType,
    PlayerStatus,
    PowerMoveKind,
    PowerQuestionKind,
    Region,
    RecoverTargetKind,
    RerolledRollKind,
    ResolveWake,
    Search,
    SearchPlay,
    SearchSource,
    SetupChoice,
    Suit,
    TOP_CRADLE_SLOT,
    Travel,
    UseActionPower,
    PowerChoiceKind,
    PowerTiming,
    powerIndexOf,
    WarbandMoveKind,
    allMapSlots,
    type WarbandMove,
    mapSlotId,
    mapSlotsFor,
    reliquarySlotId,
    type CitizenshipTerms,
    type CitizenshipTransfer,
    type LetPeekSubject,
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
    shortBankTable,
    tableOf,
    type PlayedTable
} from './sessionHarness.js'
import { shroudedWoodState } from './shroudedWoodTable.js'
import {
    FOREST_PATHS,
    HOSPITALITY,
    TENTS,
    woodCardsLowState,
    travelCard,
    woodCardsState,
    woodHospitalityState,
    type WoodCardsScene
} from './woodCardsTable.js'
import { woodPickTable } from './woodPicksTable.js'
import { heldAttackTable } from './heldAttackTable.js'
import { kinshipDissentTable, kinshipPlagueTable, kinshipWakeTable } from './kinshipTables.js'
import { RecordedStory } from './recordedStory.js'

export type TableName =
    | 'setup'
    | 'smallFriendsSites'
    | 'disguiseBorrowed'
    | 'shortBank'
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
    | 'restRefused'
    | 'kinshipSeat'
    | 'restTurnFlow'
    | 'wakeMob'
    | 'wakeMobReturn'
    | 'wakeSite'
    | 'wakeForced'
    | 'kinshipWake'
    | 'kinshipPlague'
    | 'kinshipDissent'
    | 'endOfRound'
    | 'goalsRail'
    | 'goalsRailThePeople'
    | 'goalsRailProtection'
    | 'goalsRailDevotion'
    | 'trade'
    | 'careless'
    | 'musterEmptyBank'
    | 'recover'
    | 'recoverSeen'
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
    | 'hospitality'
    | 'hospitalityToll'
    | 'hospitalityHiddenPlace'
    | 'majorEvents'
    | 'sinceLastTurn'
    | 'sinceLastTurnLong'
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
    | 'searchTollByRhys'
    | 'searchConspiracy'
    | 'searchConspiracyNoTake'
    | 'flipConspiracyNoTake'
    | 'campaignTwoDefenders'
    | 'heldAttack'
    | 'heldAttackKept'
    | 'heldAttackRerolled'
    | 'battleDefenderPlans'
    | 'battlePlanCosts'
    | 'attackerPlans'
    | 'sacrifice'
    | 'sacrificeMixed'
    | 'sacrificeSplit'
    | 'sacrificeShort'
    | 'sacrificeWhole'
    | 'wonOutright'
    | 'spoils'
    | 'spoilsRelicHunter'
    | QuestionTableName
    | 'warbandGiveAsked'
    | 'offerCitizenship'
    | 'offerCitizenshipToOne'
    | 'offerCitizenshipSilenced'
    | 'offerCitizenshipSelf'
    | 'everyMinor'
    | 'show'
    | 'harpSearch'
    | 'usePower'
    | ModifierScene
    | FacedownScene
    | 'greatHerdFlip'
    | 'showOne'
    | 'exileCitizens'
    | 'selfExile'
    | 'oathkeeperTie'
    | 'tavernSongs'
    | 'usurperWins'
    | 'deedWriter'
    | ExchangeScene
    | 'woodTraveller'
    | 'woodRuler'
    | 'woodRulerToll'
    | 'woodTollAsked'
    | 'woodCards'
    | 'woodCardsRuler'
    | 'woodCardsLow'
    | 'woodStays'
    | 'woodHospitality'
    | 'woodHospitalityAsked'
    | 'woodWayStationPick'
    | 'woodPickWhistle'
    | 'woodPickWhistleAway'
    | 'woodPickWhistleToll'
    | 'woodPickHorse'
    | 'woodPickPalanquin'
    | 'woodPickBanish'
    | 'horseOwnPick'
    | 'banditCrown'
    | 'banditCrownChancellor'
    | 'banditCrownExile'
    | 'banditCrownCampaign'
    | 'banditCrownFive'
    | 'tollAsked'
    | 'oracleToll'
    | 'oracleNoFavor'
    | 'campaignLossOrder'
    | 'skullLosses'
    | 'skullLossesTwoSites'
    | 'sacrificeInTwoPlaces'
    | 'freeTravelAsked'
    | 'freeCampaignAsked'
    | 'witchsBargain'
    | 'witchsBargainSilenced'
    | 'witchsBargainOneOther'
    | 'drumAsked'
    | 'drumAskedCitizen'
    | 'drumAfterToll'
    | 'drumAfterBrassHorse'
    | 'messenger'
    | 'messengerTwoOwners'
    | 'warningSignals'
    | PickerScene
    | PowerSitesScene
    | PickerTwoScene
    | 'historyAct'
    | 'historyCampaign'
    | 'historyDeals'

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
    seats: { me?: Partial<Seat>; ann?: Partial<Seat> } = {},
    board: { siteCards?: Record<string, string>; oathRevision?: number } = {}
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
            siteCards: { ...fixtureSitesOnTheBoard(), ...board.siteCards },
            oathRevision: board.oathRevision,
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

/**
 * R-10.13-H1 — Fae Merchant's question to Dana, an Exile, who drew the Cup of Plenty and holds the
 * Obsidian Cage, 2 Imperial warbands in it from beating Ann's force, and Ring of Devotion. Ann is
 * the Chancellor and Rhys a Citizen; with `bea`, Bea is a Citizen too: a third Imperial board.
 */
function faeMerchantCageTable(bea: boolean): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const seat = (playerId: string, color: Color, status: PlayerStatus) =>
        testPlayer({ playerId, color, status, siteId: home, favor: 2 })
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: home,
                favor: 4,
                secrets: 2,
                relicIds: [OBSIDIAN_CAGE_ID, RING],
                warbandsOnBoard: { dana: 3 }
            }),
            {
                ...seat('ann', Color.Purple, PlayerStatus.Chancellor),
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }
            },
            seat('rhys', Color.Blue, PlayerStatus.Citizen),
            ...(bea ? [seat('bea', Color.Yellow, PlayerStatus.Citizen)] : [])
        ],
        {
            machineState: MachineState.PowerQuestion,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            oathRevision: CURRENT_OATH_REVISION,
            warbandsOnCards: { [OBSIDIAN_CAGE_ID]: { [IMPERIAL_WARBANDS]: 2 } },
            pendingQuestions: {
                queue: [
                    {
                        kind: PowerQuestionKind.BottomRelic,
                        cardId: 'denizen.beast.fae-merchant',
                        askedPlayerId: 'dana',
                        relicCardId: CUP
                    }
                ],
                askingPlayerId: 'dana',
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

const asked = { askedPlayerId: 'me' } as const

const HIDDEN_PLACE = 'site.the-hidden-place'

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
    askFaeMerchantCage: () => faeMerchantCageTable(false),
    askFaeMerchantCageThree: () => faeMerchantCageTable(true),
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
    // R-11.13-H1 — The Hidden Place dealt to the second Cradle site, beside this seat's.
    askFlipToTravel: () =>
        questionTable(
            {
                kind: PowerQuestionKind.FlipToTravel,
                cardId: 'relic.whistle',
                ...asked,
                move: PowerMoveKind.Whistle,
                powerCardId: 'relic.whistle',
                moverPlayerId: 'ann',
                fromSiteId: mapSlotsFor(Region.Cradle)[0],
                siteId: mapSlotsFor(Region.Cradle)[1]
            },
            { ann: { relicIds: ['relic.whistle'], siteId: mapSlotsFor(Region.Cradle)[1] } },
            { siteCards: { [mapSlotsFor(Region.Cradle)[1]]: HIDDEN_PLACE } }
        ),
    askBrassHorseHidden: () =>
        questionTable(
            {
                kind: PowerQuestionKind.TravelFreeTo,
                cardId: 'relic.brass-horse',
                ...asked,
                siteIds: [mapSlotsFor(Region.Cradle)[1], mapSlotsFor(Region.Provinces)[0]]
            },
            { me: { relicIds: ['relic.brass-horse'] } },
            {
                siteCards: { [mapSlotsFor(Region.Cradle)[1]]: HIDDEN_PLACE },
                oathRevision: CURRENT_OATH_REVISION
            }
        ),
    // R-11.7-H3 — Ann picked Way Station's site for this seat's Travel out of the Shrouded Wood
    // here, and this seat can pay the Wood's 2 Supply or give Ann the favor.
    askWayStation: () =>
        questionTable(
            {
                kind: PowerQuestionKind.WayStationFavor,
                cardId: 'denizen.nomad.way-station',
                ...asked,
                payeeId: 'ann',
                chooserPlayerId: 'ann',
                fromSiteId: mapSlotsFor(Region.Cradle)[0],
                siteId: mapSlotsFor(Region.Cradle)[1],
                supplyCost: 2,
                travel: { free: false }
            },
            {},
            {
                siteCards: { [mapSlotsFor(Region.Cradle)[0]]: 'site.shrouded-wood' },
                oathRevision: CURRENT_OATH_REVISION
            }
        ),
    askHospitalityBank: () =>
        questionTable(
            {
                kind: PowerQuestionKind.HospitalityBank,
                cardId: HOSPITALITY,
                powerIndex: travelCard(HOSPITALITY).powerIndex,
                ...asked,
                siteId: mapSlotsFor(Region.Cradle)[1],
                banks: [Suit.Order, Suit.Nomad]
            },
            {},
            { oathRevision: CURRENT_OATH_REVISION }
        ),
    askSneakAttack: () =>
        questionTable({
            kind: PowerQuestionKind.SneakAttack,
            cardId: 'denizen.discord.sneak-attack',
            ...asked,
            defenderPlayerId: 'ann'
        }),
    askInquisitor: () => inquisitorTable(['denizen.arcane.jinx', 'denizen.arcane.tutor']),
    // R-5.1.4.IV — one adviser matches ann's suits, not two: no one here can be taken from.
    askInquisitorNoTake: () =>
        questionTable(
            {
                kind: PowerQuestionKind.PlayOrDiscardConspiracy,
                cardId: INQUISITOR,
                ...asked,
                holderPlayerId: 'ann',
                index: 0
            },
            {
                me: { secrets: 1, advisers: [...ONE_MATCH, INQUISITOR].map(faceup) },
                ann: {
                    advisers: [
                        { cardId: 'vision.conspiracy', faceUp: false },
                        ...ONE_MATCH_THEIRS.map(faceup)
                    ]
                }
            }
        ),
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
    // Enchantress's Q&A — ann swapped it for the Pied Piper that came to my three advisers by its Action.
    askEnchantressDiscard: () =>
        questionTable(
            {
                kind: PowerQuestionKind.DiscardAdvisers,
                cardId: 'denizen.discord.enchantress',
                ...asked,
                actingPlayerId: 'ann',
                count: 1,
                receivedCardIds: ['denizen.discord.enchantress'],
                receivedFacedownCardIds: []
            },
            {
                me: {
                    advisers: [
                        'denizen.beast.wolves',
                        'denizen.hearth.wayside-inn',
                        'denizen.order.scouts',
                        'denizen.discord.enchantress'
                    ].map(faceup)
                },
                ann: { advisers: [faceup('denizen.beast.pied-piper')] }
            }
        ),
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

/**
 * R-4.3.5, R-7.3.4: a Rest in a game created before the turn-flow revision with Vow of Obedience
 * and Vow of Poverty, while the seat has favor, so Vow of Poverty has nothing to take.
 */
function restRefusedTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                favor: 2,
                advisers: [
                    { cardId: 'denizen.order.vow-of-obedience', faceUp: true },
                    { cardId: 'denizen.beast.vow-of-poverty', faceUp: true }
                ]
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

/** An Exile whose favor Vow of Kinship keeps in the Nomad bank, for the open seat's words. */
function kinshipSeatTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                advisers: [{ cardId: 'denizen.nomad.vow-of-kinship', faceUp: true }]
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

type WakeScene = 'mob' | 'mobReturn' | 'site' | 'forced'

/**
 * R-4.1.1 to R-4.1.4: this seat's Wake at the Drowned City, which holds a secret. On the Mob side
 * it holds the People's Favor with the Discord and Order banks tied for least; at the site alone
 * it holds no banner; forced, the People's Favor holds 1 favor, so the one step is a Place, and
 * the site holds nothing to take. Mob, returning: the Order bank alone holds least, with the Discord
 * and Arcane banks one above it, so a first Return goes to Order and a second finds all three tied.
 */
function wakeTable(scene: WakeScene): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const peoplesFavor = {
        mob: { value: 3, mobSide: true, holderPlayerId: 'me' },
        mobReturn: { value: 3, mobSide: true, holderPlayerId: 'me' },
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
            favorBank:
                scene === 'mobReturn'
                    ? { arcane: 1, beast: 2, discord: 1, hearth: 3, nomad: 2, order: 0 }
                    : { arcane: 2, beast: 2, discord: 1, hearth: 3, nomad: 2, order: 1 }
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

/** R-2.11.b — on Rhys's turn the holder ("me") no longer rules the most sites; Rhys and Ann tie. */
function oathkeeperTieTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1'
            }),
            testPlayer({ playerId: 'rhys', color: Color.Red, siteId: 'p1' }),
            testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'h1' })
        ],
        {
            machineState: MachineState.OathkeeperChoice,
            chancellorPlayerId: 'me',
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'me',
            pendingOathkeeperChoice: {
                holderPlayerId: 'me',
                candidates: ['rhys', 'ann'],
                resumeMachineState: MachineState.ActPhase
            },
            warbandsBySite: {
                c1: { [IMPERIAL_WARBANDS]: 1 },
                p1: { rhys: 1 },
                p2: { rhys: 1 },
                h1: { ann: 1 },
                h2: { ann: 1 }
            }
        }
    )
    openTurn(state, 'rhys')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/** R-3.1 — an Exile wakes holding the Oathkeeper title on its Usurper side, and wins. */
function usurperWinsTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1' }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'p1'
            })
        ],
        {
            machineState: MachineState.WakePhase,
            chancellorPlayerId: 'ann',
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'me',
            oathkeeperIsUsurper: true,
            round: 4,
            warbandsBySite: { c1: { me: 1 }, c2: { me: 1 }, p1: { [IMPERIAL_WARBANDS]: 1 } }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    const table = tableOf(state)
    return played(table, [
        createAction(ResolveWake, { ...envelope(table), playerId: 'me', favorSteps: [] })
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

/**
 * Ann's turn opens after her last closed in round 4: Bea, an Exile, Searched the world deck and
 * stopped on a Vision (R-5.1.2); in round 5 Dana, the Chancellor holding the Grand Scepter, offered
 * Bea Citizenship and she accepted (R-6.6.1); Rhys seized the People's Favor from Dana in a
 * Campaign (R-5.5.2, R-2.5.3) and with it the title (R-2.11). Long: the Favor then went back and
 * forth once more, more rows than a phone's board holds.
 */
function sinceLastTurnTable(long: boolean): PlayedTable {
    const [cradle, slum] = mapSlotsFor(Region.Cradle)
    const [plains, saltFlats] = mapSlotsFor(Region.Provinces)
    const [mountain] = mapSlotsFor(Region.Hinterland)
    const hydrated = testState(
        [
            testPlayer({ playerId: 'ann', color: Color.Blue, siteId: slum, favor: 4, secrets: 2 }),
            testPlayer({ playerId: 'bea', color: Color.Yellow, siteId: mountain, favor: 1, secrets: 1 }),
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: plains,
                favor: 2,
                secrets: 1,
                relicIds: ['relic.grand-scepter']
            }),
            testPlayer({ playerId: 'rhys', color: Color.Red, siteId: plains, favor: 3, secrets: 2 })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            oathType: OathType.ThePeople,
            oathkeeperPlayerId: 'dana',
            round: 4,
            banners: {
                ...testBanners(),
                [Banner.PeoplesFavor]: { value: 3, mobSide: false, holderPlayerId: 'dana' }
            },
            warbandsBySite: { [cradle]: { [IMPERIAL_WARBANDS]: 2 }, [saltFlats]: { rhys: 2 } },
            oathRevision: OathRevision.TurnFlow
        }
    )
    hydrated.vault = testVaultWithRelics({})
    const state = hydrated.dehydrate()
    state.turnManager.turnOrder = ['ann', 'bea', 'dana', 'rhys']
    state.turnManager.series = [{ type: 'turn', playerId: 'ann', start: 0 }]
    state.activePlayerIds = ['ann']
    const seat = (table: OathProjectedState, playerId: string) => {
        const found = table.players.find((p) => p.playerId === playerId)
        assertExists(found, `${playerId} is seated`)
        return found
    }
    const toAct = (table: OathProjectedState) => {
        table.machineState = MachineState.ActPhase
    }
    const peoplesFavor =
        (holderPlayerId: string, value: number, mobSide: boolean) => (table: OathProjectedState) => {
            table.banners[Banner.PeoplesFavor] = { holderPlayerId, value, mobSide }
        }
    const seize = (story: RecordedStory, playerId: string, from: string) =>
        story.act(
            {
                type: ActionType.CampaignResolveVictory,
                playerId,
                placements: [],
                burnFavor: false,
                metadata: {
                    warbandsPlaced: 0,
                    relicsTaken: [],
                    bannersSeized: [Banner.PeoplesFavor],
                    seizeBurned: 2,
                    favorBurned: 0,
                    defenderPlayerId: from,
                    replacedCount: 0,
                    unreplacedCount: 0
                }
            },
            peoplesFavor(playerId, 1, true)
        )
    const story = new RecordedStory(state, 'news-')
        .act({ type: ActionType.EndActPhase, playerId: 'ann' }, (table) => {
            table.machineState = MachineState.RestPhase
        })
        .rest('ann', 'bea', toAct)
        .act(
            {
                type: ActionType.Search,
                playerId: 'bea',
                drawFrom: SearchSource.WorldDeck,
                revealsInfo: true,
                metadata: {
                    draw: {
                        drawnCardIds: ['vision.conquest'],
                        stoppedOnVision: true,
                        worldDeckExhausted: false
                    },
                    supplySpent: 2,
                    cardsDrawn: 1,
                    visionsDrawn: 1,
                    stoppedOnVision: true
                }
            },
            (table) => {
                table.visionsDrawn = 1
            }
        )
        .rest('bea', 'dana', (table) => {
            toAct(table)
            table.round = 5
        })
        .act({
            type: ActionType.OfferCitizenship,
            playerId: 'dana',
            exilePlayerId: 'bea',
            reliquarySlotId: reliquarySlotId(0),
            metadata: { resumeMachineState: MachineState.ActPhase }
        })
        .act(
            {
                type: ActionType.ResolveCitizenshipOffer,
                playerId: 'bea',
                granted: true,
                metadata: { granted: true, resumeMachineState: MachineState.ActPhase }
            },
            (table) => {
                seat(table, 'bea').status = PlayerStatus.Citizen
            }
        )
        .rest('dana', 'rhys', toAct)
    seize(story, 'rhys', 'dana').title('dana', 'rhys')
    if (long) {
        story
            .act(
                {
                    type: ActionType.Recover,
                    playerId: 'dana',
                    target: { kind: RecoverTargetKind.Banner, banner: Banner.PeoplesFavor },
                    amountPaid: 2,
                    metadata: { supplySpent: 1, amountPaid: 2 }
                },
                peoplesFavor('dana', 2, false)
            )
            .title('rhys', 'dana')
        seize(story, 'rhys', 'dana').title('dana', 'rhys')
    }
    story.rest('rhys', 'ann', toAct)
    // The session checks the state's count and checksum against the history it is given.
    return {
        state: { ...story.state, actionChecksum: calculateActionChecksum(0, story.actions) },
        actions: story.actions
    }
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

/** R-5.4, R-6.3: two relics at the Ancient City, the second already peeked by the seat, and both banners. */
function recoverSeenTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const [first, second] = [`${home}.relic.0`, `${home}.relic.1`]
    return tradeSiteTable(
        { favor: 6, secrets: 3, peekedRelicSlotIds: [second], peekedRelics: { [second]: 'relic.map' } },
        {
            siteCards: { ...fixtureSitesOnTheBoard(), [home]: 'site.ancient-city' },
            relicsBySite: { [home]: [{ slotId: first }, { slotId: second }] },
            vault: testVaultWithRelics({ [first]: 'relic.cup-of-plenty', [second]: 'relic.map' })
        }
    )
}

/** R-6.5.a — the Citizen asks to move two Imperial warbands off their site, so the Chancellor is asked. */
function warbandMoveAskedTable(): PlayedTable {
    return citizenAsksChancellor({ kind: WarbandMoveKind.SiteToBoard })
}

/** R-6.5.b — the Citizen asks to give the Chancellor, at the same site, two Imperial warbands. */
function warbandGiveAskedTable(): PlayedTable {
    return citizenAsksChancellor({ kind: WarbandMoveKind.GiveToImperial, otherPlayerId: 'chan' })
}

function citizenAsksChancellor(move: WarbandMove): PlayedTable {
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
            move,
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
 * the one defender; with the site unheld, the bandits may be attacked too. A board of two owners
 * is a game from before revision 5, which still declares the skulls' loss order.
 */
function campaignTable(imperialHeld = true, twoOwners = false): PlayedTable {
    const site = mapSlotId(Region.Provinces, 0)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: site,
                warbandsOnBoard: twoOwners ? { me: 3, [IMPERIAL_WARBANDS]: 1 } : { me: 4 }
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
function battleState(
    step: BattleStep,
    defenderAdvisers: string[] = [WILD_MOUNTS]
): HydratedOathGameState {
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
                advisers: defenderAdvisers.map((cardId) => ({ cardId, faceUp: true }))
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
            // The spoils draw the site taken: a printed site with no power that acts on them.
            siteCards:
                step === 'spoils'
                    ? { ...fixtureSitesOnTheBoard(), [site]: 'site.steppe' }
                    : fixtureSitesOnTheBoard(),
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
    return state
}

function battleTable(step: BattleStep): PlayedTable {
    return tableOf(battleState(step))
}

/**
 * R-5.5.5, Captains — the same battle, 3 to sacrifice, with the force on 'att''s board and at the
 * next Provinces site, which 'att' rules and campaigns from as if their pawn were there.
 */
function sacrificeSplitTable(onBoard: number, atSite: number): PlayedTable {
    const state = battleState('sacrifice')
    const ruled = mapSlotId(Region.Provinces, 1)
    state.getPlayerState('att').warbandsOnBoard = { att: onBoard }
    state.warbandsBySite = { ...state.warbandsBySite, [ruled]: { att: atSite } }
    const campaign = state.campaign
    assertExists(campaign, 'The battle is fought mid-Campaign')
    campaign.forceSiteIds = [ruled]
    campaign.asIfSiteId = ruled
    return tableOf(state)
}

/**
 * R-5.5.7, Relic Hunter — the spoils of the same battle when 'att' took the top two Provinces
 * sites and the relic lying at the first (seen, as the targeted relics are), but not the pawn.
 */
function spoilsRelicHunterTable(): PlayedTable {
    const state = battleState('spoils')
    const [first, second] = mapSlotsFor(Region.Provinces)
    const slotId = `${first}.relic.0`
    state.siteCards = { ...state.siteCards, [second]: 'site.plains' }
    state.relicsBySite = { [first]: [{ slotId }] }
    state.vault = testVaultWithRelics({ [slotId]: 'relic.cup-of-plenty' })
    state.getPlayerState('att').peekedRelics = { [slotId]: 'relic.cup-of-plenty' }
    const campaign = state.campaign
    assertExists(campaign, 'The battle is fought mid-Campaign')
    campaign.targets = [
        { kind: CampaignTargetKind.Site, siteId: first },
        { kind: CampaignTargetKind.Site, siteId: second },
        { kind: CampaignTargetKind.SiteRelic, slotId }
    ]
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

/** R-7.4: the seat holds Truthful Harp, a Search modifier whose printed text carries emphasis marks. */
function harpSearchTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                supply: 4,
                relicIds: ['relic.truthful-harp']
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

/**
 * R-7.4, R-6.2: Use a power with a card that makes a Search possible (Mushrooms, 1 Supply), an
 * adviser that changes a Travel (Tents) and an "Action:" power that costs a secret (the Whistle,
 * which picks a pawn at another site).
 */
function usePowerTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                supply: 1,
                favor: 2,
                secrets: 3,
                relicIds: ['relic.whistle'],
                advisers: [{ cardId: 'denizen.nomad.tents', faceUp: true }]
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

/**
 * Witch's Bargain in Dana's advisers, in a game created at revision 7: Dana (5 favor, 3 secrets),
 * Rhys (4, 2) and Ann (1, 1) all stand at the top Cradle site, or Ann at the next one, leaving Rhys
 * the only player there. With Vow of Silence too, Dana cannot give anyone secrets.
 */
function witchsBargainTable(silenced: boolean, annAway: boolean): PlayedTable {
    const [home, next] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: home,
                favor: 5,
                secrets: 3,
                advisers: [
                    { cardId: 'denizen.arcane.witchs-bargain', faceUp: true },
                    ...(silenced ? [{ cardId: 'denizen.arcane.vow-of-silence', faceUp: true }] : [])
                ]
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: home,
                favor: 4,
                secrets: 2
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                status: PlayerStatus.Exile,
                siteId: annAway ? next : home,
                favor: 1,
                secrets: 1
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [] },
            oathRevision: OathRevision.EngineFixes3
        }
    )
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
    return tableOf(state)
}

/** R-9.4: Tavern Songs at the seat's site peeks at the Cradle discard pile, which nobody else sees. */
function tavernSongsTable(): PlayedTable {
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
            denizensBySite: { [home]: ['denizen.hearth.tavern-songs'] },
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

/**
 * R-10.8: Deed Writer at the seat's site, which the seat rules, opens an exchange with Ann; each
 * has warbands on their board to move into a site the other hands over.
 */
function deedWriterTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const away = mapSlotId(Region.Provinces, 0)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                supply: 7,
                favor: 2,
                warbandsOnBoard: { me: 3 }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: away,
                favor: 2,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: ['denizen.hearth.deed-writer'] },
            warbandsBySite: { [home]: { me: 2 }, [away]: { [IMPERIAL_WARBANDS]: 2 } }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

type ExchangeScene =
    | 'exchangeDeed'
    | 'exchangeDeedEmptyBoard'
    | 'exchangeDeedSwap'
    | 'exchangeTinkers'
    | 'exchangeGathering'

const VOW_OF_SILENCE = 'denizen.arcane.vow-of-silence'

/**
 * R-10.8 — Dana, the Chancellor, at Plains with Deed Writer or Tinker's Fair; he rules Plains and
 * Great Slum (Imperial warbands) and holds the Grand Scepter and the Cup of Plenty. Rhys, an
 * Exile, rules the Mountain and holds the Bandit Crown with 2 warbands on his board; Ann is a
 * Citizen. `exchangeDeedEmptyBoard`: Rhys holds no Crown and his board is empty.
 * `exchangeDeedSwap`: the same, in a game at the current revision, where the Mountain's warband
 * comes home before Rhys moves in.
 * `exchangeTinkers`: Rhys holds Vow of Silence. `exchangeGathering`: The Gathering's round asks
 * Dana, who holds 2 advisers of 3; Rhys holds Vow of Peace (locked), Tents and a facedown card.
 */
function exchangeTable(scene: ExchangeScene): PlayedTable {
    const [home, slums] = mapSlotsFor(Region.Cradle)
    const mountain = mapSlotId(Region.Provinces, 0)
    const crowned = scene !== 'exchangeDeedEmptyBoard' && scene !== 'exchangeDeedSwap'
    const card =
        scene === 'exchangeTinkers' ? 'denizen.hearth.tinkers-fair' : 'denizen.hearth.deed-writer'
    const gathering = scene === 'exchangeGathering'
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: home,
                favor: 4,
                secrets: 2,
                relicIds: ['relic.grand-scepter', CUP],
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 6 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 },
                advisers: gathering
                    ? [faceup('denizen.order.longbows'), faceup('denizen.hearth.herald')]
                    : [],
                ...RELIQUARY_KNOWN
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                siteId: home,
                favor: 1,
                secrets: 1,
                relicIds: crowned ? ['relic.bandit-crown'] : [],
                warbandsOnBoard: crowned ? { rhys: 2 } : {},
                advisers: gathering
                    ? [
                          faceup('denizen.hearth.vow-of-peace'),
                          faceup('denizen.nomad.tents'),
                          { cardId: 'denizen.order.scouts', faceUp: false }
                      ]
                    : scene === 'exchangeTinkers'
                      ? [faceup(VOW_OF_SILENCE)]
                      : []
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: home,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { ann: 2 }
            })
        ],
        {
            machineState: gathering ? MachineState.PowerQuestion : MachineState.ActPhase,
            oathRevision:
                scene === 'exchangeDeedSwap' ? CURRENT_OATH_REVISION : OathRevision.UiBatch1,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            vault: testVaultWithRelics(RELIQUARY),
            siteCards: {
                [home]: 'site.plains',
                [slums]: 'site.great-slums',
                [mountain]: 'site.mountain'
            },
            denizensBySite: { [home]: gathering ? [] : [card], [slums]: [], [mountain]: [] },
            warbandsBySite: {
                [home]: { [IMPERIAL_WARBANDS]: 2 },
                [slums]: { [IMPERIAL_WARBANDS]: 1 },
                [mountain]: { rhys: 1 }
            },
            ...(gathering && {
                pendingQuestions: {
                    queue: [
                        {
                            kind: PowerQuestionKind.GatheringFloor,
                            cardId: 'denizen.nomad.the-gathering',
                            askedPlayerId: 'dana',
                            siteId: home
                        }
                    ],
                    askingPlayerId: 'dana',
                    resumeMachineState: MachineState.ActPhase
                }
            })
        }
    )
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
    return tableOf(state)
}

/**
 * Messenger: Dana, the Chancellor, stands at the Ancient City (4 Imperial warbands) and rules
 * the Steppe (2) and the Marshes (1); his board is empty. Rhys, an Exile, is at the Mountain.
 */
function messengerTable(): PlayedTable {
    const [city, steppe] = mapSlotsFor(Region.Cradle)
    const [mountain, marshes] = mapSlotsFor(Region.Provinces)
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: city,
                favor: 3,
                secrets: 1,
                warbandsOnBoard: {},
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 },
                advisers: [faceup('denizen.order.messenger')]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Red, siteId: mountain, favor: 2, secrets: 1 })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: {
                [city]: 'site.ancient-city',
                [steppe]: 'site.steppe',
                [mountain]: 'site.mountain',
                [marshes]: 'site.marshes'
            },
            denizensBySite: { [city]: [], [steppe]: [], [mountain]: [], [marshes]: [] },
            warbandsBySite: {
                [city]: { [IMPERIAL_WARBANDS]: 4 },
                [steppe]: { [IMPERIAL_WARBANDS]: 2 },
                [mountain]: { rhys: 1 },
                [marshes]: { [IMPERIAL_WARBANDS]: 1 }
            }
        }
    )
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
    return tableOf(state)
}

/**
 * A game from before revision 5, where a Citizen could hold their own warbands beside Imperial
 * ones: Ann, a Citizen with Messenger, has 2 of hers and 1 Imperial on her board, and 3 of each
 * at the Steppe. Dana is the Chancellor.
 */
function messengerTwoOwnersTable(): PlayedTable {
    const [city, steppe] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: steppe,
                favor: 3,
                warbandsOnBoard: { ann: 2, [IMPERIAL_WARBANDS]: 1 },
                advisers: [faceup('denizen.order.messenger')]
            }),
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: city,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            oathRevision: OathRevision.CardFixes1,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: { [city]: 'site.ancient-city', [steppe]: 'site.steppe' },
            denizensBySite: { [city]: [], [steppe]: [] },
            warbandsBySite: {
                [city]: { [IMPERIAL_WARBANDS]: 2 },
                [steppe]: { ann: 3, [IMPERIAL_WARBANDS]: 3 }
            }
        }
    )
    openTurn(state, 'ann')
    state.activePlayerIds = ['ann']
    return tableOf(state)
}

/**
 * Warning Signals: Rhys, an Exile, campaigns against the Ancient City, where Dana, the Chancellor,
 * holds 4 Imperial warbands; she also rules the Steppe (2) and the Marshes (1), her board is
 * empty, and she answers with battle plans, Warning Signals among her advisers.
 */
function warningSignalsTable(): PlayedTable {
    const [city, steppe] = mapSlotsFor(Region.Cradle)
    const [mountain, marshes] = mapSlotsFor(Region.Provinces)
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: city,
                favor: 3,
                secrets: 1,
                warbandsOnBoard: {},
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 },
                advisers: [faceup('denizen.nomad.warning-signals')]
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                siteId: city,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { rhys: 5 },
                warbandsInPersonalBank: { rhys: 10 }
            })
        ],
        {
            machineState: MachineState.CampaignPlans,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: {
                [city]: 'site.ancient-city',
                [steppe]: 'site.steppe',
                [mountain]: 'site.mountain',
                [marshes]: 'site.marshes'
            },
            denizensBySite: { [city]: [], [steppe]: [], [mountain]: [], [marshes]: [] },
            warbandsBySite: {
                [city]: { [IMPERIAL_WARBANDS]: 4 },
                [steppe]: { [IMPERIAL_WARBANDS]: 2 },
                [marshes]: { [IMPERIAL_WARBANDS]: 1 }
            },
            campaign: {
                attackerPlayerId: 'rhys',
                defenderPlayerId: 'dana',
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [{ kind: CampaignTargetKind.Site, siteId: city }],
                attackPool: 5,
                defensePool: 4,
                attackRoll: [],
                defenseRoll: [],
                defense: 0,
                swords: 0,
                defendingForce: [
                    { at: { kind: 'site', siteId: city }, owner: IMPERIAL_WARBANDS, count: 4 }
                ],
                defendingBandits: 0,
                pendingDefenderPlans: { queue: ['dana'] },
                ...campaignRecords()
            }
        }
    )
    openTurn(state, 'rhys')
    state.activePlayerIds = ['dana']
    return tableOf(state)
}

type PickerScene = 'pickerWhistle' | 'pickerTerror' | 'pickerPact' | 'pickerCage'

/**
 * Use a power's picks as chips and pieces; Dana's turn.
 * - `pickerWhistle`: Dana, an Exile at the Ancient City, holds the Whistle and Scryer (its pile
 *   still a list); Rhys stands at the Mountain and Ann, the Chancellor, at the Marshes, both at
 *   another site.
 * - `pickerTerror`: Dana, an Exile at the Mountain (Provinces), holds the Darkest Secret and Terror
 *   Spells. Rhys rules the Mountain with 3 and stands at the Marshes with 2 on his board; Dana has 2
 *   at the Marshes and 3 on her board; Ann's pawn is at the Ancient City (Cradle), 2 on her board.
 * - `pickerPact`: Dana, an Exile, holds Blood Pact with 5 warbands on her board.
 * - `pickerCage`: Dana, the Chancellor, holds the Obsidian Cage, which holds 3 of Rhys's warbands
 *   and 2 Imperial; Ann is a Citizen, so the Imperial ones may go to Dana's board or Ann's.
 */
function powerPickerTable(scene: PickerScene): PlayedTable {
    const [city, steppe] = mapSlotsFor(Region.Cradle)
    const [mountain, marshes] = mapSlotsFor(Region.Provinces)
    const cage = scene === 'pickerCage'
    const terror = scene === 'pickerTerror'
    const dana: Record<PickerScene, Partial<OathPlayerState>> = {
        pickerWhistle: {
            siteId: city,
            relicIds: ['relic.whistle'],
            advisers: [faceup('denizen.discord.scryer')]
        },
        pickerTerror: {
            siteId: mountain,
            warbandsOnBoard: { dana: 3 },
            advisers: [faceup('denizen.arcane.terror-spells')]
        },
        pickerPact: {
            siteId: city,
            warbandsOnBoard: { dana: 5 },
            advisers: [faceup('denizen.arcane.blood-pact')]
        },
        pickerCage: {
            siteId: city,
            status: PlayerStatus.Chancellor,
            warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 14 },
            relicIds: ['relic.obsidian-cage']
        }
    }
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: cage ? Color.Purple : Color.Red,
                supply: 7,
                favor: 2,
                secrets: 3,
                ...dana[scene]
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: terror ? marshes : mountain,
                warbandsOnBoard: terror ? { rhys: 2 } : {},
                warbandsInPersonalBank: { rhys: 10 }
            }),
            testPlayer({
                playerId: 'ann',
                color: cage ? Color.Yellow : Color.Purple,
                status: cage ? PlayerStatus.Citizen : PlayerStatus.Chancellor,
                siteId: terror ? city : marshes,
                warbandsOnBoard: terror ? { [IMPERIAL_WARBANDS]: 2 } : {}
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: cage ? 'dana' : 'ann',
            map: allMapSlots(),
            siteCards: {
                [city]: 'site.ancient-city',
                [steppe]: 'site.steppe',
                [mountain]: 'site.mountain',
                [marshes]: 'site.marshes'
            },
            denizensBySite: { [city]: [], [steppe]: [], [mountain]: [], [marshes]: [] },
            warbandsBySite: terror ? { [mountain]: { rhys: 3 }, [marshes]: { dana: 2 } } : {},
            warbandsOnCards: cage
                ? { 'relic.obsidian-cage': { rhys: 3, [IMPERIAL_WARBANDS]: 2 } }
                : {},
            banners: testBanners(terror ? { [Banner.DarkestSecret]: 'dana' } : {})
        }
    )
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
    return tableOf(state)
}

type PickerTwoScene =
    | 'pickerPiles'
    | 'pickerBanks'
    | 'pickerSalad'
    | 'pickerSaladShort'
    | 'pickerSaladSite'
    | 'pickerSaladSiteTwo'
    | 'pickerSaladNoBeast'
    | 'pickerMay'
    | 'pickerMayCitizen'
    | 'pickerVault'
    | 'pickerVaultLast'
    | 'pickerFacedownBracken'

const PICKER_BANKS: Record<Suit, number> = {
    [Suit.Discord]: 2,
    [Suit.Arcane]: 2,
    [Suit.Order]: 4,
    [Suit.Hearth]: 3,
    [Suit.Beast]: 1,
    [Suit.Nomad]: 0
}

/** Salad Days played to the River takes the Hearth bank's last favor first, four banks still holding favor. */
const SALAD_SITE_BANKS: Record<Suit, number> = {
    [Suit.Discord]: 0,
    [Suit.Arcane]: 3,
    [Suit.Order]: 3,
    [Suit.Hearth]: 1,
    [Suit.Beast]: 3,
    [Suit.Nomad]: 2
}

/**
 * The rest of the power pickers: discard piles, repeated banks, the "may" and the "or". Seats
 * Dana (purple), Rhys (red), Ann (blue) and Bea (yellow); Dana is the Chancellor.
 * - `pickerPiles`: Dana's turn at the Great Slum (Provinces), with Scryer, Errand Boy and Bracken
 *   faceup and Convoys at her site. Piles: Cradle 5, Provinces 3, Hinterland 8, a Vision on top.
 * - `pickerBanks`: Rhys's turn, an Exile with Alchemist and Memory of Nature and 3 secrets. The
 *   banks hold Discord 2, Arcane 2, Order 4, Hearth 3, Beast 1, Nomad 0; three Beast cards are
 *   at sites, so X is 3.
 * - `pickerSalad`: Rhys searching, with Salad Days drawn beside Wolves and Tutor; the same banks.
 *   `pickerSaladShort`: only two banks hold favor. `pickerSaladSite`: Discord 0, Arcane 3,
 *   Order 3, Hearth 1, Beast 3, Nomad 2, so playing it to the River takes the Hearth bank's last
 *   favor first. `pickerSaladSiteTwo`: Arcane 3, Order 3, Hearth 1, the rest empty, so after that
 *   play only two banks hold favor. `pickerSaladNoBeast`: the Beast bank empty, so Wolves played
 *   to the River gains no favor.
 * - `pickerMay`: Ann's turn, an Exile ruling the Mountain (2) and the Wastes (3), searching with
 *   Royal Ambitions drawn; Dana rules only the Plains (2). The Reliquary holds four relics.
 *   `pickerMayCitizen`: Ann is a Citizen.
 * - `pickerVault`: Bea's turn at the Steppe, where Forgotten Vault stands, with 2 favor; Rhys holds
 *   the Darkest Secret with 3 secrets on it. `pickerVaultLast`: one secret on it.
 * - `pickerFacedownBracken`: Rhys's turn at the Mountain (Hinterland), Bracken faceup and Giant
 *   Python facedown; the piles as `pickerPiles`.
 */
function pickerTwoTable(scene: PickerTwoScene): PlayedTable {
    const [plains, steppe] = mapSlotsFor(Region.Cradle)
    const [slum, river] = mapSlotsFor(Region.Provinces)
    const [mountain, wastes] = mapSlotsFor(Region.Hinterland)
    const turnOf: Record<PickerTwoScene, string> = {
        pickerPiles: 'dana',
        pickerBanks: 'rhys',
        pickerSalad: 'rhys',
        pickerSaladShort: 'rhys',
        pickerSaladSite: 'rhys',
        pickerSaladSiteTwo: 'rhys',
        pickerSaladNoBeast: 'rhys',
        pickerMay: 'ann',
        pickerMayCitizen: 'ann',
        pickerVault: 'bea',
        pickerVaultLast: 'bea',
        pickerFacedownBracken: 'rhys'
    }
    const salad = [
        'pickerSalad',
        'pickerSaladShort',
        'pickerSaladSite',
        'pickerSaladSiteTwo',
        'pickerSaladNoBeast'
    ].includes(scene)
    const searching = salad || scene === 'pickerMay' || scene === 'pickerMayCitizen'
    const may = scene === 'pickerMay' || scene === 'pickerMayCitizen'
    const vault = scene === 'pickerVault' || scene === 'pickerVaultLast'
    const seats: Record<string, Partial<OathPlayerState>> = {
        dana:
            scene === 'pickerPiles'
                ? {
                      siteId: slum,
                      supply: 5,
                      favor: 3,
                      secrets: 2,
                      advisers: [
                          faceup('denizen.discord.scryer'),
                          faceup('denizen.beast.errand-boy'),
                          faceup('denizen.beast.bracken')
                      ]
                  }
                : { siteId: plains },
        rhys:
            scene === 'pickerBanks'
                ? {
                      siteId: river,
                      secrets: 3,
                      advisers: [
                          faceup('denizen.arcane.alchemist'),
                          faceup('denizen.beast.memory-of-nature')
                      ]
                  }
                : salad
                  ? {
                        siteId: river,
                        secrets: 3,
                        handIds: [
                            'denizen.hearth.salad-days',
                            'denizen.beast.wolves',
                            'denizen.arcane.tutor'
                        ]
                    }
                  : scene === 'pickerFacedownBracken'
                    ? {
                          siteId: mountain,
                          supply: 3,
                          favor: 2,
                          secrets: 1,
                          advisers: [
                              faceup('denizen.beast.bracken'),
                              { cardId: 'denizen.beast.giant-python', faceUp: false }
                          ]
                      }
                    : { siteId: river, secrets: vault ? 1 : 0 },
        ann: may
            ? {
                  siteId: mountain,
                  status: scene === 'pickerMayCitizen' ? PlayerStatus.Citizen : PlayerStatus.Exile,
                  handIds: [
                      'denizen.discord.royal-ambitions',
                      'denizen.beast.wolves',
                      'denizen.arcane.tutor'
                  ]
              }
            : { siteId: river },
        bea: vault ? { siteId: steppe, favor: 2 } : { siteId: river }
    }
    const colors: [string, Color][] = [
        ['dana', Color.Purple],
        ['rhys', Color.Red],
        ['ann', Color.Blue],
        ['bea', Color.Yellow]
    ]
    const state = testState(
        colors.map(([playerId, color]) =>
            testPlayer({
                playerId,
                color,
                status: playerId === 'dana' ? PlayerStatus.Chancellor : PlayerStatus.Exile,
                supply: 5,
                favor: 2,
                secrets: 1,
                warbandsInPersonalBank:
                    playerId === 'dana' ? { [IMPERIAL_WARBANDS]: 12 } : { [playerId]: 10 },
                ...seats[playerId]
            })
        ),
        {
            machineState: searching ? MachineState.Searching : MachineState.ActPhase,
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: {
                [plains]: 'site.plains',
                [steppe]: 'site.steppe',
                [slum]: 'site.great-slums',
                [river]: 'site.river',
                [mountain]: 'site.mountain',
                [wastes]: 'site.wastes'
            },
            denizensBySite: {
                [plains]: ['denizen.beast.wild-cry'],
                [steppe]: vault ? ['denizen.arcane.forgotten-vault'] : [],
                [slum]: scene === 'pickerPiles' ? ['denizen.nomad.convoys'] : [],
                [river]: ['denizen.beast.birdsong'],
                [mountain]: ['denizen.beast.rangers'],
                [wastes]: []
            },
            warbandsBySite: may
                ? { [plains]: { [IMPERIAL_WARBANDS]: 2 }, [mountain]: { ann: 2 }, [wastes]: { ann: 3 } }
                : {},
            favorBank:
                scene === 'pickerSaladShort'
                    ? { ...PICKER_BANKS, [Suit.Discord]: 0, [Suit.Arcane]: 0, [Suit.Beast]: 0 }
                    : scene === 'pickerSaladSite'
                      ? SALAD_SITE_BANKS
                      : scene === 'pickerSaladSiteTwo'
                        ? { ...SALAD_SITE_BANKS, [Suit.Beast]: 0, [Suit.Nomad]: 0 }
                        : scene === 'pickerSaladNoBeast'
                          ? { ...PICKER_BANKS, [Suit.Beast]: 0 }
                          : PICKER_BANKS,
            discardPileCounts: { cradle: 5, provinces: 3, hinterland: 8 },
            discardTopBackType: {
                cradle: CardKind.Denizen,
                provinces: CardKind.Denizen,
                hinterland: CardKind.Vision
            },
            banners: testBanners(vault ? { [Banner.DarkestSecret]: 'rhys' } : {}),
            vault: testVaultWithRelics(
                Object.fromEntries(RELIQUARY_RELICS.map((relic, index) => [reliquarySlotId(index), relic]))
            )
        }
    )
    state.banners[Banner.DarkestSecret].value = scene === 'pickerVault' ? 3 : 1
    openTurn(state, turnOf[scene])
    state.activePlayerIds = [turnOf[scene]]
    return tableOf(state)
}

type PowerSitesScene = 'pickerSites' | 'pickerSitesOne' | 'pickerPalanquin'

/**
 * A power's site picked on the lit map; Dana's turn, the Chancellor. She stands at the Drowned
 * City (Cradle), which Rhys rules with 2. She rules the Plains (Cradle) with 2, where Captains lies
 * and Rhys's pawn stands, and the Great Slum (Provinces) with 3, where Ann's pawn stands; the River
 * and the Mountain are empty; the Hinterland holds the Narrow Pass, the Wastes and a facedown site.
 * - `pickerSites`: Siege Engines is faceup in her advisers. Captains offers the Plains and the
 *   Great Slum, Siege Engines the Drowned City and the Plains; each costs 1 favor.
 * - `pickerSitesOne`: the same, after a use of Siege Engines: its favor is on it, so it is not
 *   listed and only Captains wants a site.
 * - `pickerPalanquin`: Palanquin in her advisers in place of Siege Engines, and Rhys and Ann stand
 *   with her at the Drowned City.
 */
function powerSitesTable(scene: PowerSitesScene): PlayedTable {
    const [city, plains] = mapSlotsFor(Region.Cradle)
    const [slum, river, mountain] = mapSlotsFor(Region.Provinces)
    const [pass, wastes] = mapSlotsFor(Region.Hinterland)
    const palanquin = scene === 'pickerPalanquin'
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: city,
                supply: 7,
                favor: 3,
                secrets: 2,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 13 },
                advisers: [faceup(palanquin ? 'denizen.order.palanquin' : 'denizen.order.siege-engines')]
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                siteId: palanquin ? city : plains,
                warbandsInPersonalBank: { rhys: 8 }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                siteId: palanquin ? city : slum,
                warbandsInPersonalBank: { ann: 9 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: {
                [city]: 'site.drowned-city',
                [plains]: 'site.plains',
                [slum]: 'site.great-slums',
                [river]: 'site.river',
                [mountain]: 'site.mountain',
                [pass]: 'site.narrow-pass',
                [wastes]: 'site.wastes'
            },
            denizensBySite: {
                [city]: [],
                [plains]: ['denizen.order.captains'],
                [slum]: [],
                [river]: [],
                [mountain]: [],
                [pass]: [],
                [wastes]: []
            },
            warbandsBySite: {
                [city]: { rhys: 2 },
                [plains]: { [IMPERIAL_WARBANDS]: 2 },
                [slum]: { [IMPERIAL_WARBANDS]: 3 }
            },
            cardTokens:
                scene === 'pickerSitesOne'
                    ? { 'denizen.order.siege-engines': { favor: 1, secrets: 0 } }
                    : {}
        }
    )
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
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

/** R-7.4 — the scenes for the cards each action's menu offers, as rows. */
type ModifierScene =
    'modifierTravel' | 'modifierMuster' | 'modifierTrade' | 'modifierSearch' | 'modifierPair'

/**
 * R-7.4 — the seat's cards for each action's menu: the Dragonskin Drum with Tents and Special
 * Envoy (Travel); Rowdy Pub at its site with two other cards (Muster); Birdsong, Awaited Return and
 * Master of Disguise beside an Order, an Order and a Nomad card (Trade); Wild Cry and Welcoming
 * Party (Search); and, at 0 Supply with no Beast or Nomad card at its site, Birdsong and Small
 * Friends, which only together make a Trade possible, with Wolves at a Provinces site.
 */
function modifierTable(scene: ModifierScene): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const adviser = (cardId: string) => ({ cardId, faceUp: true })
    const seats: Record<ModifierScene, Partial<OathPlayerState>> = {
        modifierTravel: {
            supply: 4,
            favor: 2,
            relicIds: ['relic.dragonskin-drum'],
            advisers: [adviser('denizen.nomad.tents'), adviser('denizen.nomad.special-envoy')]
        },
        modifierMuster: { supply: 3, favor: 3 },
        modifierTrade: {
            supply: 3,
            favor: 3,
            secrets: 2,
            warbandsOnBoard: { me: 3 },
            advisers: [
                adviser('denizen.beast.birdsong'),
                adviser('denizen.hearth.awaited-return'),
                adviser('denizen.arcane.master-of-disguise')
            ]
        },
        modifierSearch: {
            supply: 3,
            advisers: [adviser('denizen.beast.wild-cry'), adviser('denizen.hearth.welcoming-party')]
        },
        modifierPair: {
            supply: 0,
            favor: 2,
            secrets: 1,
            advisers: [adviser('denizen.beast.birdsong'), adviser('denizen.beast.small-friends')]
        }
    }
    const here: Record<ModifierScene, string[]> = {
        modifierTravel: [],
        modifierMuster: [
            'denizen.hearth.rowdy-pub',
            'denizen.order.forced-labor',
            'denizen.nomad.oracle'
        ],
        modifierTrade: [
            'denizen.order.toll-roads',
            'denizen.order.forced-labor',
            'denizen.nomad.oracle'
        ],
        modifierSearch: [],
        modifierPair: ['denizen.order.toll-roads']
    }
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, ...seats[scene] }),
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
            denizensBySite: {
                [home]: here[scene],
                [mapSlotId(Region.Provinces, 0)]: ['denizen.beast.wolves']
            },
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

/**
 * R-7.1.1-H2, R-7.4 — the Trade menu's cards for Small Friends' site and Master of Disguise's
 * borrowed advisers, in a game of this revision. `smallFriendsSites`: the seat, an Exile, stands
 * at the Great Slums (Toll Roads, Oracle, Map Library; the Inn at the other Cradle site) with
 * Birdsong and Small Friends; Wolves are at the Plains and The Old Oak at the Mountain.
 * `disguiseBorrowed`: the seat stands with Toll Roads, Rowdy Pub and Oracle, and holds Birdsong,
 * Awaited Return and Master of Disguise; Ann, the Chancellor, holds Secret Signal and Marriage.
 */
function tradeSitesTable(scene: 'smallFriendsSites' | 'disguiseBorrowed'): PlayedTable {
    const [home, other] = mapSlotsFor(Region.Cradle)
    const plains = mapSlotId(Region.Provinces, 0)
    const mountain = mapSlotId(Region.Hinterland, 0)
    const adviser = (cardId: string, faceUp = true) => ({ cardId, faceUp })
    const friends = scene === 'smallFriendsSites'
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: home,
                supply: 3,
                favor: 3,
                secrets: 2,
                warbandsOnBoard: { dana: 3 },
                advisers: friends
                    ? [adviser('denizen.beast.birdsong'), adviser('denizen.beast.small-friends')]
                    : [
                          adviser('denizen.beast.birdsong'),
                          adviser('denizen.hearth.awaited-return'),
                          adviser('denizen.arcane.master-of-disguise')
                      ]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Hinterland, 1),
                advisers: friends
                    ? []
                    : [adviser('denizen.arcane.secret-signal'), adviser('denizen.hearth.marriage')]
            })
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: {
                ...fixtureSitesOnTheBoard(),
                [home]: 'site.great-slums',
                [plains]: 'site.plains',
                [mountain]: 'site.mountain'
            },
            denizensBySite: friends
                ? {
                      [home]: [
                          'denizen.order.toll-roads',
                          'denizen.nomad.oracle',
                          'denizen.arcane.map-library'
                      ],
                      [other]: ['denizen.hearth.wayside-inn'],
                      [plains]: ['denizen.beast.wolves'],
                      [mountain]: ['denizen.beast.the-old-oak']
                  }
                : {
                      [home]: [
                          'denizen.order.toll-roads',
                          'denizen.hearth.rowdy-pub',
                          'denizen.nomad.oracle'
                      ],
                      [plains]: ['denizen.beast.wolves']
                  }
        }
    )
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
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

/**
 * Hospitality on Dana's Travel from the River: she holds Hospitality (nomad), War Tortoise (beast)
 * and Crop Rotation (hearth). The Plains hold Wolves (one bank, beast); the Wastes Oracle and
 * Birdsong (two banks, beast and nomad); the Drowned City Forced Labor (no match); the Great Slum,
 * which Rhys rules, Toll Roads and Rowdy Pub (hearth, whose bank is empty but in the `toll`
 * scene). The Shrouded Wood, the Mountain and the Hidden Place hold no card. The `hiddenPlace`
 * scene moves Oracle and Birdsong to the Hidden Place, so one destination has two banks and asks a
 * secret flipped as well (the site's own power).
 */
function hospitalityTable(scene: 'plain' | 'toll' | 'hiddenPlace'): PlayedTable {
    const hearth = scene === 'toll'
    const [river, plains] = mapSlotsFor(Region.Cradle)
    const [city, wood, slum] = mapSlotsFor(Region.Provinces)
    const [mountain, hidden, wastes] = mapSlotsFor(Region.Hinterland)
    const advisers = [
        'denizen.nomad.hospitality',
        'denizen.beast.war-tortoise',
        'denizen.hearth.crop-rotation'
    ].map((cardId) => ({ cardId, faceUp: true }))
    const twoBanks = ['denizen.nomad.oracle', 'denizen.beast.birdsong']
    const state = testState(
        [
            testPlayer({ playerId: 'dana', color: Color.Purple, siteId: river, supply: 7, favor: 3, secrets: 1, advisers }),
            testPlayer({ playerId: 'rhys', color: Color.Red, siteId: slum, favor: 3, warbandsOnBoard: { rhys: 3 } }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                status: PlayerStatus.Chancellor,
                siteId: mountain
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: {
                [river]: 'site.river',
                [plains]: 'site.plains',
                [city]: 'site.drowned-city',
                [wood]: 'site.shrouded-wood',
                [slum]: 'site.great-slums',
                [mountain]: 'site.mountain',
                [hidden]: 'site.the-hidden-place',
                [wastes]: 'site.wastes'
            },
            denizensBySite: {
                [river]: [],
                [plains]: ['denizen.beast.wolves'],
                [city]: ['denizen.order.forced-labor'],
                [wood]: [],
                [slum]: ['denizen.order.toll-roads', 'denizen.hearth.rowdy-pub'],
                [mountain]: [],
                [hidden]: scene === 'hiddenPlace' ? twoBanks : [],
                [wastes]: scene === 'hiddenPlace' ? [] : twoBanks
            },
            warbandsBySite: { [slum]: { rhys: 2 } },
            favorBank: {
                [Suit.Discord]: 3,
                [Suit.Arcane]: 2,
                [Suit.Order]: 2,
                [Suit.Hearth]: hearth ? 2 : 0,
                [Suit.Beast]: 3,
                [Suit.Nomad]: 2
            }
        }
    )
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
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

/** R-7.1.4: Rhys rules this seat's site with Forced Labor, so a Search gives him a favor. */
function searchTollByRhysTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: home, supply: 7, favor: 3 }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: home }),
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
            warbandsBySite: { [home]: { rhys: 2 } },
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

/** R-5.1.4.IV — Acting Troupe and Vow of Poverty: only the Beast matches Order and Beast. */
const ONE_MATCH = ['denizen.arcane.acting-troupe', 'denizen.beast.vow-of-poverty']
const ONE_MATCH_THEIRS = ['denizen.order.code-of-honor', 'denizen.beast.insect-swarm']
const INQUISITOR = 'denizen.arcane.inquisitor'

/** The Conspiracy with no one to take from: Rhys holds the People's Favor; one adviser matches. */
function conspiracyNoTakeTable(machineState: MachineState, me: Partial<Seat>): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: home,
                secrets: 1,
                ...me
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                siteId: home,
                advisers: ONE_MATCH_THEIRS.map(faceup)
            })
        ],
        {
            machineState,
            chancellorPlayerId: 'me',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [] },
            banners: testBanners({ [Banner.PeoplesFavor]: 'rhys' })
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-6.1, R-7.4 — the scenes for the Search cards a facedown adviser's play may use. */
type FacedownScene = 'facedownCards' | 'facedownFullSite' | 'facedownNewGrowth'

/**
 * R-6.1, R-7.4 — the seat's one facedown adviser, War Tortoise (a beast card), with Wild Cry and
 * Crop Rotation faceup and the Cracked Horn; its site holds Book Binders and Fabled Feast, with
 * room for one more. `facedownFullSite`: a third denizen fills the site. `facedownNewGrowth`: New
 * Growth in place of the Horn, Crop Rotation at the site beside Book Binders, and the People's
 * Favor with three cards at the next Cradle site, so every site is open and five cards may go
 * first: a later step taller than the card.
 */
function facedownTable(scene: FacedownScene): PlayedTable {
    const [home, next] = mapSlotsFor(Region.Cradle)
    const adviser = (cardId: string) => ({ cardId, faceUp: true })
    const growth = scene === 'facedownNewGrowth'
    const here = ['denizen.hearth.book-binders', 'denizen.hearth.fabled-feast']
    const full = scene === 'facedownCards' ? here : [...here, 'denizen.order.captains']
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                supply: 3,
                relicIds: growth ? [] : ['relic.cracked-horn'],
                advisers: [
                    { cardId: 'denizen.beast.war-tortoise', faceUp: false },
                    adviser('denizen.beast.wild-cry'),
                    adviser(growth ? 'denizen.beast.new-growth' : 'denizen.hearth.crop-rotation')
                ]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Hinterland, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            banners: testBanners({ [Banner.PeoplesFavor]: growth ? 'me' : undefined }),
            denizensBySite: growth
                ? {
                      [home]: ['denizen.hearth.book-binders', 'denizen.hearth.crop-rotation'],
                      [next]: [
                          'denizen.order.captains',
                          'denizen.nomad.elders',
                          'denizen.order.curfew'
                      ]
                  }
                : { [home]: full }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/**
 * R-6.1, R-5.1.4.I — the seat's facedown Great Herd, with Crop Rotation faceup; its site holds Book
 * Binders and Tents, and the Oracle stands at the next Cradle site. Tents, a Nomad card, may go
 * first, and then only the Oracle is left for Great Herd to swap with.
 */
function greatHerdFlipTable(): PlayedTable {
    const [home, next] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: home,
                supply: 3,
                advisers: [
                    { cardId: 'denizen.nomad.great-herd', faceUp: false },
                    { cardId: 'denizen.hearth.crop-rotation', faceUp: true }
                ]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Hinterland, 0)
            })
        ],
        {
            machineState: MachineState.ActPhase,
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'ann',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: {
                [home]: ['denizen.hearth.book-binders', 'denizen.nomad.tents'],
                [next]: ['denizen.nomad.oracle']
            }
        }
    )
    openTurn(state, 'me')
    state.activePlayerIds = ['me']
    return tableOf(state)
}

/** R-5.1.4.IV: a Search drew Wolves, Toll Roads and the Conspiracy; no one here to take from. */
function searchConspiracyNoTakeTable(): PlayedTable {
    return conspiracyNoTakeTable(MachineState.Searching, {
        handIds: ['denizen.beast.wolves', 'denizen.order.toll-roads', 'vision.conspiracy'],
        advisers: ONE_MATCH.map(faceup)
    })
}

/** R-6.1, R-5.1.4.IV: the facedown Conspiracy turned faceup, with no one here to take from. */
function flipConspiracyNoTakeTable(): PlayedTable {
    return conspiracyNoTakeTable(MachineState.ActPhase, {
        advisers: [...ONE_MATCH.map(faceup), { cardId: 'vision.conspiracy', faceUp: false }]
    })
}

/** R-5.1.4.IV: the Conspiracy drawn by a Search, with Rhys at this seat's site holding a relic. */
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
                playerId: 'rhys',
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

/** R-2.3 — the Reliquary's relics are held facedown in the vault; the Scepter's holder knows each (R-6.4-H1). */
const RELIQUARY: Record<string, string> = {
    'reliquary.0': 'relic.ring-of-devotion',
    'reliquary.1': 'relic.cup-of-plenty',
    'reliquary.2': 'relic.skeleton-key',
    'reliquary.3': 'relic.brass-horse'
}
const RELIQUARY_KNOWN = { peekedRelicSlotIds: Object.keys(RELIQUARY), peekedRelics: RELIQUARY }

/**
 * R-6.6.1 — the Grand Scepter's holder, holding both banners, in their Act Phase with every
 * Reliquary relic known to them (R-6.4-H1). `two`: Rhys and Ann are Exiles; `one`: Rhys alone;
 * `silenced`: both, Rhys with Vow of Silence, so he may give no secrets; `self`: the holder is the
 * one Exile, Rhys a Citizen and Ann the Chancellor.
 */
function offerCitizenshipTable(exiles: 'two' | 'one' | 'silenced' | 'self'): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const self = exiles === 'self'
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: self ? Color.Yellow : Color.Purple,
                status: self ? PlayerStatus.Exile : PlayerStatus.Chancellor,
                siteId: home,
                favor: 4,
                secrets: 2,
                relicIds: ['relic.grand-scepter'],
                warbandsInPersonalBank: self ? { dana: 14 } : { [IMPERIAL_WARBANDS]: 16 },
                ...RELIQUARY_KNOWN
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                status: self ? PlayerStatus.Citizen : PlayerStatus.Exile,
                siteId: home,
                favor: 3,
                secrets: 1,
                advisers: exiles === 'silenced' ? [faceup('denizen.arcane.vow-of-silence')] : [],
                warbandsInPersonalBank: { rhys: 14 }
            }),
            testPlayer({
                playerId: 'ann',
                color: self ? Color.Purple : Color.Blue,
                status: self
                    ? PlayerStatus.Chancellor
                    : exiles === 'one'
                      ? PlayerStatus.Citizen
                      : PlayerStatus.Exile,
                siteId: home,
                favor: 2,
                warbandsInPersonalBank: self ? { [IMPERIAL_WARBANDS]: 16 } : { ann: 14 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: self ? 'ann' : 'dana',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [] },
            vault: testVaultWithRelics(RELIQUARY),
            banners: testBanners({ [Banner.PeoplesFavor]: 'dana', [Banner.DarkestSecret]: 'dana' })
        }
    )
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
    return tableOf(state)
}

/**
 * R-6 — the Grand Scepter's holder offered every minor the rules allow together: a facedown
 * adviser to play or show, Tents' power on Travel, a relic here not yet seen, warbands at a site he
 * rules, Rhys an Exile and Ann a Citizen.
 */
function everyMinorTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const relic = `${home}.relic.0`
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: home,
                supply: 7,
                favor: 12,
                secrets: 3,
                relicIds: ['relic.grand-scepter'],
                advisers: [
                    { cardId: 'denizen.order.curfew', faceUp: false },
                    { cardId: 'denizen.nomad.tents', faceUp: true }
                ],
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 14 }
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: home,
                favor: 3,
                warbandsInPersonalBank: { rhys: 14 }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: home,
                favor: 2,
                warbandsInPersonalBank: { ann: 14 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [] },
            warbandsBySite: { [home]: { [IMPERIAL_WARBANDS]: 2 } },
            relicsBySite: { [home]: [{ slotId: relic }] },
            vault: testVaultWithRelics({ ...RELIQUARY, [relic]: 'relic.cup-of-plenty' })
        }
    )
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
    return tableOf(state)
}

const SWARM = 'denizen.beast.insect-swarm'
const FORCED_LABOR = 'denizen.order.forced-labor'

/**
 * R-6.1, R-6.6.1, R-9.4 — what Show offers: Dana, the Chancellor, holds the Grand Scepter from an
 * earlier turn, knows every Reliquary relic (R-6.4-H1) and has Insect Swarm facedown; Rhys is an
 * Exile with Forced Labor facedown, and Ann a Citizen. `on` is the seat whose Act Phase it is.
 */
function showTable(on: 'dana' | 'rhys'): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: home,
                favor: 4,
                secrets: 2,
                relicIds: ['relic.grand-scepter'],
                advisers: [{ cardId: SWARM, faceUp: false }],
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 },
                ...RELIQUARY_KNOWN
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: home,
                favor: 3,
                secrets: 1,
                advisers: [{ cardId: FORCED_LABOR, faceUp: false }],
                warbandsInPersonalBank: { rhys: 14 }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: home,
                favor: 2,
                warbandsInPersonalBank: { ann: 14 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [] },
            vault: testVaultWithRelics(RELIQUARY)
        }
    )
    openTurn(state, on)
    state.activePlayerIds = [on]
    return tableOf(state)
}

/** R-6.7 — the Grand Scepter's holder may exile Rhys (5 favor) or Ann, who holds the People's Favor (6). */
function exileCitizensTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: home,
                favor: 12,
                relicIds: ['relic.grand-scepter'],
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 },
                ...RELIQUARY_KNOWN
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                status: PlayerStatus.Citizen,
                siteId: home,
                favor: 2,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { rhys: 14 }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: home,
                favor: 2,
                warbandsInPersonalBank: { ann: 14 }
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [] },
            vault: testVaultWithRelics(RELIQUARY),
            banners: testBanners({ [Banner.PeoplesFavor]: 'ann' })
        }
    )
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
    return tableOf(state)
}

/** R-6.8 — Rhys, a Citizen with one secret and two warbands on his board, may exile himself for 3 favor. */
function selfExileTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                status: PlayerStatus.Citizen,
                siteId: home,
                favor: 5,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { rhys: 14 }
            }),
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotId(Region.Provinces, 0),
                favor: 4,
                relicIds: ['relic.grand-scepter'],
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 },
                ...RELIQUARY_KNOWN
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            denizensBySite: { [home]: [] },
            vault: testVaultWithRelics(RELIQUARY)
        }
    )
    openTurn(state, 'rhys')
    state.activePlayerIds = ['rhys']
    return tableOf(state)
}

/** R-11.7 — Rhys asked where Dana goes from the Shrouded Wood Rhys rules. */
function woodRulerTable(): PlayedTable {
    const state = shroudedWoodState(2, { onBoard: true })
    const table = tableOf(state)
    return played(table, [createAction(Travel, { ...envelope(table), playerId: 'Dana' })])
}

/**
 * R-11.7, Toll Roads — the Wood ruler's tables, with Rhys also ruling the Great Slum, which holds
 * Toll Roads, and Dana holding 2 favor.
 */
function woodTollState(): HydratedOathGameState {
    const state = shroudedWoodState(2, { onBoard: true })
    const slum = mapSlotsFor(Region.Provinces)[1]
    state.denizensBySite = { ...state.denizensBySite, [slum]: ['denizen.order.toll-roads'] }
    state.warbandsBySite = { ...state.warbandsBySite, [slum]: { Rhys: 1 } }
    state.getPlayerState('Dana').favor = 2
    return state
}

/** R-11.7-H2 — Dana has set out from Bea's Wood declaring `cards`; Bea picks with them counted. */
function woodCardsRulerTable(scene: WoodCardsScene, cards: string[]): PlayedTable {
    const table = tableOf(woodCardsState(scene))
    return played(table, [
        createAction(Travel, {
            ...envelope(table),
            playerId: 'Dana',
            modifiers: cards.map(travelCard)
        })
    ])
}

/**
 * R-11.7-H2 — Dana set out from Bea's Wood with Hospitality, and Bea picked the River: two banks
 * match there, so Dana is asked which.
 */
function woodHospitalityAskedTable(): PlayedTable {
    const table = tableOf(woodHospitalityState())
    return played(table, [
        createAction(Travel, {
            ...envelope(table),
            playerId: 'Dana',
            modifiers: [{ ...travelCard(HOSPITALITY), choices: [] }]
        }),
        createAction(AnswerQuestion, {
            ...envelope(table),
            playerId: 'Bea',
            answer: {
                kind: PowerQuestionKind.ShroudedWoodDestination,
                siteId: mapSlotsFor(Region.Provinces)[2]
            }
        })
    ])
}

/** Dana has set out from Rhys's Wood; Rhys picks, the Great Slum marked with its toll. */
function woodRulerTollTable(): PlayedTable {
    const table = tableOf(woodTollState())
    return played(table, [createAction(Travel, { ...envelope(table), playerId: 'Dana' })])
}

/** Rhys picked the Great Slum: Dana is asked for the toll before paying any Supply. */
function woodTollAskedTable(): PlayedTable {
    const table = tableOf(woodTollState())
    return played(table, [
        createAction(Travel, { ...envelope(table), playerId: 'Dana' }),
        createAction(AnswerQuestion, {
            ...envelope(table),
            playerId: 'Rhys',
            answer: {
                kind: PowerQuestionKind.ShroudedWoodDestination,
                siteId: mapSlotsFor(Region.Provinces)[1]
            }
        })
    ])
}

const BANDIT_CROWN = 'relic.bandit-crown'

/** The empty Provinces site the Bandit Crown's tables enlarge, dealt the Great Slums. */
const CROWN_SITE = mapSlotId(Region.Provinces, 1)

type CrownScene = 'citizen' | 'chancellor' | 'exile' | 'campaign' | 'five'

/**
 * R-7.6.5 with R-6.6.3 — the Bandit Crown in a new game: Dana the Chancellor, Ann a Citizen,
 * Rhys an Exile and the Exile Bea on the clock. The Empire's warbands hold the top Provinces
 * site and Rhys's the top Cradle site; every other site is empty. 'campaign': Ann, holding the
 * Crown, has declared against Dana (R-5.5.1.a suspends her). 'five': Bea, Dov and Wes are
 * Citizens too, and Rhys is on the clock.
 */
function banditCrownTable(scene: CrownScene): PlayedTable {
    const holderId = {
        citizen: 'ann',
        chancellor: 'dana',
        exile: 'rhys',
        campaign: 'ann',
        five: 'ann'
    }[scene]
    const crown = (playerId: string) => (playerId === holderId ? [BANDIT_CROWN] : [])
    const citizen = (playerId: string, color: Color) =>
        testPlayer({
            playerId,
            color,
            status: PlayerStatus.Citizen,
            siteId: mapSlotId(Region.Hinterland, 0),
            relicIds: crown(playerId)
        })
    const plains = mapSlotId(Region.Provinces, 0)
    const home = mapSlotId(Region.Cradle, 0)
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: plains,
                relicIds: crown('dana'),
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }
            }),
            citizen('ann', Color.Blue),
            ...(scene === 'five'
                ? [
                      citizen('bea', Color.Yellow),
                      citizen('dov', Color.Black),
                      citizen('wes', Color.White)
                  ]
                : [
                      testPlayer({
                          playerId: 'bea',
                          color: Color.Yellow,
                          siteId: mapSlotId(Region.Cradle, 1)
                      })
                  ]),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                siteId: home,
                relicIds: crown('rhys'),
                warbandsOnBoard: { rhys: 4 }
            })
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            machineState:
                scene === 'campaign' ? MachineState.CampaignPlans : MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: { ...fixtureSitesOnTheBoard(), [CROWN_SITE]: 'site.great-slums' },
            denizensBySite: { [CROWN_SITE]: [] },
            warbandsBySite: { [plains]: { [IMPERIAL_WARBANDS]: 2 }, [home]: { rhys: 1 } },
            campaign:
                scene === 'campaign'
                    ? {
                          attackerPlayerId: 'ann',
                          defenderPlayerId: 'dana',
                          nonImperialPlayerIds: ['ann'],
                          allyPlayerIds: [],
                          targets: [{ kind: CampaignTargetKind.Site, siteId: plains }],
                          attackPool: 2,
                          defensePool: 2,
                          attackRoll: [],
                          defenseRoll: [],
                          defense: 0,
                          swords: 0,
                          defendingForce: [
                              {
                                  at: { kind: 'site', siteId: plains },
                                  owner: IMPERIAL_WARBANDS,
                                  count: 2
                              }
                          ],
                          defendingBandits: 0,
                          pendingDefenderPlans: { queue: ['dana'] },
                          ...campaignRecords()
                      }
                    : undefined
        }
    )
    const onTheClock = scene === 'campaign' ? 'dana' : scene === 'five' ? 'rhys' : 'bea'
    openTurn(state, scene === 'campaign' ? 'ann' : onTheClock)
    state.activePlayerIds = [onTheClock]
    return tableOf(state)
}

const GREAT_SLUM = mapSlotId(Region.Provinces, 1)
const RIVER = mapSlotId(Region.Provinces, 2)
const WHISTLE = 'relic.whistle'
const ORACLE = 'denizen.nomad.oracle'

/**
 * Toll Roads on a power's move: Rhys (Exile) rules the Great Slum, which holds Toll Roads, Forced
 * Labor and Oracle; Dana (Chancellor) stands at the River.
 */
function tollTable(rhys: Record<string, unknown>, dana: Record<string, unknown>, turn: string) {
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: RIVER,
                supply: 3,
                favor: 4,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 6 },
                ...dana
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Red,
                siteId: GREAT_SLUM,
                supply: 3,
                favor: 3,
                secrets: 2,
                warbandsOnBoard: { Rhys: 9 },
                ...rhys
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'Dana',
            oathkeeperPlayerId: 'Rhys',
            oathRevision: OathRevision.UiBatch1,
            map: allMapSlots(),
            siteCards: {
                ...fixtureSitesOnTheBoard(),
                [GREAT_SLUM]: 'site.great-slums',
                [RIVER]: 'site.river'
            },
            denizensBySite: {
                [GREAT_SLUM]: ['denizen.order.toll-roads', 'denizen.order.forced-labor', ORACLE],
                [RIVER]: []
            },
            warbandsBySite: { [GREAT_SLUM]: { Rhys: 2 } }
        }
    )
    openTurn(state, turn)
    state.activePlayerIds = [turn]
    state.vault = testVaultWithRelics({})
    return state
}

/** Rhys has used the Whistle on Dana, who is asked to pay Toll Roads or refuse. */
function tollAskedTable(): PlayedTable {
    const table = tableOf(tollTable({ relicIds: [WHISTLE] }, {}, 'Rhys'))
    return played(table, [
        createAction(UseActionPower, {
            ...envelope(table),
            playerId: 'Rhys',
            cardId: WHISTLE,
            powerIndex: powerIndexOf(WHISTLE, PowerTiming.Action),
            choices: [{ kind: PowerChoiceKind.Player, playerId: 'Dana' }]
        })
    ])
}

/** Dana's Act Phase at the Great Slum: Oracle's draw owes Forced Labor's toll to Rhys. */
function oracleTable(favor: number): PlayedTable {
    const state = tollTable(
        { siteId: RIVER },
        { siteId: GREAT_SLUM, favor, secrets: 2, relicIds: favor > 0 ? [] : [WHISTLE] },
        'Dana'
    )
    return tableOf(state)
}

const SNEAK_ATTACK = 'denizen.discord.sneak-attack'
const SECOND_WIND = 'denizen.discord.second-wind'

/** A rolled attack die: a skull face is a skull and two swords (`data/dice.ts`). */
const SKULL_FACE = { swords: 2, hollowSwords: 0, skulls: 1 }
const SWORD_FACE = { swords: 1, hollowSwords: 0, skulls: 0 }

/**
 * R-5.5.5, revision 7 — dana (the Chancellor) campaigns against rhys, his force on his board and at
 * the sites it reaches (Captains: one; Vow of Union: two); the skulls rolled wait for his pick, or,
 * at `sacrifice`, a battle that needs 3 sacrificed, so the defeat would be the default half.
 */
function forceInPlacesTable(step: 'skulls' | 'sacrifice', sites: 1 | 2): PlayedTable {
    const [here, plains, river] = mapSlotsFor(Region.Provinces)
    const forceSiteIds = sites === 1 ? [plains] : [plains, river]
    const skulls = sites === 1 ? 2 : 3
    const attackRoll = [
        ...range(0, skulls).map(() => SKULL_FACE),
        SWORD_FACE,
        { swords: 0, hollowSwords: 1, skulls: 0 }
    ]
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: here,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: sites === 1 ? 3 : 1 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 14 }
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Red,
                siteId: here,
                warbandsOnBoard: { rhys: 4 },
                warbandsInPersonalBank: { rhys: 10 }
            })
        ],
        {
            machineState:
                step === 'skulls' ? MachineState.CampaignSkullLosses : MachineState.CampaignSacrifice,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            warbandsBySite: Object.fromEntries(
                forceSiteIds.map((siteId) => [siteId, { [IMPERIAL_WARBANDS]: 2 }])
            ),
            campaign: {
                attackerPlayerId: 'dana',
                defenderPlayerId: 'rhys',
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
                attackPool: attackRoll.length,
                defensePool: 2,
                attackRoll,
                defenseRoll: [
                    { shields: 1, doubling: false },
                    { shields: 2, doubling: false }
                ],
                defense: 7,
                swords: step === 'skulls' ? skulls * 2 + 1 : 5,
                defendingForce: [{ at: { kind: 'board', playerId: 'rhys' }, owner: 'rhys', count: 4 }],
                defendingBandits: 0,
                pendingSkullLosses: step === 'skulls' ? { skulls } : undefined,
                ...campaignRecords(),
                forceSiteIds
            }
        }
    )
    state.oathRevision = OathRevision.EngineFixes3
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
    return tableOf(state)
}

/**
 * Second Wind out of turn, revision 7 — ann won a Sneak Attack during rhys's turn with Second Wind,
 * and is asked "Travel now?" (then, at `campaign`, "Campaign now?" at dana's site, which he rules).
 */
function freeActionAskedTable(action: ActionType.Travel | ActionType.Campaign): PlayedTable {
    const [tribunal] = mapSlotsFor(Region.Provinces)
    const [slum] = mapSlotsFor(Region.Hinterland)
    const travel = action === ActionType.Travel
    const state = testState(
        [
            testPlayer({ playerId: 'rhys', color: Color.Red, siteId: tribunal, supply: 1 }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                siteId: travel ? tribunal : slum,
                supply: 2,
                favor: 3,
                warbandsOnBoard: { ann: 4 },
                advisers: [
                    { cardId: SNEAK_ATTACK, faceUp: true },
                    { cardId: SECOND_WIND, faceUp: true }
                ]
            }),
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: slum,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }
            })
        ],
        {
            machineState: MachineState.PowerQuestion,
            chancellorPlayerId: 'dana',
            map: allMapSlots(),
            siteCards: fixtureSitesOnTheBoard(),
            warbandsBySite: { [tribunal]: { ann: 2 }, [slum]: { [IMPERIAL_WARBANDS]: 3 } },
            pendingQuestions: {
                queue: [
                    {
                        kind: PowerQuestionKind.FreeActionOutOfTurn,
                        cardId: SECOND_WIND,
                        askedPlayerId: 'ann',
                        action
                    }
                ],
                askingPlayerId: 'rhys',
                resumeMachineState: MachineState.ActPhase
            },
            heldTurn: { queue: [], askingPlayerId: 'rhys', resumeMachineState: MachineState.ActPhase }
        }
    )
    state.oathRevision = OathRevision.EngineFixes3
    openTurn(state, 'rhys')
    state.activePlayerIds = ['ann']
    const ann = state.getPlayerState('ann')
    if (travel) ann.freeTravelAtAction = state.actionCount
    ann.freeCampaignAtAction = state.actionCount
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

const DRUM = 'relic.dragonskin-drum'
const BRASS_HORSE = 'relic.brass-horse'
type DrumScene = 'whistle' | 'citizen' | 'toll' | 'horse'

/**
 * Dragonskin Drum on a power's move (revision 7): Dana holds the Drum at the River; Rhys, with the
 * Whistle, rules the Great Slum (with Toll Roads there in 'toll'); Ann is the Chancellor, and in
 * 'citizen' Dana is her Citizen. In 'horse' Dana has used Brass Horse and picks where to go.
 */
function drumState(scene: DrumScene) {
    const citizen = scene === 'citizen'
    const horse = scene === 'horse'
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Blue,
                status: citizen ? PlayerStatus.Citizen : PlayerStatus.Exile,
                siteId: RIVER,
                supply: 3,
                favor: 4,
                secrets: 2,
                relicIds: horse ? [DRUM, BRASS_HORSE] : [DRUM],
                warbandsOnBoard: citizen ? { [IMPERIAL_WARBANDS]: 2 } : { Dana: 2 }
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Red,
                siteId: GREAT_SLUM,
                supply: 3,
                favor: 3,
                secrets: 2,
                relicIds: [WHISTLE],
                warbandsOnBoard: { Rhys: 9 }
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: mapSlotsFor(Region.Hinterland)[0],
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 }
            })
        ],
        {
            machineState: horse ? MachineState.PowerQuestion : MachineState.ActPhase,
            chancellorPlayerId: 'Ann',
            oathkeeperPlayerId: 'Rhys',
            oathRevision: OathRevision.EngineFixes3,
            map: allMapSlots(),
            siteCards: {
                ...fixtureSitesOnTheBoard(),
                [GREAT_SLUM]: 'site.great-slums',
                [RIVER]: 'site.river'
            },
            denizensBySite: {
                [GREAT_SLUM]: scene === 'toll' ? ['denizen.order.toll-roads'] : [],
                [RIVER]: []
            },
            warbandsBySite: { [GREAT_SLUM]: { Rhys: 2 } },
            pendingQuestions: horse
                ? {
                      queue: [
                          {
                              kind: PowerQuestionKind.TravelFreeTo,
                              cardId: BRASS_HORSE,
                              askedPlayerId: 'Dana',
                              siteIds: [GREAT_SLUM]
                          }
                      ],
                      askingPlayerId: 'Dana',
                      resumeMachineState: MachineState.ActPhase
                  }
                : undefined
        }
    )
    const turn = horse ? 'Dana' : 'Rhys'
    openTurn(state, turn)
    state.activePlayerIds = horse ? ['Dana'] : [turn]
    state.vault = testVaultWithRelics({})
    return state
}

/** Rhys uses the Whistle on Dana, who then holds the Drum at the Great Slum (or is first asked Toll Roads). */
function drumTable(scene: DrumScene): PlayedTable {
    const table = tableOf(drumState(scene))
    if (scene === 'horse') return table
    return played(table, [
        createAction(UseActionPower, {
            ...envelope(table),
            playerId: 'Rhys',
            cardId: WHISTLE,
            powerIndex: powerIndexOf(WHISTLE, PowerTiming.Action),
            choices: [{ kind: PowerChoiceKind.Player, playerId: 'Dana' }]
        })
    ])
}

/** The History's rows for each scene, oldest first, as their records hold them. */
type HistoryScene = 'act' | 'campaign' | 'deals'

/**
 * The History's words, read from records alone: Ann (blue, on the clock) reads the rows of Dana
 * (a red Exile) and Rhys (the purple Chancellor). The rows are the records the engine wrote, each
 * stamped a few minutes apart, so the History shows them as a game would.
 */
function historyWordsTable(scene: HistoryScene): PlayedTable {
    const [slum, hidden] = mapSlotsFor(Region.Cradle)
    const [plains, saltFlats] = mapSlotsFor(Region.Provinces)
    const [mine, wood] = mapSlotsFor(Region.Hinterland)
    const state = testState(
        [
            testPlayer({ playerId: 'ann', color: Color.Blue, siteId: plains, favor: 4 }),
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: slum, favor: 3 }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: saltFlats,
                favor: 5
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'rhys',
            map: allMapSlots(),
            siteCards: {
                [slum]: 'site.great-slums',
                [hidden]: 'site.the-hidden-place',
                [plains]: 'site.plains',
                [saltFlats]: 'site.salt-flats',
                [mine]: 'site.mine',
                [wood]: 'site.shrouded-wood'
            }
        }
    )
    openTurn(state, 'ann')
    state.activePlayerIds = ['ann']
    state.vault = testVaultWithRelics({})
    const table = tableOf(state)
    const battle = { attackPool: 6, defensePool: 4, defense: 4, swords: 5, skullsKilled: 0 }
    const rows: Record<
        HistoryScene,
        ({ type: ActionType; playerId: string } & Record<string, unknown>)[]
    > = {
        act: [
            {
                type: ActionType.Recover,
                playerId: 'dana',
                target: { kind: 'banner', banner: Banner.PeoplesFavor },
                amountPaid: 3,
                metadata: { supplySpent: 1, amountPaid: 3 }
            },
            {
                type: ActionType.Muster,
                playerId: 'dana',
                cardId: 'denizen.order.council-seat',
                metadata: { supplySpent: 1, warbandsGained: 2, warbandOwner: 'dana' }
            },
            {
                type: ActionType.Trade,
                playerId: 'rhys',
                cardId: 'denizen.hearth.tavern-songs',
                option: 'forSecrets',
                metadata: {
                    supplySpent: 1,
                    matchingAdvisers: 0,
                    favorGained: 1,
                    secretsGained: 0,
                    modifiers: ['reliquary.careless'],
                    modifierNotes: ['Careless: gained 1 favor']
                }
            },
            {
                type: ActionType.SearchResolve,
                playerId: 'dana',
                keptCardId: 'denizen.beast.wolves',
                discardOrder: [],
                play: SearchPlay.Adviser,
                faceUp: false,
                metadata: {
                    discardedCardIds: [],
                    discardedCount: 0,
                    discardPileRegion: Region.Cradle,
                    favorGained: 0
                }
            },
            {
                type: ActionType.Search,
                playerId: 'dana',
                drawFrom: SearchSource.WorldDeck,
                metadata: {
                    supplySpent: 2,
                    cardsDrawn: 3,
                    visionsDrawn: 0,
                    tollsPaid: ['denizen.order.forced-labor: gave a favor to rhys']
                }
            },
            {
                type: ActionType.Travel,
                playerId: 'dana',
                siteId: slum,
                metadata: {
                    supplySpent: 2,
                    supplyRemaining: 1,
                    tollsPaid: ['denizen.order.toll-roads: gave a favor to rhys'],
                    modifiers: ['relic.dragonskin-drum'],
                    modifierNotes: ['Dragonskin Drum: gained 1 warband']
                }
            }
        ],
        campaign: [
            {
                type: ActionType.Campaign,
                playerId: 'dana',
                defender: { kind: 'player', playerId: 'rhys' },
                targets: [
                    { kind: CampaignTargetKind.Site, siteId: plains },
                    { kind: CampaignTargetKind.Banner, banner: Banner.PeoplesFavor },
                    { kind: CampaignTargetKind.PawnAndFavor }
                ],
                attackDice: 6,
                plans: [
                    {
                        cardId: 'denizen.order.field-promotion',
                        powerIndex: powerIndexOf(
                            'denizen.order.field-promotion',
                            PowerTiming.BattlePlan
                        )
                    }
                ],
                metadata: {
                    supplySpent: 2,
                    battle: { ...battle, defense: 0, swords: 0, awaitingDefender: true }
                }
            },
            {
                type: ActionType.CampaignDefend,
                playerId: 'rhys',
                plans: [],
                metadata: { ...battle, plansUsed: [] }
            },
            {
                type: ActionType.CampaignSacrifice,
                playerId: 'dana',
                sacrifice: 1,
                metadata: {
                    attack: 6,
                    defense: 4,
                    attackerVictorious: true,
                    sacrificed: 1,
                    awaitingLossesOf: 'rhys'
                }
            },
            {
                type: ActionType.CampaignDefeatKills,
                playerId: 'rhys',
                kills: [
                    { at: { kind: 'site', siteId: plains }, owner: IMPERIAL_WARBANDS, count: 2 }
                ],
                metadata: { defeatKilled: 2 }
            },
            {
                type: ActionType.CampaignResolveVictory,
                playerId: 'dana',
                placements: [{ siteId: plains, owner: 'dana', count: 2 }],
                banishToSiteId: saltFlats,
                burnFavor: true,
                metadata: {
                    warbandsPlaced: 2,
                    relicsTaken: [],
                    bannersSeized: [Banner.PeoplesFavor],
                    seizeBurned: 2,
                    banishedToSiteId: saltFlats,
                    favorBurned: 3,
                    defenderPlayerId: 'rhys',
                    triggered: ['Field Promotion: dana gained 3 warbands']
                }
            }
        ],
        deals: [
            {
                type: ActionType.SetupChoice,
                playerId: 'rhys',
                siteId: saltFlats,
                adviserCardId: 'denizen.order.scouts',
                discardOrder: [],
                siteFavor: [
                    { siteCardId: 'site.salt-flats', favor: 2 },
                    { siteCardId: 'site.mine', favor: 2 }
                ],
                metadata: { discardPileRegion: Region.Cradle }
            },
            {
                type: ActionType.AnswerQuestion,
                playerId: 'ann',
                answer: { kind: PowerQuestionKind.PlayOrDiscardVision, play: SearchPlay.Adviser },
                metadata: {
                    cardId: 'denizen.discord.false-prophet',
                    kind: PowerQuestionKind.PlayOrDiscardVision,
                    summary: 'played vision.faith (adviser)',
                    resumeMachineState: MachineState.ActPhase,
                    last: true
                }
            },
            {
                type: ActionType.OfferCitizenship,
                playerId: 'rhys',
                exilePlayerId: 'dana',
                reliquarySlotId: reliquarySlotId(1),
                terms: { fromScepterHolder: { favor: 2 }, fromExile: { secrets: 1 } }
            },
            {
                type: ActionType.AnswerQuestion,
                playerId: 'rhys',
                answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: hidden },
                metadata: {
                    cardId: 'site.shrouded-wood',
                    kind: PowerQuestionKind.ShroudedWoodDestination,
                    summary: `sent dana to ${hidden}`,
                    resumeMachineState: MachineState.ActPhase,
                    last: true,
                    woodPick: {
                        travelerPlayerId: 'dana',
                        siteId: hidden,
                        supplySpent: 2,
                        supplyRemaining: 3
                    }
                }
            },
            {
                type: ActionType.UseActionPower,
                playerId: 'dana',
                cardId: 'denizen.hearth.deed-writer',
                powerIndex: powerIndexOf('denizen.hearth.deed-writer', PowerTiming.Action),
                choices: [
                    {
                        kind: PowerChoiceKind.Exchange,
                        withPlayerId: 'ann',
                        terms: {
                            fromProposer: { favor: 2 },
                            fromCounterparty: { sites: [{ siteId: plains, warbands: 2 }] }
                        }
                    }
                ],
                metadata: { summary: 'Deed Writer: proposed a binding exchange to ann' }
            },
            {
                type: ActionType.AnswerQuestion,
                playerId: 'ann',
                answer: { kind: PowerQuestionKind.Exchange, accept: true },
                metadata: {
                    cardId: 'denizen.hearth.deed-writer',
                    kind: PowerQuestionKind.Exchange,
                    summary: "accepted dana's exchange",
                    resumeMachineState: MachineState.ActPhase,
                    last: true
                }
            }
        ]
    }
    const recorded = rows[scene]
    // Five minutes apart, the last one just now.
    const actions = recorded.map((fields, index): GameAction => ({
        id: `history-${scene}-${index}`,
        gameId: state.gameId,
        source: ActionSource.User,
        index,
        createdAt: new Date(Date.now() - (recorded.length - 1 - index) * 5 * 60_000),
        ...fields
    }))
    // The session checks the state's count and checksum against the history it is given.
    const recordedState = {
        ...table.state,
        actionCount: actions.length,
        actionChecksum: calculateActionChecksum(0, actions)
    }
    return { state: recordedState, actions }
}

const TABLES: Record<TableName, () => PlayedTable> = {
    drumAsked: () => drumTable('whistle'),
    drumAskedCitizen: () => drumTable('citizen'),
    drumAfterToll: () => drumTable('toll'),
    drumAfterBrassHorse: () => drumTable('horse'),
    banditCrown: () => banditCrownTable('citizen'),
    banditCrownChancellor: () => banditCrownTable('chancellor'),
    banditCrownExile: () => banditCrownTable('exile'),
    banditCrownCampaign: () => banditCrownTable('campaign'),
    banditCrownFive: () => banditCrownTable('five'),
    campaignLossOrder: () => campaignTable(true, true),
    skullLosses: () => forceInPlacesTable('skulls', 1),
    skullLossesTwoSites: () => forceInPlacesTable('skulls', 2),
    sacrificeInTwoPlaces: () => forceInPlacesTable('sacrifice', 1),
    freeTravelAsked: () => freeActionAskedTable(ActionType.Travel),
    freeCampaignAsked: () => freeActionAskedTable(ActionType.Campaign),
    warbandGiveAsked: warbandGiveAskedTable,
    offerCitizenship: () => offerCitizenshipTable('two'),
    offerCitizenshipToOne: () => offerCitizenshipTable('one'),
    offerCitizenshipSilenced: () => offerCitizenshipTable('silenced'),
    offerCitizenshipSelf: () => offerCitizenshipTable('self'),
    everyMinor: everyMinorTable,
    show: () => showTable('dana'),
    showOne: () => showTable('rhys'),
    harpSearch: harpSearchTable,
    usePower: usePowerTable,
    witchsBargain: () => witchsBargainTable(false, false),
    witchsBargainSilenced: () => witchsBargainTable(true, false),
    witchsBargainOneOther: () => witchsBargainTable(false, true),
    modifierTravel: () => modifierTable('modifierTravel'),
    modifierMuster: () => modifierTable('modifierMuster'),
    modifierTrade: () => modifierTable('modifierTrade'),
    modifierSearch: () => modifierTable('modifierSearch'),
    facedownCards: () => facedownTable('facedownCards'),
    facedownFullSite: () => facedownTable('facedownFullSite'),
    facedownNewGrowth: () => facedownTable('facedownNewGrowth'),
    greatHerdFlip: greatHerdFlipTable,
    modifierPair: () => modifierTable('modifierPair'),
    smallFriendsSites: () => tradeSitesTable('smallFriendsSites'),
    disguiseBorrowed: () => tradeSitesTable('disguiseBorrowed'),
    exileCitizens: exileCitizensTable,
    selfExile: selfExileTable,
    setup: setupTable,
    shortBank: shortBankTable,
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
    restRefused: restRefusedTable,
    kinshipSeat: kinshipSeatTable,
    restTurnFlow: restTurnFlowTable,
    wakeMob: () => wakeTable('mob'),
    wakeMobReturn: () => wakeTable('mobReturn'),
    wakeSite: () => wakeTable('site'),
    wakeForced: () => wakeTable('forced'),
    kinshipWake: kinshipWakeTable,
    kinshipPlague: kinshipPlagueTable,
    kinshipDissent: kinshipDissentTable,
    endOfRound: endOfRoundTable,
    goalsRail: () => goalsRailTable(),
    goalsRailThePeople: () => goalsRailTable(OathType.ThePeople),
    goalsRailProtection: () => goalsRailTable(OathType.Protection),
    goalsRailDevotion: () => goalsRailTable(OathType.Devotion),
    trade: tradeTable,
    careless: carelessTable,
    musterEmptyBank: musterEmptyBankTable,
    recover: recoverTable,
    recoverSeen: recoverSeenTable,
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
    hospitality: () => hospitalityTable('plain'),
    hospitalityToll: () => hospitalityTable('toll'),
    hospitalityHiddenPlace: () => hospitalityTable('hiddenPlace'),
    majorEvents: majorEventsTable,
    sinceLastTurn: () => sinceLastTurnTable(false),
    sinceLastTurnLong: () => sinceLastTurnTable(true),
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
    searchTollByRhys: searchTollByRhysTable,
    searchConspiracy: searchConspiracyTable,
    searchConspiracyNoTake: searchConspiracyNoTakeTable,
    flipConspiracyNoTake: flipConspiracyNoTakeTable,
    campaignTwoDefenders: () => campaignTable(false),
    heldAttack: () => heldAttackTable(),
    heldAttackKept: () => heldAttackTable('keep'),
    heldAttackRerolled: () => heldAttackTable('reroll'),
    battleDefenderPlans: () => battleTable('defenderPlans'),
    // R-7.1.2 — plans that cost favor beside a free one: Shield Wall 1, Hearts and Minds 3.
    battlePlanCosts: () =>
        tableOf(
            battleState('defenderPlans', [
                WILD_MOUNTS,
                'denizen.order.shield-wall',
                'denizen.hearth.hearts-and-minds'
            ])
        ),
    attackerPlans: () => battleTable('attackerPlans'),
    sacrifice: () => battleTable('sacrifice'),
    sacrificeMixed: () => battleTable('sacrificeMixed'),
    sacrificeSplit: () => sacrificeSplitTable(3, 2),
    sacrificeShort: () => sacrificeSplitTable(1, 1),
    sacrificeWhole: () => sacrificeSplitTable(2, 1),
    wonOutright: () => battleTable('wonOutright'),
    spoils: () => battleTable('spoils'),
    spoilsRelicHunter: spoilsRelicHunterTable,
    ...QUESTION_TABLES,
    oathkeeperTie: oathkeeperTieTable,
    tavernSongs: tavernSongsTable,
    usurperWins: usurperWinsTable,
    deedWriter: deedWriterTable,
    exchangeDeed: () => exchangeTable('exchangeDeed'),
    exchangeDeedEmptyBoard: () => exchangeTable('exchangeDeedEmptyBoard'),
    exchangeDeedSwap: () => exchangeTable('exchangeDeedSwap'),
    exchangeTinkers: () => exchangeTable('exchangeTinkers'),
    exchangeGathering: () => exchangeTable('exchangeGathering'),
    woodTraveller: () => tableOf(shroudedWoodState(2, { onBoard: true })),
    woodRuler: woodRulerTable,
    woodRulerToll: woodRulerTollTable,
    woodTollAsked: woodTollAskedTable,
    woodCards: () => tableOf(woodCardsState()),
    woodCardsRuler: () => woodCardsRulerTable({}, [TENTS, FOREST_PATHS]),
    woodCardsLow: () => tableOf(woodCardsLowState()),
    woodStays: () =>
        woodCardsRulerTable({ supply: 1, favor: 1, advisers: [FOREST_PATHS] }, [FOREST_PATHS]),
    // R-11.7-H3 — Dana set out with no card; a pick of the Great Slum asks Way Station's question.
    woodWayStationPick: () => woodCardsRulerTable({ advisers: [] }, []),
    woodHospitality: () => tableOf(woodHospitalityState()),
    woodHospitalityAsked: woodHospitalityAskedTable,
    woodPickWhistle: () => woodPickTable('whistle'),
    woodPickWhistleAway: () => woodPickTable('whistleAway'),
    woodPickWhistleToll: () => woodPickTable('whistleToll'),
    woodPickHorse: () => woodPickTable('horseWood'),
    woodPickPalanquin: () => woodPickTable('palanquin'),
    woodPickBanish: () => woodPickTable('banish'),
    horseOwnPick: () => woodPickTable('horseOwn'),
    tollAsked: tollAskedTable,
    oracleToll: () => oracleTable(4),
    oracleNoFavor: () => oracleTable(0),
    messenger: messengerTable,
    messengerTwoOwners: messengerTwoOwnersTable,
    warningSignals: warningSignalsTable,
    pickerWhistle: () => powerPickerTable('pickerWhistle'),
    pickerTerror: () => powerPickerTable('pickerTerror'),
    pickerPact: () => powerPickerTable('pickerPact'),
    pickerCage: () => powerPickerTable('pickerCage'),
    pickerSites: () => powerSitesTable('pickerSites'),
    pickerSitesOne: () => powerSitesTable('pickerSitesOne'),
    pickerPalanquin: () => powerSitesTable('pickerPalanquin'),
    pickerPiles: () => pickerTwoTable('pickerPiles'),
    pickerBanks: () => pickerTwoTable('pickerBanks'),
    pickerSalad: () => pickerTwoTable('pickerSalad'),
    pickerSaladShort: () => pickerTwoTable('pickerSaladShort'),
    pickerSaladSite: () => pickerTwoTable('pickerSaladSite'),
    pickerSaladSiteTwo: () => pickerTwoTable('pickerSaladSiteTwo'),
    pickerSaladNoBeast: () => pickerTwoTable('pickerSaladNoBeast'),
    pickerMay: () => pickerTwoTable('pickerMay'),
    pickerMayCitizen: () => pickerTwoTable('pickerMayCitizen'),
    pickerVault: () => pickerTwoTable('pickerVault'),
    pickerVaultLast: () => pickerTwoTable('pickerVaultLast'),
    pickerFacedownBracken: () => pickerTwoTable('pickerFacedownBracken'),
    historyAct: () => historyWordsTable('act'),
    historyCampaign: () => historyWordsTable('campaign'),
    historyDeals: () => historyWordsTable('deals')
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
    session = await openSessionOn(TABLES[name]())
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

/** The last Action sent, when it let another player peek: whom, and what (R-6.1, R-6.6.1). */
export function lastLetPeek(): { toPlayerId: string; subject: LetPeekSubject } | undefined {
    const action = current().actions.at(-1)
    return isLetPeek(action)
        ? { toPlayerId: action.toPlayerId, subject: action.subject }
        : undefined
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
    secretsOf: Record<string, number>
    favorBank: Record<Suit, number>
    secretsOn: Record<string, number>
    discardPiles: Record<Region, number>
    darkestSecret: number
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
        secretsOf: Object.fromEntries(
            state.players.map((player) => [player.playerId, player.secrets])
        ),
        favorBank: state.favorBank,
        secretsOn: Object.fromEntries(
            Object.entries(state.cardTokens).map(([cardId, tokens]) => [cardId, tokens.secrets])
        ),
        discardPiles: state.discardPileCounts,
        darkestSecret: state.banners[Banner.DarkestSecret].value
    }
}

/** R-5.6 — the destinations the engine accepts for the seat on screen's Travel, with no modifier declared. */
export function legalTravelDestinations(): string[] {
    const table = current()
    const seatId = table.myPlayer?.id
    assertExists(seatId, 'A seat is on the clock')
    return HydratedTravel.legalDestinations(table.gameState, seatId, [])
}

/** Each seat's standing, and the request the game waits on, if any (R-6.6, R-6.7, R-6.8). */
export function standing(): {
    statusOf: Record<string, PlayerStatus>
    asked?: { kind: string; askedPlayerId: string }
} {
    const state = current().gameState
    const pending = state.pendingConsent
    return {
        statusOf: Object.fromEntries(state.players.map((player) => [player.playerId, player.status])),
        ...(pending
            ? { asked: { kind: pending.request.kind, askedPlayerId: pending.askedPlayerId } }
            : {})
    }
}

/** R-6.6.1 — the terms of the Citizenship offer the game waits on: `none` when it carries none. */
export function offeredCitizenshipTerms(): CitizenshipTerms | 'none' | undefined {
    const request = current().gameState.pendingConsent?.request
    if (request?.kind !== ConsentRequestKind.CitizenshipOffer) return undefined
    return request.terms ?? 'none'
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
