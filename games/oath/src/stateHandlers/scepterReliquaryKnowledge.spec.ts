// R-6.4-H1 — the Grand Scepter's holder knows the Reliquary from setup, and at once when the Scepter
// is given; a holder who took it learns it once the card's lock lifts: "You cannot use this if you
// took it on this turn", and one of its uses is "Action: Peek in the Imperial Reliquary". Its Q&A:
// a Scepter given in an exchange was not taken. A former holder keeps what they saw.
import { describe, expect, it } from 'vitest'
import { Color, assertExists, type GameAction } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { servedJson, spectator } from '../testing/projection.js'
import { required } from '../testing/required.js'
import '../powers/index.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { PlayerStatus } from '../model/oathEnums.js'
import type { OathProjectedState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { PowerQuestionKind } from '../model/question.js'
import { PowerChoiceKind } from '../util/powerChoice.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { Campaign } from '../actions/campaign.js'
import { CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { Recover, RecoverTargetKind } from '../actions/recover.js'
import { Travel } from '../actions/travel.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { AnswerQuestion } from '../actions/answerQuestion.js'
import { OathRevision } from '../util/revision.js'

const DANA = 'Dana'
const RHYS = 'Rhys'
const MARA = 'Mara'
const BEA = 'Bea'

const NOW = OathRevision.EngineFixes8
const BEFORE = OathRevision.EngineFixes7

const RELIC_A = 'relic.unnamed-1'
const RELIC_B = 'relic.unnamed-2'
const RELIQUARY = ['reliquary.0', 'reliquary.1']
/** Ancient City's Recover cost: place three favor in the Order bank. */
const ANCIENT_CITY = 'site.ancient-city'
const SITE_SLOT = 'site-relic.0'
const TINKERS_FAIR = 'denizen.hearth.tinkers-fair'
const RELIC_THIEF = 'denizen.discord.relic-thief'

const KNOWS_ALL = {
    peekedRelicSlotIds: RELIQUARY,
    peekedRelics: { 'reliquary.0': RELIC_A, 'reliquary.1': RELIC_B }
}

const seat = (playerId: string, color: Color, more: Partial<OathPlayerState> = {}) =>
    testPlayer({
        playerId,
        color,
        status: PlayerStatus.Exile,
        siteId: 'c1',
        favor: 5,
        secrets: 3,
        supply: 7,
        warbandsOnBoard: { [playerId]: 3 },
        warbandsInPersonalBank: { [playerId]: 8 },
        ...more
    })

/**
 * Rhys, Dana and Mara are Exiles at c1, whose site card is Ancient City; Bea is the Chancellor at
 * h3. The Reliquary holds two relics; a relic at c1 is in `SITE_SLOT`. Rhys's turn comes first.
 */
function table(
    revision: OathRevision,
    seats: Partial<Record<string, Partial<OathPlayerState>>>,
    overrides: Partial<OathProjectedState> = {},
    active = RHYS,
    seed = 1
): OathProjectedState {
    const players = [
        seat(RHYS, Color.Red, seats[RHYS]),
        seat(DANA, Color.Yellow, seats[DANA]),
        seat(MARA, Color.White, seats[MARA]),
        testPlayer({
            playerId: BEA,
            color: Color.Purple,
            status: PlayerStatus.Chancellor,
            siteId: 'h3',
            ...seats[BEA]
        })
    ]
    const vault = testVaultWithRelics({ 'reliquary.0': RELIC_A, 'reliquary.1': RELIC_B })
    const state = testState(players, {
        chancellorPlayerId: BEA,
        reliquary: RELIQUARY.map((slotId) => ({ slotId })),
        vault,
        siteCards: {
            c1: ANCIENT_CITY,
            c2: 'c2',
            p1: 'p1',
            p2: 'p2',
            p3: 'p3',
            h1: 'h1',
            h2: 'h2',
            h3: 'h3'
        },
        prng: { seed, invocations: 0 },
        ...overrides
    }).dehydrate()
    state.oathRevision = revision
    const order = players.map((p) => p.playerId)
    state.turnManager = {
        series: [{ type: 'turn', playerId: active, start: 0 }],
        turnOrder: order,
        turnCounts: Object.fromEntries(order.map((id) => [id, 0]))
    }
    state.activePlayerIds = [active]
    return state
}

/** The Scepter lies facedown at c1, where Recover can take it. */
function scepterAtC1(state: OathProjectedState): OathProjectedState {
    state.relicsBySite = { ...state.relicsBySite, c1: [{ slotId: SITE_SLOT }] }
    required(state.vault, "the host's vault").relicFacedown[SITE_SLOT] = GRAND_SCEPTER_ID
    return state
}

function runner(start: OathProjectedState) {
    const game = testGame(start.players.map((p) => p.playerId))
    let state = start
    return {
        step(action: GameAction) {
            const result = engine.runNext(action, state, game)
            state = result.updatedState
            return result
        },
        get state() {
            return state
        },
        /** The Reliquary spaces `playerId` knows, by the state's own record. */
        knows(playerId: string): string[] {
            const player = state.players.find((p) => p.playerId === playerId)
            assertExists(player, `no player ${playerId}`)
            return [...player.peekedRelicSlotIds].sort()
        },
        /** Whether a seat's (or a spectator's) served view names a Reliquary relic. */
        seesReliquary(playerId?: string): boolean {
            const view = servedJson(
                state,
                playerId === undefined ? spectator : { kind: 'player', playerId }
            )
            return view.includes(`"${RELIC_A}"`) || view.includes(`"${RELIC_B}"`)
        }
    }
}
type Runner = ReturnType<typeof runner>

const recover = (playerId: string) =>
    buildAction(Recover, {
        playerId,
        target: { kind: RecoverTargetKind.Relic, slotId: SITE_SLOT }
    })

const endActPhase = (playerId: string) => buildAction(EndActPhase, { playerId })

/** Tinker's Fair at c1: `playerId` gives the Scepter for one favor, or gets it for one. */
function scepterExchange(proposerId: string, withPlayerId: string, proposerGives: boolean) {
    const scepter = { relicCardIds: [GRAND_SCEPTER_ID] }
    const favor = { favor: 1 }
    return buildAction(UseActionPower, {
        playerId: proposerId,
        cardId: TINKERS_FAIR,
        powerIndex: powerIndexOf(TINKERS_FAIR, PowerTiming.Action),
        choices: [
            {
                kind: PowerChoiceKind.Exchange,
                withPlayerId,
                terms: proposerGives
                    ? { fromProposer: scepter, fromCounterparty: favor }
                    : { fromProposer: favor, fromCounterparty: scepter }
            }
        ]
    })
}

const accept = (playerId: string) =>
    buildAction(AnswerQuestion, {
        playerId,
        answer: { kind: PowerQuestionKind.Exchange, accept: true }
    })

/** Every seat but the Scepter's former holders, and a spectator, see no Reliquary relic. */
function nobodySees(r: Runner, except: string[] = []) {
    for (const playerId of [RHYS, DANA, MARA, BEA].filter((id) => !except.includes(id))) {
        expect(r.seesReliquary(playerId), playerId).toBe(false)
    }
    expect(r.seesReliquary(), 'a spectator').toBe(false)
}

describe('R-6.4-H1 — a Grand Scepter taken in a Campaign teaches its taker the Reliquary from the next turn', () => {
    // Rhys attacks Dana, who holds the Scepter and knows the Reliquary, and targets the Scepter.
    const CAMPAIGN = buildAction(Campaign, {
        playerId: RHYS,
        defender: { kind: 'player', playerId: DANA },
        targets: [{ kind: CampaignTargetKind.Relic, cardId: GRAND_SCEPTER_ID }],
        attackDice: 10
    })

    function taken(revision: OathRevision) {
        for (let seed = 1; seed < 400; seed++) {
            const r = runner(
                table(
                    revision,
                    {
                        [RHYS]: { warbandsOnBoard: { [RHYS]: 10 } },
                        [DANA]: { relicIds: [GRAND_SCEPTER_ID], ...KNOWS_ALL }
                    },
                    {},
                    RHYS,
                    seed
                )
            )
            r.step(CAMPAIGN)
            const campaign = r.state.campaign
            if (!campaign || campaign.swords <= campaign.defense) continue
            r.step(buildAction(CampaignSacrifice, { playerId: RHYS, sacrifice: 0 }))
            if (r.state.machineState !== MachineState.CampaignVictory) continue
            const victory = r.step(
                buildAction(CampaignResolveVictory, { playerId: RHYS, placements: [] })
            )
            expect(r.state.players[0].relicIds).toEqual([GRAND_SCEPTER_ID])
            return { r, victory }
        }
        throw Error('no seed gave Rhys the victory')
    }

    it("Rhys's view does not hold the Reliquary for the rest of that turn, and does once the turn is over; Dana keeps what they saw", () => {
        const { r, victory } = taken(NOW)
        expect(r.knows(RHYS)).toEqual([])
        // The take reveals nothing hidden, so Undo is not barred by a teach.
        expect(victory.processedActions[0].revealsInfo).toBe(false)
        nobodySees(r, [DANA])
        expect(r.seesReliquary(DANA)).toBe(true)

        r.step(buildAction(Travel, { playerId: RHYS, siteId: 'c2' }))
        expect(r.state.machineState).toBe(MachineState.ActPhase)
        expect(r.knows(RHYS)).toEqual([])
        nobodySees(r, [DANA])

        const ended = r.step(endActPhase(RHYS))
        expect(r.state.turnManager.series.at(-1)?.playerId).toBe(DANA)
        expect(r.knows(RHYS)).toEqual(RELIQUARY)
        expect(r.seesReliquary(RHYS)).toBe(true)
        // Learning it is an Undo barrier, on the step that ended the turn.
        expect(ended.processedActions.some((a) => a.revealsInfo === true)).toBe(true)
        expect(r.knows(DANA)).toEqual(RELIQUARY)
        expect(r.seesReliquary(MARA)).toBe(false)
    })

    it('before revision 12 (R-X.4) the taker learns it at once, as recorded', () => {
        const { r, victory } = taken(BEFORE)
        expect(r.knows(RHYS)).toEqual(RELIQUARY)
        expect(victory.processedActions[0].revealsInfo).toBe(true)
    })
})

describe('R-6.4-H1 — a Grand Scepter recovered teaches its taker the Reliquary from the next turn', () => {
    const start = (revision: OathRevision) =>
        scepterAtC1(table(revision, {}, { warbandsBySite: { c1: { [RHYS]: 1 } } }))

    it('nobody is shown a Reliquary relic on the turn it is taken; the taker is from the next turn', () => {
        const r = runner(start(NOW))
        r.step(recover(RHYS))
        expect(r.state.players[0].relicIds).toEqual([GRAND_SCEPTER_ID])
        expect(r.knows(RHYS)).toEqual([])
        nobodySees(r)
        r.step(endActPhase(RHYS))
        expect(r.knows(RHYS)).toEqual(RELIQUARY)
        expect(r.seesReliquary(RHYS)).toBe(true)
        nobodySees(r, [RHYS])
    })

    it('before revision 12 (R-X.4) the taker learns it with the Recover', () => {
        const r = runner(start(BEFORE))
        r.step(recover(RHYS))
        expect(r.knows(RHYS)).toEqual(RELIQUARY)
        expect(r.seesReliquary(RHYS)).toBe(true)
    })
})

describe("R-6.4-H1 — a Grand Scepter Relic Thief takes on another player's turn is learned when that turn ends", () => {
    // Dana recovers the Scepter on their turn; Mara, in the same region with Relic Thief, rolls for it.
    it('neither Dana, who held it, nor Mara, who took it from them, learns it on Dana’s turn; Mara does once it ends', () => {
        for (let seed = 1; seed < 400; seed++) {
            const r = runner(
                scepterAtC1(
                    table(
                        NOW,
                        { [MARA]: { advisers: [{ cardId: RELIC_THIEF, faceUp: true }] } },
                        { warbandsBySite: { c1: { [DANA]: 1 } } },
                        DANA,
                        seed
                    )
                )
            )
            r.step(recover(DANA))
            expect(r.state.pendingQuestions?.queue[0]?.kind).toBe(PowerQuestionKind.RelicThiefRoll)
            expect(r.knows(DANA)).toEqual([])
            r.step(
                buildAction(AnswerQuestion, {
                    playerId: MARA,
                    answer: { kind: PowerQuestionKind.RelicThiefRoll, roll: true }
                })
            )
            const mara = r.state.players.find((p) => p.playerId === MARA)
            if (!mara?.relicIds.includes(GRAND_SCEPTER_ID)) continue
            expect(r.state.machineState).toBe(MachineState.ActPhase)
            expect([r.knows(DANA), r.knows(MARA)]).toEqual([[], []])
            nobodySees(r)
            r.step(endActPhase(DANA))
            expect([r.knows(DANA), r.knows(MARA)]).toEqual([[], RELIQUARY])
            nobodySees(r, [MARA])
            return
        }
        throw Error('no seed where the thief roll takes the Scepter')
    })
})

describe('R-6.4-H1 — a Grand Scepter given in an exchange is known at once (its Q&A: given is not taken)', () => {
    it("Rhys gets it from Dana through Tinker's Fair, and knows the Reliquary with the answer", () => {
        const r = runner(
            table(
                NOW,
                { [DANA]: { relicIds: [GRAND_SCEPTER_ID], ...KNOWS_ALL } },
                { denizensBySite: { c1: [TINKERS_FAIR] }, warbandsBySite: { c1: { [RHYS]: 1 } } }
            )
        )
        r.step(scepterExchange(RHYS, DANA, false))
        expect(r.knows(RHYS)).toEqual([])
        const answered = r.step(accept(DANA))
        expect(r.state.players[0].relicIds).toEqual([GRAND_SCEPTER_ID])
        expect(r.knows(RHYS)).toEqual(RELIQUARY)
        expect(r.seesReliquary(RHYS)).toBe(true)
        expect(answered.processedActions[0].revealsInfo).toBe(true)
        expect(r.seesReliquary(MARA)).toBe(false)
    })

    it('taken and then given on the same turn: the receiver knows it at once, and the taker never learns it', () => {
        const r = runner(
            scepterAtC1(
                table(
                    NOW,
                    {},
                    {
                        denizensBySite: { c1: [TINKERS_FAIR] },
                        warbandsBySite: { c1: { [RHYS]: 1 } }
                    }
                )
            )
        )
        r.step(recover(RHYS))
        expect(r.knows(RHYS)).toEqual([])
        r.step(scepterExchange(RHYS, MARA, true))
        r.step(accept(MARA))
        expect(r.knows(MARA)).toEqual(RELIQUARY)
        expect(r.seesReliquary(MARA)).toBe(true)
        nobodySees(r, [MARA])
        r.step(endActPhase(RHYS))
        expect(r.knows(RHYS)).toEqual([])
        nobodySees(r, [MARA])
    })
})

describe('R-6.4-H1 — a turn change teaches nobody who did not take the Scepter on it', () => {
    it('the holder from before the turn, who already knows it, is taught nothing new', () => {
        const r = runner(table(NOW, { [RHYS]: { relicIds: [GRAND_SCEPTER_ID], ...KNOWS_ALL } }))
        const ended = r.step(endActPhase(RHYS))
        expect(ended.processedActions.map((a) => a.type)).toContain(ActionType.CompleteRest)
        expect(ended.processedActions.every((a) => a.revealsInfo !== true)).toBe(true)
        expect(r.knows(RHYS)).toEqual(RELIQUARY)
    })
})
