// R-2.11-H1 — the Oathkeeper title is judged after each Law action, and a Campaign's Steps 1–8
// (R-5.5) are one. Law 2.11: "If multiple players meet its goal but the holder does not, the holder
// chooses one of those other players to take it." Fae Merchant's Q&A: "Only count your number of
// relics after you have completed this action." Relic Thief's Q&A judges "at each moment that
// relics change hands", and each binding exchange is its own moment too.
import { describe, expect, it } from 'vitest'
import { Color, Visibility, assert, assertExists, type GameAction } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { campaignRecords, testBanners, testPlayer, testState } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { FILLER } from '../testing/cards.js'
import { battlePlanUse } from '../testing/choices.js'
import { required } from '../testing/required.js'
import '../powers/index.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { Banner, OathType, PlayerStatus } from '../model/oathEnums.js'
import {
    HydratedOathGameState,
    OathGameStateValidator,
    type OathGameState,
    type OathProjectedState
} from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { PowerQuestionKind, type ExchangeTerms, type QuestionAnswer } from '../model/question.js'
import { PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { Campaign } from '../actions/campaign.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { CampaignSkullLosses } from '../actions/campaignSkullLosses.js'
import { CampaignDefeatKills, HydratedCampaignDefeatKills } from '../actions/campaignDefeatKills.js'
import { CampaignDefend } from '../actions/campaignDefend.js'
import { takeFromGroups } from '../util/force.js'
import { isTransferOathkeeper } from '../actions/transferOathkeeper.js'
import { ResolveOathkeeper } from '../actions/resolveOathkeeper.js'
import { OfferCitizenship } from '../actions/offerCitizenship.js'
import { ResolveCitizenshipOffer } from '../actions/resolveCitizenshipOffer.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { AnswerQuestion } from '../actions/answerQuestion.js'
import { SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { OathRevision } from '../util/revision.js'
import { OathRuntime, OathVisibility } from '../definition/runtime.js'

const DANA = 'Dana'
const RHYS = 'Rhys'
const MARA = 'Mara'
const BEA = 'Bea'
const IMP = IMPERIAL_WARBANDS

const NOW = OathRevision.EngineFixes8
const BEFORE = OathRevision.EngineFixes7

const CHAOS_CULT = 'denizen.discord.chaos-cult'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'
const MARTIAL_CULTURE = 'denizen.order.martial-culture'
const TINKERS_FAIR = 'denizen.hearth.tinkers-fair'
const DEED_WRITER = 'denizen.hearth.deed-writer'
const GATHERING = 'denizen.nomad.the-gathering'
const KEY_TO_THE_CITY = 'denizen.discord.key-to-the-city'
const FAE_MERCHANT = 'denizen.beast.fae-merchant'
const SNEAK_ATTACK = 'denizen.discord.sneak-attack'
const SECOND_WIND = 'denizen.discord.second-wind'
const RELIC_THIEF = 'denizen.discord.relic-thief'
const TOLL_ROADS = 'denizen.order.toll-roads'
const PEACE_ENVOY = 'denizen.order.peace-envoy'
const JINX = 'denizen.arcane.jinx'

const U1 = 'relic.unnamed-1'
const U2 = 'relic.unnamed-2'
const U3 = 'relic.unnamed-3'
const U4 = 'relic.unnamed-4'
const HORN = 'relic.cracked-horn'
const BOOK = 'relic.book-of-records'
const HORSE = 'relic.brass-horse'
const STICKS = 'relic.dowsing-sticks'

/** A table at the given revision, with `active` on the clock in their own Act Phase. */
function table(
    revision: OathRevision,
    players: OathPlayerState[],
    overrides: Partial<OathProjectedState>,
    active: string,
    seed = 1
): OathProjectedState {
    const state = testState(players, {
        machineState: MachineState.ActPhase,
        prng: { seed, invocations: 0 },
        ...overrides
    }).dehydrate()
    state.oathRevision = revision
    const vault = required(state.vault, "the host's vault")
    for (const [i, slot] of state.reliquary.entries()) {
        vault.relicFacedown[slot.slotId] ??= `relic.unnamed-${20 + i}`
    }
    const order = players.map((p) => p.playerId)
    state.turnManager = {
        series: [{ type: 'turn', playerId: active, start: 0 }],
        turnOrder: order,
        turnCounts: Object.fromEntries(order.map((id) => [id, 0]))
    }
    state.activePlayerIds = [active]
    return state
}

/** Every step through the engine, keeping every processed action. */
function runner(start: OathProjectedState) {
    const game = testGame(start.players.map((p) => p.playerId))
    let state = start
    const all: GameAction[] = []
    return {
        step(action: GameAction) {
            const result = engine.runNext(action, state, game)
            all.push(...result.processedActions)
            state = result.updatedState
            return result
        },
        get state() {
            return state
        },
        all,
        transfers: () =>
            all
                .filter(isTransferOathkeeper)
                .map((t) => `${t.fromPlayerId ?? '-'}->${t.toPlayerId ?? '-'}`),
        player(playerId: string) {
            const found = state.players.find((p) => p.playerId === playerId)
            assertExists(found, `no player ${playerId}`)
            return found
        }
    }
}
type Runner = ReturnType<typeof runner>

/** The first seed from which `ok` holds after `first` runs on the table built for it. */
function seedWhere(
    build: (seed: number) => OathProjectedState,
    first: GameAction,
    ok: (state: OathProjectedState) => boolean
): number {
    for (let seed = 1; seed < 8000; seed++) {
        const start = build(seed)
        const game = testGame(start.players.map((p) => p.playerId))
        if (ok(engine.runNext(first, start, game).updatedState)) return seed
    }
    throw Error('no seed')
}

/** R-5.5.6.a — the defeated defending side's losses, from its force in order. */
function defenderLosses(state: OathProjectedState) {
    const hydrated = new HydratedOathGameState(state)
    const force = hydrated.campaign?.defendingForce ?? []
    return takeFromGroups(force, HydratedCampaignDefeatKills.required(hydrated))
}

const won = (s: OathProjectedState) =>
    s.machineState === MachineState.CampaignSacrifice &&
    !!s.campaign &&
    s.campaign.swords > s.campaign.defense

const answer = (playerId: string, a: QuestionAnswer) =>
    buildAction(AnswerQuestion, { playerId, answer: a })

const usePower = (playerId: string, cardId: string, choices?: PowerChoice[]) =>
    buildAction(UseActionPower, {
        playerId,
        cardId,
        powerIndex: powerIndexOf(cardId, PowerTiming.Action),
        choices
    })

const exchange = (withPlayerId: string, terms: ExchangeTerms): PowerChoice => ({
    kind: PowerChoiceKind.Exchange,
    withPlayerId,
    terms
})

const exile = (
    playerId: string,
    color: Color,
    siteId: string,
    more: Partial<OathPlayerState> = {}
) =>
    testPlayer({
        playerId,
        color,
        status: PlayerStatus.Exile,
        siteId,
        favor: 4,
        secrets: 2,
        supply: 7,
        warbandsOnBoard: { [playerId]: 3 },
        warbandsInPersonalBank: { [playerId]: 8 },
        ...more
    })

const chancellor = (playerId: string, siteId: string, more: Partial<OathPlayerState> = {}) =>
    testPlayer({
        playerId,
        color: Color.Purple,
        status: PlayerStatus.Chancellor,
        siteId,
        favor: 4,
        secrets: 2,
        supply: 7,
        relicIds: [GRAND_SCEPTER_ID],
        warbandsOnBoard: { [IMP]: 3 },
        warbandsInPersonalBank: { [IMP]: 10 },
        ...more
    })

// ---------------------------------------------------------------- the Chancellor's Campaign

interface SupremacyOptions {
    empireSites: number
    rhysAdvisers?: string[]
    withBea?: boolean
}

/**
 * Supremacy. Dana, the Chancellor, attacks from p1. Rhys, an Exile, holds the title and rules p1,
 * p2 and p3; Mara rules h1 and h2; the Empire rules `empireSites` of c1 and c2. With Bea, she rules
 * h3 and c2.
 */
function supremacy(revision: OathRevision, options: SupremacyOptions, seed: number) {
    const { empireSites, rhysAdvisers = [], withBea = false } = options
    const empire: Record<string, Record<string, number>> = {}
    for (const siteId of ['c1', 'c2'].slice(0, empireSites)) empire[siteId] = { [IMP]: 1 }
    const seat = (playerId: string, color: Color, siteId: string, advisers: string[] = []) =>
        exile(playerId, color, siteId, {
            favor: 3,
            warbandsOnBoard: {},
            advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
        })
    return table(
        revision,
        [
            chancellor(DANA, 'p1', {
                favor: 3,
                relicIds: [],
                warbandsOnBoard: { [IMP]: 10 },
                warbandsInPersonalBank: { [IMP]: 4 }
            }),
            seat(RHYS, Color.Yellow, 'p1', rhysAdvisers),
            seat(MARA, Color.White, 'h1'),
            ...(withBea ? [seat(BEA, Color.Red, 'h3')] : [])
        ],
        {
            chancellorPlayerId: DANA,
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: RHYS,
            warbandsBySite: {
                p1: { [RHYS]: 1 },
                p2: { [RHYS]: 1 },
                p3: { [RHYS]: 1 },
                h1: { [MARA]: 1 },
                h2: { [MARA]: 1 },
                ...empire,
                ...(withBea ? { h3: { [BEA]: 1 }, c2: { [BEA]: 1 } } : {})
            }
        },
        DANA,
        seed
    )
}

const ON_P1_P2 = buildAction(Campaign, {
    playerId: DANA,
    defender: { kind: 'player', playerId: RHYS },
    targets: [
        { kind: CampaignTargetKind.Site, siteId: 'p1' },
        { kind: CampaignTargetKind.Site, siteId: 'p2' }
    ],
    attackDice: 8
})

/** Declare, sacrifice nothing, and place one Imperial warband on each targeted site. */
function chancellorsCampaign(revision: OathRevision, options: SupremacyOptions) {
    const seed = seedWhere((s) => supremacy(revision, options, s), ON_P1_P2, won)
    const r = runner(supremacy(revision, options, seed))
    r.step(ON_P1_P2)
    r.step(buildAction(CampaignSacrifice, { playerId: DANA, sacrifice: 0 }))
    const holderAfterDefeat = r.state.oathkeeperPlayerId
    const midCampaignChoice = r.state.machineState === MachineState.OathkeeperChoice
    if (midCampaignChoice) {
        r.step(buildAction(ResolveOathkeeper, { playerId: RHYS, chosenPlayerId: MARA }))
    }
    expect(r.state.machineState).toBe(MachineState.CampaignVictory)
    r.step(
        buildAction(CampaignResolveVictory, {
            playerId: DANA,
            placements: [
                { siteId: 'p1', owner: IMP, count: 1 },
                { siteId: 'p2', owner: IMP, count: 1 }
            ]
        })
    )
    return { r, holderAfterDefeat, midCampaignChoice }
}

describe('R-2.11-H1 — a Campaign is one Law action: the title is judged once, after R-5.5.8', () => {
    it('the title passes from Rhys to Dana in one move, never through Mara, and only after the spoils', () => {
        // Before: Rhys 3, Mara 2, the Empire 1. After the defeat: Rhys 1, Mara 2, the Empire 1.
        // After the spoils: the Empire 3.
        const { r, holderAfterDefeat } = chancellorsCampaign(NOW, { empireSites: 1 })
        expect({
            transfers: r.transfers(),
            holderAfterDefeat,
            holder: r.state.oathkeeperPlayerId
        }).toEqual({ transfers: [`${RHYS}->${DANA}`], holderAfterDefeat: RHYS, holder: DANA })
        // A Campaign step undone before the end leaves no title record behind it.
        const types = r.all.map((a) => a.type)
        const lastUser = types.lastIndexOf(ActionType.CampaignResolveVictory)
        expect(types.indexOf(ActionType.TransferOathkeeper)).toBe(lastUser + 1)
    })

    it('a tie after the spoils between Mara and the Empire gives Rhys the R-2.11.b choice, and the turn resumes where the Campaign left it', () => {
        // Before: Rhys 3, Mara 2, the Empire 0. After: the Empire 2, Mara 2, Rhys 1.
        const { r } = chancellorsCampaign(NOW, { empireSites: 0 })
        expect({
            transfers: r.transfers(),
            holder: r.state.oathkeeperPlayerId,
            machineState: r.state.machineState,
            chooser: r.state.pendingOathkeeperChoice?.holderPlayerId,
            candidates: [...(r.state.pendingOathkeeperChoice?.candidates ?? [])].sort()
        }).toEqual({
            transfers: [],
            holder: RHYS,
            machineState: MachineState.OathkeeperChoice,
            chooser: RHYS,
            candidates: [DANA, MARA].sort()
        })
        r.step(buildAction(ResolveOathkeeper, { playerId: RHYS, chosenPlayerId: MARA }))
        expect(r.state.oathkeeperPlayerId).toBe(MARA)
        expect(r.state.machineState).toBe(MachineState.ActPhase)
        expect(r.state.activePlayerIds).toEqual([DANA])
    })

    it('Chaos Cult (Rhys) takes its favor from Dana alone, the one player who took the title', () => {
        const { r } = chancellorsCampaign(NOW, { empireSites: 1, rhysAdvisers: [CHAOS_CULT] })
        expect(r.state.oathkeeperPlayerId).toBe(DANA)
        expect([DANA, RHYS, MARA].map((id) => r.player(id).favor)).toEqual([2, 4, 3])
    })

    it('with four seats, a tie between Mara and Bea after the defeat stops nothing for a choice; one move, Rhys to Dana', () => {
        const { r, midCampaignChoice } = chancellorsCampaign(NOW, { empireSites: 1, withBea: true })
        expect({
            midCampaignChoice,
            choices: r.all.filter((a) => a.type === ActionType.ResolveOathkeeper).length,
            transfers: r.transfers(),
            holder: r.state.oathkeeperPlayerId
        }).toEqual({
            midCampaignChoice: false,
            choices: 0,
            transfers: [`${RHYS}->${DANA}`],
            holder: DANA
        })
    })

    it("a tie with a Sneak Attack to ask: Rhys chooses first, then is asked for his Sneak Attack, and Dana's Act Phase resumes", () => {
        const { r } = chancellorsCampaign(NOW, { empireSites: 0, rhysAdvisers: [SNEAK_ATTACK] })
        expect(r.state.machineState).toBe(MachineState.OathkeeperChoice)
        expect(r.state.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.SneakAttack,
            askedPlayerId: RHYS
        })
        r.step(buildAction(ResolveOathkeeper, { playerId: RHYS, chosenPlayerId: MARA }))
        expect(r.state.oathkeeperPlayerId).toBe(MARA)
        expect(r.state.machineState).toBe(MachineState.PowerQuestion)
        expect(r.state.activePlayerIds).toEqual([RHYS])
        r.step(answer(RHYS, { kind: PowerQuestionKind.SneakAttack, campaign: false }))
        expect(r.state.machineState).toBe(MachineState.ActPhase)
        expect(r.state.activePlayerIds).toEqual([DANA])
        expect(r.transfers()).toEqual([])
    })

    describe('before revision 12 (R-X.4) the title still moves at each step, as recorded', () => {
        it('the pass-through: Rhys to Mara at the defeat, Mara to Dana at the spoils', () => {
            const { r, holderAfterDefeat } = chancellorsCampaign(BEFORE, { empireSites: 1 })
            expect({ transfers: r.transfers(), holderAfterDefeat }).toEqual({
                transfers: [`${RHYS}->${MARA}`, `${MARA}->${DANA}`],
                holderAfterDefeat: MARA
            })
        })

        it('the tie: Mara takes the title at the defeat and keeps it on the tie, and Rhys is never asked', () => {
            const { r } = chancellorsCampaign(BEFORE, { empireSites: 0 })
            expect({ transfers: r.transfers(), holder: r.state.oathkeeperPlayerId }).toEqual({
                transfers: [`${RHYS}->${MARA}`],
                holder: MARA
            })
            expect(r.state.machineState).toBe(MachineState.ActPhase)
        })

        it('Chaos Cult takes from Mara and from Dana', () => {
            const { r } = chancellorsCampaign(BEFORE, {
                empireSites: 1,
                rhysAdvisers: [CHAOS_CULT]
            })
            expect([DANA, RHYS, MARA].map((id) => r.player(id).favor)).toEqual([2, 5, 2])
        })

        it('four seats: Rhys is asked mid-Campaign, and the record reads Mara to Dana', () => {
            const { r, midCampaignChoice } = chancellorsCampaign(BEFORE, {
                empireSites: 1,
                withBea: true
            })
            expect({ midCampaignChoice, transfers: r.transfers() }).toEqual({
                midCampaignChoice: true,
                transfers: [`${MARA}->${DANA}`]
            })
        })
    })
})

// ---------------------------------------------------------------- the attacker's force sites

describe("R-2.11-H1 — the attacker's own losses at force sites (Vow of Union) are judged with the Campaign", () => {
    // Supremacy. Dana (an Exile) rules p1, p2 and p3 with Vow of Union; Rhys rules h1, h2 and h3; Dana
    // holds the title on the tie. Mara is the Chancellor with no sites. Dana targets h1.
    const forceTable = (revision: OathRevision) => (seed: number) =>
        table(
            revision,
            [
                exile(DANA, Color.Red, 'h1', {
                    favor: 3,
                    secrets: 0,
                    advisers: [{ cardId: VOW_OF_UNION, faceUp: true }]
                }),
                exile(RHYS, Color.Yellow, 'h2', { favor: 3, secrets: 0, warbandsOnBoard: {} }),
                chancellor(MARA, 'c1', {
                    favor: 3,
                    relicIds: [],
                    warbandsOnBoard: {},
                    warbandsInPersonalBank: {}
                })
            ],
            {
                chancellorPlayerId: MARA,
                oathType: OathType.Supremacy,
                oathkeeperPlayerId: DANA,
                warbandsBySite: {
                    p1: { [DANA]: 1 },
                    p2: { [DANA]: 1 },
                    p3: { [DANA]: 1 },
                    h1: { [RHYS]: 1 },
                    h2: { [RHYS]: 1 },
                    h3: { [RHYS]: 1 }
                }
            },
            DANA,
            seed
        )
    const ON_H1 = buildAction(Campaign, {
        playerId: DANA,
        defender: { kind: 'player', playerId: RHYS },
        targets: [{ kind: CampaignTargetKind.Site, siteId: 'h1' }],
        attackDice: 3
    })
    const forceSitesIntact = (s: OathProjectedState) =>
        ['p1', 'p2', 'p3'].every((siteId) => (s.warbandsBySite[siteId]?.[DANA] ?? 0) === 1)
    const PLACE_ON_H1 = buildAction(CampaignResolveVictory, {
        playerId: DANA,
        placements: [{ siteId: 'h1', owner: DANA, count: 1 }]
    })

    function sacrificeTwo(revision: OathRevision): Runner {
        const build = forceTable(revision)
        const seed = seedWhere(
            build,
            ON_H1,
            (s) =>
                s.machineState === MachineState.CampaignSacrifice &&
                !!s.campaign &&
                HydratedCampaignSacrifice.sacrificeNeeded(s.campaign) === 2 &&
                forceSitesIntact(s)
        )
        const r = runner(build(seed))
        r.step(ON_H1)
        r.step(
            buildAction(CampaignSacrifice, {
                playerId: DANA,
                sacrifice: 2,
                sacrificeKills: [
                    { at: { kind: 'site', siteId: 'p1' }, owner: DANA, count: 1 },
                    { at: { kind: 'site', siteId: 'p2' }, owner: DANA, count: 1 }
                ]
            })
        )
        expect(r.state.machineState).toBe(MachineState.CampaignVictory)
        r.step(PLACE_ON_H1)
        expect(r.state.machineState).toBe(MachineState.ActPhase)
        return r
    }

    function skullAtForceSite(revision: OathRevision): { r: Runner; holderAfterSkulls?: string } {
        const build = forceTable(revision)
        const seed = seedWhere(
            build,
            ON_H1,
            (s) =>
                s.machineState === MachineState.CampaignSkullLosses &&
                s.campaign?.pendingSkullLosses?.skulls === 1 &&
                s.campaign.swords > s.campaign.defense
        )
        const r = runner(build(seed))
        r.step(ON_H1)
        r.step(
            buildAction(CampaignSkullLosses, {
                playerId: DANA,
                kills: [{ at: { kind: 'site', siteId: 'p1' }, owner: DANA, count: 1 }]
            })
        )
        const holderAfterSkulls = r.state.oathkeeperPlayerId
        expect(r.state.machineState).toBe(MachineState.CampaignSacrifice)
        r.step(buildAction(CampaignSacrifice, { playerId: DANA, sacrifice: 0 }))
        expect(r.state.machineState).toBe(MachineState.CampaignVictory)
        r.step(PLACE_ON_H1)
        return { r, holderAfterSkulls }
    }

    it('sacrificing two force-site warbands: Dana ends tied 2-2 as the holder and keeps the title', () => {
        // After the sacrifice and the defeat: Dana 1, Rhys 2. After the spoils: Dana 2, Rhys 2.
        const r = sacrificeTwo(NOW)
        expect({ transfers: r.transfers(), holder: r.state.oathkeeperPlayerId }).toEqual({
            transfers: [],
            holder: DANA
        })
    })

    it('a skull loss picked at a force site does not pass the title through Rhys and back', () => {
        // After the skull pick: Dana 2, Rhys 3. After the defeat and the spoils: Dana 3, Rhys 2.
        const { r, holderAfterSkulls } = skullAtForceSite(NOW)
        expect({
            holderAfterSkulls,
            transfers: r.transfers(),
            holder: r.state.oathkeeperPlayerId
        }).toEqual({ holderAfterSkulls: DANA, transfers: [], holder: DANA })
    })

    it('before revision 12 (R-X.4) both pass the title to Rhys mid-Campaign, as recorded', () => {
        expect(sacrificeTwo(BEFORE).transfers()).toEqual([`${DANA}->${RHYS}`])
        expect(skullAtForceSite(BEFORE).r.transfers()).toEqual([
            `${DANA}->${RHYS}`,
            `${RHYS}->${DANA}`
        ])
    })
})

// ---------------------------------------------------------------- the defender's last sites

describe("R-2.11-H1 — the defender's last sites lost at R-5.5.6 do not leave the title with nobody mid-Campaign", () => {
    // Supremacy. Rhys holds the title and rules p1 and p2; nobody else rules a site. Dana, the
    // Chancellor, takes both and places one Imperial warband on p1.
    const build = (revision: OathRevision) => (seed: number) =>
        table(
            revision,
            [
                chancellor(DANA, 'p1', { warbandsOnBoard: { [IMP]: 10 } }),
                exile(RHYS, Color.Yellow, 'p1', { warbandsOnBoard: {} }),
                exile(MARA, Color.White, 'h1', { warbandsOnBoard: {} })
            ],
            {
                chancellorPlayerId: DANA,
                oathType: OathType.Supremacy,
                oathkeeperPlayerId: RHYS,
                warbandsBySite: { p1: { [RHYS]: 1 }, p2: { [RHYS]: 1 } }
            },
            DANA,
            seed
        )
    function lastSites(revision: OathRevision) {
        const seed = seedWhere(build(revision), ON_P1_P2, won)
        const r = runner(build(revision)(seed))
        r.step(ON_P1_P2)
        r.step(buildAction(CampaignSacrifice, { playerId: DANA, sacrifice: 0 }))
        const holderMid = r.state.oathkeeperPlayerId ?? 'nobody'
        r.step(
            buildAction(CampaignResolveVictory, {
                playerId: DANA,
                placements: [{ siteId: 'p1', owner: IMP, count: 1 }]
            })
        )
        return { holderMid, transfers: r.transfers(), holder: r.state.oathkeeperPlayerId }
    }

    it('one move, Rhys to Dana', () => {
        expect(lastSites(NOW)).toEqual({
            holderMid: RHYS,
            transfers: [`${RHYS}->${DANA}`],
            holder: DANA
        })
    })

    it('before revision 12 (R-X.4), Rhys to nobody to Dana, as recorded', () => {
        expect(lastSites(BEFORE)).toEqual({
            holderMid: 'nobody',
            transfers: [`${RHYS}->-`, `-->${DANA}`],
            holder: DANA
        })
    })
})

// ---------------------------------------------------------------- the Usurper side

describe('R-2.11-H1 — a holder who ends the Campaign still holding the title keeps its Usurper side (R-2.11.c)', () => {
    // Supremacy, 1-1: Dana rules c2 and holds the title on its Usurper side; Rhys rules c1. Dana
    // attacks c1 with Vow of Union and must sacrifice her warband at c2 to win.
    const build = (revision: OathRevision) => (seed: number) =>
        table(
            revision,
            [
                exile(DANA, Color.Red, 'c1', {
                    favor: 0,
                    secrets: 0,
                    warbandsOnBoard: { [DANA]: 7 },
                    warbandsInPersonalBank: { [DANA]: 4 },
                    advisers: [{ cardId: VOW_OF_UNION, faceUp: true }]
                }),
                exile(RHYS, Color.Yellow, 'c1', {
                    favor: 5,
                    secrets: 0,
                    warbandsOnBoard: { [RHYS]: 1 },
                    warbandsInPersonalBank: { [RHYS]: 12 }
                }),
                chancellor(MARA, 'h3', { relicIds: [], warbandsOnBoard: {} })
            ],
            {
                chancellorPlayerId: MARA,
                oathType: OathType.Supremacy,
                oathkeeperPlayerId: DANA,
                oathkeeperIsUsurper: true,
                warbandsBySite: { c1: { [RHYS]: 1 }, c2: { [DANA]: 1 } }
            },
            DANA,
            seed
        )
    const ON_C1 = buildAction(Campaign, {
        playerId: DANA,
        defender: { kind: 'player', playerId: RHYS },
        targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }],
        attackDice: 8
    })

    function sacrificeAtC2(revision: OathRevision) {
        const seed = seedWhere(
            build(revision),
            ON_C1,
            (s) =>
                !!s.campaign &&
                s.campaign.swords <= s.campaign.defense &&
                HydratedCampaignSacrifice.sacrificeNeeded(s.campaign) === 1
        )
        const r = runner(build(revision)(seed))
        r.step(ON_C1)
        expect(r.state.machineState).toBe(MachineState.CampaignSacrifice)
        r.step(
            buildAction(CampaignSacrifice, {
                playerId: DANA,
                sacrifice: 1,
                sacrificeKills: [{ at: { kind: 'site', siteId: 'c2' }, owner: DANA, count: 1 }]
            })
        )
        if (r.state.machineState === MachineState.CampaignDefeat) {
            r.step(
                buildAction(CampaignDefeatKills, {
                    playerId: RHYS,
                    kills: [{ at: { kind: 'site', siteId: 'c1' }, owner: RHYS, count: 1 }]
                })
            )
        }
        expect(r.state.machineState).toBe(MachineState.CampaignVictory)
        r.step(
            buildAction(CampaignResolveVictory, {
                playerId: DANA,
                placements: [{ siteId: 'c1', owner: DANA, count: 2 }]
            })
        )
        return r
    }

    it('Dana never lost the title, so she keeps the Usurper side', () => {
        const r = sacrificeAtC2(NOW)
        expect({
            transfers: r.transfers(),
            holder: r.state.oathkeeperPlayerId,
            usurper: r.state.oathkeeperIsUsurper
        }).toEqual({ transfers: [], holder: DANA, usurper: true })
    })

    it('before revision 12 (R-X.4) the title is left with nobody at the defeat and comes back on its Oathkeeper side', () => {
        const r = sacrificeAtC2(BEFORE)
        expect({
            transfers: r.transfers(),
            holder: r.state.oathkeeperPlayerId,
            usurper: r.state.oathkeeperIsUsurper
        }).toEqual({ transfers: [`${DANA}->-`, `-->${DANA}`], holder: DANA, usurper: false })
    })
})

// ---------------------------------------------------------------- Martial Culture

describe('R-2.11-H1 — Martial Culture ends the Act Phase after the title is judged once', () => {
    // Supremacy. Dana (an Exile, Martial Culture) attacks Rhys (an Exile, the holder, p1 to p3) at p1
    // and p2. Mara rules h1 and h2; Bea is the Chancellor with no sites. After the spoils Dana is a
    // Citizen whose two sites are the Empire's, tied with Mara; Rhys rules one.
    const build = (revision: OathRevision) => (seed: number) =>
        table(
            revision,
            [
                exile(DANA, Color.Red, 'p1', {
                    warbandsOnBoard: { [DANA]: 10 },
                    advisers: [{ cardId: MARTIAL_CULTURE, faceUp: true }]
                }),
                exile(RHYS, Color.Yellow, 'p1', { warbandsOnBoard: {} }),
                exile(MARA, Color.White, 'h1', { warbandsOnBoard: {} }),
                chancellor(BEA, 'h3', { relicIds: [], warbandsOnBoard: {} })
            ],
            {
                chancellorPlayerId: BEA,
                oathType: OathType.Supremacy,
                oathkeeperPlayerId: RHYS,
                warbandsBySite: {
                    p1: { [RHYS]: 1 },
                    p2: { [RHYS]: 1 },
                    p3: { [RHYS]: 1 },
                    h1: { [MARA]: 1 },
                    h2: { [MARA]: 1 }
                }
            },
            DANA,
            seed
        )
    const DECLARE = buildAction(Campaign, {
        ...ON_P1_P2,
        plans: [battlePlanUse(MARTIAL_CULTURE)]
    })

    function martial(revision: OathRevision) {
        const seed = seedWhere(build(revision), DECLARE, won)
        const r = runner(build(revision)(seed))
        r.step(DECLARE)
        r.step(buildAction(CampaignSacrifice, { playerId: DANA, sacrifice: 0 }))
        const holderAfterDefeat = r.state.oathkeeperPlayerId
        if (r.state.machineState === MachineState.OathkeeperChoice) {
            r.step(buildAction(ResolveOathkeeper, { playerId: RHYS, chosenPlayerId: MARA }))
        }
        r.step(
            buildAction(CampaignResolveVictory, {
                playerId: DANA,
                placements: [
                    { siteId: 'p1', owner: DANA, count: 1 },
                    { siteId: 'p2', owner: DANA, count: 1 }
                ]
            })
        )
        return { r, holderAfterDefeat }
    }

    it('Rhys chooses between the tied players once the Campaign is over, and the turn goes on to the Rest Phase', () => {
        const { r, holderAfterDefeat } = martial(NOW)
        expect(r.player(DANA).status).toBe(PlayerStatus.Citizen)
        expect({
            holderAfterDefeat,
            transfers: r.transfers(),
            machineState: r.state.machineState,
            chooser: r.state.pendingOathkeeperChoice?.holderPlayerId,
            candidates: [...(r.state.pendingOathkeeperChoice?.candidates ?? [])].sort()
        }).toEqual({
            holderAfterDefeat: RHYS,
            transfers: [],
            machineState: MachineState.OathkeeperChoice,
            chooser: RHYS,
            candidates: [BEA, MARA].sort()
        })
        const chosen = r.step(
            buildAction(ResolveOathkeeper, { playerId: RHYS, chosenPlayerId: BEA })
        )
        expect(r.state.oathkeeperPlayerId).toBe(BEA)
        // The choice resumes in Dana's Rest, which has nothing to decide, so the turn passes to Rhys.
        expect(chosen.processedActions.map((a) => a.type).slice(0, 2)).toEqual([
            ActionType.ResolveOathkeeper,
            ActionType.CompleteRest
        ])
        expect(r.state.activePlayerIds).toEqual([RHYS])
    })

    it('before revision 12 (R-X.4) Mara takes it at the defeat and keeps it on the tie', () => {
        const { r, holderAfterDefeat } = martial(BEFORE)
        expect({
            holderAfterDefeat,
            transfers: r.transfers(),
            holder: r.state.oathkeeperPlayerId
        }).toEqual({ holderAfterDefeat: MARA, transfers: [`${RHYS}->${MARA}`], holder: MARA })
    })
})

// ---------------------------------------------------------------- an out-of-turn Campaign

describe("R-2.11-H1 — a Sneak Attack over another player's turn is judged once at its end, and the held turn resumes", () => {
    // Supremacy. Rhys holds the title and rules c1, c2 and p1; Mara rules h1 and h2; Dana rules
    // p2. On Rhys's turn, Rhys loses a Campaign against Dana, who answers with a Sneak Attack on c1
    // and c2, decided by Peace Envoy. After the defeat Rhys 1, Mara 2, Dana 1; after the spoils Dana 3.
    const build = (revision: OathRevision) =>
        table(
            revision,
            [
                exile(RHYS, Color.Yellow, 'c1', { warbandsOnBoard: { [RHYS]: 4 } }),
                exile(DANA, Color.Red, 'c1', {
                    supply: 0,
                    warbandsOnBoard: { [DANA]: 4 },
                    advisers: [
                        { cardId: SNEAK_ATTACK, faceUp: true },
                        { cardId: PEACE_ENVOY, faceUp: true }
                    ]
                }),
                exile(MARA, Color.White, 'h1', { warbandsOnBoard: {} }),
                chancellor(BEA, 'h3', { relicIds: [], warbandsOnBoard: {} })
            ],
            {
                chancellorPlayerId: BEA,
                oathType: OathType.Supremacy,
                oathkeeperPlayerId: RHYS,
                warbandsBySite: {
                    c1: { [RHYS]: 1 },
                    c2: { [RHYS]: 1 },
                    p1: { [RHYS]: 1 },
                    h1: { [MARA]: 1 },
                    h2: { [MARA]: 1 },
                    p2: { [DANA]: 1 }
                }
            },
            RHYS
        )
    const PAWN: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

    function sneakAttack(revision: OathRevision) {
        const r = runner(build(revision))
        // No attack dice make a certain defeat (R-5.5.5.b).
        r.step(
            buildAction(Campaign, {
                playerId: RHYS,
                defender: { kind: 'player', playerId: DANA },
                targets: [PAWN],
                attackDice: 0
            })
        )
        if (r.state.machineState === MachineState.CampaignPlans) {
            r.step(buildAction(CampaignDefend, { playerId: DANA, plans: [] }))
        }
        r.step(
            buildAction(CampaignSacrifice, {
                playerId: RHYS,
                sacrifice: 0,
                defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(
                    new HydratedOathGameState(r.state),
                    0
                )
            })
        )
        expect(r.state.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.SneakAttack,
            askedPlayerId: DANA
        })
        const before = r.transfers().length
        r.step(
            buildAction(Campaign, {
                playerId: DANA,
                defender: { kind: 'player', playerId: RHYS },
                targets: [
                    { kind: CampaignTargetKind.Site, siteId: 'c1' },
                    { kind: CampaignTargetKind.Site, siteId: 'c2' }
                ],
                attackDice: 2,
                plans: [battlePlanUse(PEACE_ENVOY)]
            })
        )
        if (r.state.machineState === MachineState.CampaignPlans) {
            r.step(buildAction(CampaignDefend, { playerId: RHYS, plans: [] }))
        }
        r.step(buildAction(CampaignSacrifice, { playerId: DANA, sacrifice: 0 }))
        const holderAfterDefeat = r.state.oathkeeperPlayerId
        if (r.state.machineState === MachineState.CampaignDefeat) {
            r.step(
                buildAction(CampaignDefeatKills, {
                    playerId: RHYS,
                    kills: defenderLosses(r.state)
                })
            )
        }
        expect(r.state.machineState).toBe(MachineState.CampaignVictory)
        r.step(
            buildAction(CampaignResolveVictory, {
                playerId: DANA,
                placements: [
                    { siteId: 'c1', owner: DANA, count: 1 },
                    { siteId: 'c2', owner: DANA, count: 1 }
                ]
            })
        )
        return { r, holderAfterDefeat, transfers: r.transfers().slice(before) }
    }

    it('one move, Rhys to Dana, and Rhys is back on the clock in his Act Phase', () => {
        const { r, holderAfterDefeat, transfers } = sneakAttack(NOW)
        expect({ holderAfterDefeat, transfers, holder: r.state.oathkeeperPlayerId }).toEqual({
            holderAfterDefeat: RHYS,
            transfers: [`${RHYS}->${DANA}`],
            holder: DANA
        })
        expect(r.state.machineState).toBe(MachineState.ActPhase)
        expect(r.state.activePlayerIds).toEqual([RHYS])
    })

    it('before revision 12 (R-X.4) it passes through Mara', () => {
        const { transfers } = sneakAttack(BEFORE)
        expect(transfers).toEqual([`${RHYS}->${MARA}`, `${MARA}->${DANA}`])
    })
})

// ---------------------------------------------------------------- one step, unchanged

describe.each([
    ['at revision 12', NOW],
    ['before revision 12', BEFORE]
])('R-2.11-H1 — a Law action that lands in one step moves the title once (%s)', (_, revision) => {
    it('Citizenship accepted under Protection (R-6.6.2): the terms move the title once, after the acceptance', () => {
        // Dana holds 2 relics and the title; Mara (the Chancellor) holds the Grand Scepter and U3;
        // Rhys holds U4. Mara offers Rhys the Reliquary relic and U3: Rhys 3, Dana 2, Mara 1.
        const start = table(
            revision,
            [
                exile(DANA, Color.Red, 'p1', { relicIds: [U1, U2] }),
                exile(RHYS, Color.Yellow, 'c1', { relicIds: [U4] }),
                chancellor(MARA, 'c2', { relicIds: [GRAND_SCEPTER_ID, U3] })
            ],
            {
                chancellorPlayerId: MARA,
                oathType: OathType.Protection,
                oathkeeperPlayerId: DANA,
                warbandsBySite: { c1: { [RHYS]: 1 } },
                reliquary: [{ slotId: 'rel-1' }]
            },
            MARA
        )
        required(start.vault, "the host's vault").relicFacedown['rel-1'] = 'relic.unnamed-5'
        const r = runner(start)
        r.step(
            buildAction(OfferCitizenship, {
                playerId: MARA,
                exilePlayerId: RHYS,
                reliquarySlotId: 'rel-1',
                terms: { fromScepterHolder: { relicCardIds: [U3] } }
            })
        )
        expect(r.state.machineState).toBe(MachineState.ConsentRequest)
        expect(r.transfers()).toEqual([])
        r.step(buildAction(ResolveCitizenshipOffer, { playerId: RHYS, granted: true }))
        expect({ transfers: r.transfers(), holder: r.state.oathkeeperPlayerId }).toEqual({
            transfers: [`${DANA}->${RHYS}`],
            holder: RHYS
        })
    })

    it('Citizenship accepted under Supremacy: the replacement hands the Empire the title once', () => {
        // Dana rules p1 to p3 (the title); Rhys rules h1 and h2; the Empire c1 and c2. Rhys accepts.
        const start = table(
            revision,
            [exile(DANA, Color.Red, 'p1'), exile(RHYS, Color.Yellow, 'h1'), chancellor(MARA, 'c1')],
            {
                chancellorPlayerId: MARA,
                oathType: OathType.Supremacy,
                oathkeeperPlayerId: DANA,
                reliquary: [{ slotId: 'rel-1' }],
                warbandsBySite: {
                    p1: { [DANA]: 1 },
                    p2: { [DANA]: 1 },
                    p3: { [DANA]: 1 },
                    h1: { [RHYS]: 1 },
                    h2: { [RHYS]: 1 },
                    c1: { [IMP]: 1 },
                    c2: { [IMP]: 1 }
                }
            },
            MARA
        )
        required(start.vault, "the host's vault").relicFacedown['rel-1'] = 'relic.unnamed-5'
        const r = runner(start)
        r.step(
            buildAction(OfferCitizenship, {
                playerId: MARA,
                exilePlayerId: RHYS,
                reliquarySlotId: 'rel-1'
            })
        )
        r.step(buildAction(ResolveCitizenshipOffer, { playerId: RHYS, granted: true }))
        expect({ transfers: r.transfers(), holder: r.state.oathkeeperPlayerId }).toEqual({
            transfers: [`${DANA}->${MARA}`],
            holder: MARA
        })
    })

    const protection = (active: string) =>
        table(
            revision,
            [
                exile(DANA, Color.Red, 'c1', { relicIds: [U1, U2] }),
                exile(RHYS, Color.Yellow, 'c1', { relicIds: [U3, U4] }),
                chancellor(MARA, 'h1')
            ],
            {
                chancellorPlayerId: MARA,
                oathType: OathType.Protection,
                oathkeeperPlayerId: DANA,
                denizensBySite: { c1: [TINKERS_FAIR], c2: [], p1: [], h1: [] },
                warbandsBySite: { c1: { [DANA]: 1 } }
            },
            active
        )

    it("Tinker's Fair: nothing moves before the answer, and one move after it", () => {
        // Dana 2 (the holder, tied with Rhys). Dana gives Rhys U1 for one favor: Dana 1, Rhys 3.
        const r = runner(protection(DANA))
        r.step(
            usePower(DANA, TINKERS_FAIR, [
                exchange(RHYS, {
                    fromProposer: { relicCardIds: [U1] },
                    fromCounterparty: { favor: 1 }
                })
            ])
        )
        expect(r.state.machineState).toBe(MachineState.PowerQuestion)
        expect(r.transfers()).toEqual([])
        r.step(answer(RHYS, { kind: PowerQuestionKind.Exchange, accept: true }))
        expect({ transfers: r.transfers(), holder: r.state.oathkeeperPlayerId }).toEqual({
            transfers: [`${DANA}->${RHYS}`],
            holder: RHYS
        })
    })

    it('Deed Writer: the site and both warband moves land in one step, and one move after the answer', () => {
        // Supremacy. Dana rules p1 and p2 (the holder, tied with Rhys's h1 and h2). Dana sells p1.
        const start = table(
            revision,
            [exile(DANA, Color.Red, 'p1'), exile(RHYS, Color.Yellow, 'p1'), chancellor(MARA, 'c1')],
            {
                chancellorPlayerId: MARA,
                oathType: OathType.Supremacy,
                oathkeeperPlayerId: DANA,
                denizensBySite: { p1: [DEED_WRITER], c1: [], c2: [], h1: [] },
                warbandsBySite: {
                    p1: { [DANA]: 1 },
                    p2: { [DANA]: 1 },
                    h1: { [RHYS]: 1 },
                    h2: { [RHYS]: 1 }
                }
            },
            DANA
        )
        const r = runner(start)
        r.step(
            usePower(DANA, DEED_WRITER, [
                exchange(RHYS, {
                    fromProposer: { sites: [{ siteId: 'p1', warbands: 1 }] },
                    fromCounterparty: { favor: 1 }
                })
            ])
        )
        expect(r.transfers()).toEqual([])
        r.step(answer(RHYS, { kind: PowerQuestionKind.Exchange, accept: true }))
        expect({ transfers: r.transfers(), holder: r.state.oathkeeperPlayerId }).toEqual({
            transfers: [`${DANA}->${RHYS}`],
            holder: RHYS
        })
    })

    it('The Gathering: each binding exchange is its own moment, so Rhys takes the title at the first and keeps it on the tie after the second', () => {
        // Protection. Dana 2 relics (the holder), Rhys 2, Mara 1 (the Grand Scepter). Dana plays The
        // Gathering at c1. Dana gives Rhys U1 (Dana 1, Rhys 3: Rhys takes it); Rhys gives Dana U3
        // (2-2: Rhys keeps it on the tie, Law 2.11).
        const start = protection(DANA)
        start.machineState = MachineState.Searching
        start.denizensBySite = { c1: [], c2: [], p1: [], h1: [] }
        start.players[0].handIds = [GATHERING, FILLER]
        start.players[0].handCount = 2
        const r = runner(start)
        r.step(
            buildAction(SearchResolve, {
                playerId: DANA,
                keptCardId: GATHERING,
                discardOrder: [FILLER],
                play: SearchPlay.Site
            })
        )
        const holders: (string | undefined)[] = []
        let danaProposed = false
        let rhysProposed = false
        for (
            let guard = 0;
            r.state.machineState === MachineState.PowerQuestion && guard < 20;
            guard++
        ) {
            const q = r.state.pendingQuestions?.queue[0]
            assertExists(q, 'a question waits')
            if (q.kind === PowerQuestionKind.JoinSite) {
                r.step(answer(q.askedPlayerId, { kind: PowerQuestionKind.JoinSite, join: false }))
            } else if (q.kind === PowerQuestionKind.Exchange) {
                r.step(answer(q.askedPlayerId, { kind: PowerQuestionKind.Exchange, accept: true }))
                holders.push(r.state.oathkeeperPlayerId)
            } else if (
                q.kind === PowerQuestionKind.GatheringFloor &&
                q.askedPlayerId === DANA &&
                !danaProposed
            ) {
                danaProposed = true
                r.step(
                    answer(DANA, {
                        kind: PowerQuestionKind.GatheringFloor,
                        proposal: {
                            withPlayerId: RHYS,
                            terms: {
                                fromProposer: { relicCardIds: [U1] },
                                fromCounterparty: { favor: 1 }
                            }
                        }
                    })
                )
            } else if (
                q.kind === PowerQuestionKind.GatheringFloor &&
                q.askedPlayerId === RHYS &&
                !rhysProposed
            ) {
                rhysProposed = true
                r.step(
                    answer(RHYS, {
                        kind: PowerQuestionKind.GatheringFloor,
                        proposal: {
                            withPlayerId: DANA,
                            terms: {
                                fromProposer: { relicCardIds: [U3] },
                                fromCounterparty: { favor: 1 }
                            }
                        }
                    })
                )
            } else if (q.kind === PowerQuestionKind.GatheringFloor) {
                r.step(answer(q.askedPlayerId, { kind: PowerQuestionKind.GatheringFloor }))
            } else {
                throw Error(`unexpected question ${q.kind}`)
            }
        }
        expect({
            relics: [r.player(DANA).relicIds.length, r.player(RHYS).relicIds.length],
            holders,
            transfers: r.transfers(),
            holder: r.state.oathkeeperPlayerId
        }).toEqual({
            relics: [2, 2],
            holders: [RHYS, RHYS],
            transfers: [`${DANA}->${RHYS}`],
            holder: RHYS
        })
    })

    it("a Search play with the People's Favor (Key to the City to Rhys's site) moves the title once", () => {
        // Supremacy. Dana holds the People's Favor and rules p3; Rhys rules p1 and p2 (the title).
        const start = table(
            revision,
            [
                exile(DANA, Color.Red, 'p3', { handIds: [KEY_TO_THE_CITY, FILLER], handCount: 2 }),
                exile(RHYS, Color.Yellow, 'p2'),
                chancellor(MARA, 'c1')
            ],
            {
                chancellorPlayerId: MARA,
                oathType: OathType.Supremacy,
                oathkeeperPlayerId: RHYS,
                machineState: MachineState.Searching,
                banners: testBanners({ [Banner.PeoplesFavor]: DANA }),
                denizensBySite: { p1: [], p2: ['denizen.nomad.tents'], p3: [], c1: [] },
                warbandsBySite: { p1: { [RHYS]: 1 }, p2: { [RHYS]: 1 }, p3: { [DANA]: 1 } }
            },
            DANA
        )
        const r = runner(start)
        r.step(
            buildAction(SearchResolve, {
                playerId: DANA,
                keptCardId: KEY_TO_THE_CITY,
                discardOrder: [FILLER],
                play: SearchPlay.Site,
                toSiteId: 'p1',
                discardFirstCardId: 'denizen.nomad.tents'
            })
        )
        for (
            let guard = 0;
            r.state.machineState === MachineState.PowerQuestion && guard < 5;
            guard++
        ) {
            const q = r.state.pendingQuestions?.queue[0]
            assertExists(q, 'a question waits')
            if (q.kind !== PowerQuestionKind.OrderDiscards) throw Error(`unexpected ${q.kind}`)
            r.step(
                answer(q.askedPlayerId, {
                    kind: PowerQuestionKind.OrderDiscards,
                    order: q.cardIds.map((_, i) => i)
                })
            )
        }
        expect({ transfers: r.transfers(), holder: r.state.oathkeeperPlayerId }).toEqual({
            transfers: [`${RHYS}->${DANA}`],
            holder: DANA
        })
    })

    it('Fae Merchant under Protection is judged after the relic goes to the bottom: the title never leaves Rhys', () => {
        // Dana U1, Rhys U2 (the holder), Mara the Grand Scepter: 1-1-1. Dana draws to 2, then bottoms U1.
        const start = table(
            revision,
            [
                exile(DANA, Color.Red, 'c1', { relicIds: [U1] }),
                exile(RHYS, Color.Yellow, 'h1', { relicIds: [U2] }),
                chancellor(MARA, 'h2')
            ],
            {
                chancellorPlayerId: MARA,
                oathType: OathType.Protection,
                oathkeeperPlayerId: RHYS,
                denizensBySite: { c1: [FAE_MERCHANT], c2: [], h1: [], h2: [] }
            },
            DANA
        )
        required(start.vault, "the host's vault").relicDeck = ['relic.unnamed-6', 'relic.unnamed-7']
        const r = runner(start)
        r.step(usePower(DANA, FAE_MERCHANT))
        expect(r.state.machineState).toBe(MachineState.PowerQuestion)
        expect(r.transfers()).toEqual([])
        r.step(answer(DANA, { kind: PowerQuestionKind.BottomRelic, heldRelicCardId: U1 }))
        expect({
            transfers: r.transfers(),
            holder: r.state.oathkeeperPlayerId,
            dana: r.player(DANA).relicIds.length
        }).toEqual({ transfers: [], holder: RHYS, dana: 1 })
    })

    // Supremacy. Dana (the Chancellor) attacks Rhys (the title; p1 to p3) at p1 and p2 and takes both;
    // Mara rules h1, the Empire c1. After the defeat Rhys 1, Mara 1, the Empire 1 (Rhys keeps it on the
    // tie); after the spoils the Empire 3, so the title is Dana's before any chained action.
    function firstCampaign(danaAdvisers: string[], rhysAdvisers: string[]): Runner {
        const adv = (ids: string[]) => ids.map((cardId) => ({ cardId, faceUp: true }))
        const build = (seed: number) =>
            table(
                revision,
                [
                    chancellor(DANA, 'p1', {
                        warbandsOnBoard: { [IMP]: 10 },
                        advisers: adv(danaAdvisers)
                    }),
                    exile(RHYS, Color.Yellow, 'p1', {
                        warbandsOnBoard: { [RHYS]: 2 },
                        advisers: adv(rhysAdvisers)
                    }),
                    exile(MARA, Color.White, 'h1')
                ],
                {
                    chancellorPlayerId: DANA,
                    oathType: OathType.Supremacy,
                    oathkeeperPlayerId: RHYS,
                    warbandsBySite: {
                        p1: { [RHYS]: 1 },
                        p2: { [RHYS]: 1 },
                        p3: { [RHYS]: 1 },
                        h1: { [MARA]: 1 },
                        c1: { [IMP]: 1 }
                    }
                },
                DANA,
                seed
            )
        const declare = buildAction(Campaign, {
            ...ON_P1_P2,
            plans: danaAdvisers.includes(SECOND_WIND) ? [battlePlanUse(SECOND_WIND)] : []
        })
        const r = runner(build(seedWhere(build, declare, won)))
        r.step(declare)
        r.step(buildAction(CampaignSacrifice, { playerId: DANA, sacrifice: 0 }))
        expect(r.state.machineState).toBe(MachineState.CampaignVictory)
        r.step(
            buildAction(CampaignResolveVictory, {
                playerId: DANA,
                placements: [
                    { siteId: 'p1', owner: IMP, count: 1 },
                    { siteId: 'p2', owner: IMP, count: 1 }
                ]
            })
        )
        return r
    }

    it('Sneak Attack: Rhys is asked with Dana already the Oathkeeper', () => {
        const r = firstCampaign([], [SNEAK_ATTACK])
        const q = r.state.pendingQuestions?.queue[0]
        expect({
            q: q?.kind,
            asked: q?.askedPlayerId,
            holder: r.state.oathkeeperPlayerId,
            transfers: r.transfers()
        }).toEqual({
            q: PowerQuestionKind.SneakAttack,
            asked: RHYS,
            holder: DANA,
            transfers: [`${RHYS}->${DANA}`]
        })
    })

    it('Second Wind: Dana holds the title before her free Travel and Campaign', () => {
        const r = firstCampaign([SECOND_WIND], [])
        const dana = r.player(DANA)
        expect({
            holder: r.state.oathkeeperPlayerId,
            transfers: r.transfers(),
            free: dana.freeTravelAtAction !== undefined && dana.freeCampaignAtAction !== undefined
        }).toEqual({ holder: DANA, transfers: [`${RHYS}->${DANA}`], free: true })
    })

    it("Relic Thief after a Campaign's relic take: the Campaign's take and the thief's take each move the title", () => {
        // Protection. Rhys holds the Horn and the Book (the title); Dana the Horse; Mara the Sticks and
        // Relic Thief, in Dana's region; Bea is the Chancellor. Dana takes the Horn (Dana 2: the title);
        // Mara's roll takes it (Mara 2, Dana 1: the title again).
        const build = (seed: number) =>
            table(
                revision,
                [
                    exile(DANA, Color.Red, 'p1', {
                        relicIds: [HORSE],
                        warbandsOnBoard: { [DANA]: 6 }
                    }),
                    exile(RHYS, Color.Yellow, 'p1', {
                        relicIds: [HORN, BOOK],
                        warbandsOnBoard: { [RHYS]: 1 }
                    }),
                    exile(MARA, Color.White, 'p2', {
                        relicIds: [STICKS],
                        advisers: [{ cardId: RELIC_THIEF, faceUp: true }]
                    }),
                    chancellor(BEA, 'c1')
                ],
                {
                    chancellorPlayerId: BEA,
                    oathType: OathType.Protection,
                    oathkeeperPlayerId: RHYS
                },
                DANA,
                seed
            )
        const declare = buildAction(Campaign, {
            playerId: DANA,
            defender: { kind: 'player', playerId: RHYS },
            targets: [{ kind: CampaignTargetKind.Relic, cardId: HORN }],
            attackDice: 6
        })
        for (let seed = 1; seed < 3000; seed++) {
            const r = runner(build(seed))
            r.step(declare)
            if (!won(r.state)) continue
            r.step(buildAction(CampaignSacrifice, { playerId: DANA, sacrifice: 0 }))
            if (r.state.machineState !== MachineState.CampaignVictory) continue
            r.step(buildAction(CampaignResolveVictory, { playerId: DANA, placements: [] }))
            expect(r.state.pendingQuestions?.queue[0]?.kind).toBe(PowerQuestionKind.RelicThiefRoll)
            const holderAtQuestion = r.state.oathkeeperPlayerId
            r.step(answer(MARA, { kind: PowerQuestionKind.RelicThiefRoll, roll: true }))
            if (!r.player(MARA).relicIds.includes(HORN)) continue
            expect({
                holderAtQuestion,
                transfers: r.transfers(),
                holder: r.state.oathkeeperPlayerId
            }).toEqual({
                holderAtQuestion: DANA,
                transfers: [`${RHYS}->${DANA}`, `${DANA}->${MARA}`],
                holder: MARA
            })
            return
        }
        throw Error('no seed where the Campaign and the thief roll both take')
    })
})

// ---------------------------------------------------------------- a title moment inside a Campaign

interface BanishTableOptions {
    maraAdvisers?: string[]
    beaAdvisers?: string[]
}

interface ThiefScene extends BanishTableOptions {
    /** Mara's answer to Jinx's question; left out when she does not hold Jinx. */
    reroll?: boolean
    /** Whether the roll that stands takes the Horn. */
    takes: boolean
}

function canonical(state: unknown): OathGameState {
    assert(OathGameStateValidator.Check(state), 'Expected complete canonical state')
    return state
}

describe('R-2.11-H1 — a Relic Thief take answered while the Campaign waits on a banish is judged at that answer', () => {
    // Protection. Rhys (the attacker, ruling c1 with Toll Roads) has won against Dana (the holder:
    // the Horn and the Book) at c2, taking the Horn and banishing her to c1. Mara holds Relic Thief
    // and the Sticks, in the Cradle. The thief's question comes first, then Dana's toll; the
    // Campaign stays open until the toll is answered.
    function build(revision: OathRevision, seed: number, more: BanishTableOptions = {}) {
        const { maraAdvisers = [], beaAdvisers = [] } = more
        const faceUp = (cardId: string) => ({ cardId, faceUp: true })
        const start = table(
            revision,
            [
                exile(RHYS, Color.Yellow, 'c2', { relicIds: [HORSE] }),
                exile(DANA, Color.Red, 'c2', { relicIds: [HORN, BOOK], favor: 6 }),
                exile(MARA, Color.White, 'c2', {
                    relicIds: [STICKS],
                    secrets: 2 + maraAdvisers.length,
                    advisers: [RELIC_THIEF, ...maraAdvisers].map(faceUp)
                }),
                chancellor(BEA, 'h3', { advisers: beaAdvisers.map(faceUp) })
            ],
            {
                chancellorPlayerId: BEA,
                oathType: OathType.Protection,
                oathkeeperPlayerId: DANA,
                machineState: MachineState.CampaignVictory,
                denizensBySite: { c1: [TOLL_ROADS], c2: [], h3: [] },
                warbandsBySite: { c1: { [RHYS]: 2 } },
                campaign: {
                    attackerPlayerId: RHYS,
                    defenderPlayerId: DANA,
                    nonImperialPlayerIds: [],
                    allyPlayerIds: [],
                    targets: [
                        { kind: CampaignTargetKind.Relic, cardId: HORN },
                        { kind: CampaignTargetKind.PawnAndFavor }
                    ],
                    attackPool: 4,
                    defensePool: 1,
                    attackRoll: [],
                    defenseRoll: [],
                    defense: 1,
                    swords: 5,
                    defendingForce: [],
                    defendingBandits: 0,
                    ...campaignRecords(),
                    attackerVictorious: true
                }
            },
            RHYS,
            seed
        )
        return start
    }

    const BANISH = buildAction(CampaignResolveVictory, {
        playerId: RHYS,
        placements: [],
        banishToSiteId: 'c1',
        burnFavor: false
    })

    function thiefThenToll(revision: OathRevision) {
        for (let seed = 1; seed < 3000; seed++) {
            const r = runner(build(revision, seed))
            r.step(
                buildAction(CampaignResolveVictory, {
                    playerId: RHYS,
                    placements: [],
                    banishToSiteId: 'c1',
                    burnFavor: false
                })
            )
            expect(r.state.pendingQuestions?.queue.map((q) => q.kind)).toEqual([
                PowerQuestionKind.RelicThiefRoll,
                PowerQuestionKind.PayTravelToll
            ])
            r.step(answer(MARA, { kind: PowerQuestionKind.RelicThiefRoll, roll: true }))
            if (!r.player(MARA).relicIds.includes(HORN)) continue
            expect(r.state.campaign?.banishPending).toEqual({})
            const atThief = { holder: r.state.oathkeeperPlayerId, transfers: r.transfers() }
            r.step(answer(DANA, { kind: PowerQuestionKind.PayTravelToll, pay: true }))
            expect(r.state.campaign).toBeUndefined()
            return { atThief, transfers: r.transfers(), holder: r.state.oathkeeperPlayerId }
        }
        throw Error('no seed where the thief roll takes')
    }

    it('the title goes from Dana to Mara with the thief answer, not at the toll, and never through Rhys', () => {
        // After Rhys's take: Rhys 2, Dana 1, Mara 1. After the thief's: Mara 2, Rhys 1, Dana 1.
        expect(thiefThenToll(NOW)).toEqual({
            atThief: { holder: MARA, transfers: [`${DANA}->${MARA}`] },
            transfers: [`${DANA}->${MARA}`],
            holder: MARA
        })
    })

    it('before revision 12 (R-X.4) Rhys takes it with the spoils, and Mara with the thief answer', () => {
        expect(thiefThenToll(BEFORE)).toEqual({
            atThief: { holder: MARA, transfers: [`${DANA}->${RHYS}`, `${RHYS}->${MARA}`] },
            transfers: [`${DANA}->${RHYS}`, `${RHYS}->${MARA}`],
            holder: MARA
        })
    })

    /** The holder and the moves so far after each answer, from the thief's roll to the toll. */
    function throughToll(revision: OathRevision, scene: ThiefScene) {
        for (let seed = 1; seed < 3000; seed++) {
            const r = runner(build(revision, seed, scene))
            r.step(BANISH)
            const moments: { after: string; holder: string | undefined; transfers: string[] }[] = []
            const note = (after: string) =>
                moments.push({
                    after,
                    holder: r.state.oathkeeperPlayerId,
                    transfers: r.transfers()
                })
            r.step(answer(MARA, { kind: PowerQuestionKind.RelicThiefRoll, roll: true }))
            note('roll')
            if (scene.reroll !== undefined) {
                expect(r.state.pendingQuestions?.queue.map((q) => q.kind)).toEqual([
                    PowerQuestionKind.RerollDice,
                    PowerQuestionKind.PayTravelToll
                ])
                r.step(answer(MARA, { kind: PowerQuestionKind.RerollDice, reroll: scene.reroll }))
                note('jinx')
            }
            if (r.player(MARA).relicIds.includes(HORN) !== scene.takes) continue
            expect(r.state.campaign?.banishPending).toEqual({})
            r.step(answer(DANA, { kind: PowerQuestionKind.PayTravelToll, pay: true }))
            expect(r.state.campaign).toBeUndefined()
            note('toll')
            return { r, seed, moments }
        }
        throw Error('no seed for the scene')
    }

    const favorOf = (r: Runner) => [BEA, RHYS, MARA].map((id) => r.player(id).favor)

    describe('with Jinx, the answer that lands the take is the moment', () => {
        const jinxed: ThiefScene = {
            maraAdvisers: [JINX],
            beaAdvisers: [CHAOS_CULT],
            reroll: true,
            takes: true
        }

        it('Jinx rerolls and the take lands: the title goes from Dana to Mara at the reroll, not at the roll or the toll, and Chaos Cult (Bea) takes favor once', () => {
            // Bea 4 + 1 from Mara; Rhys 4 + Dana's toll; Mara 4 - Relic Thief's favor - Chaos Cult's.
            const { r, moments } = throughToll(NOW, jinxed)
            expect(moments).toEqual([
                { after: 'roll', holder: DANA, transfers: [] },
                { after: 'jinx', holder: MARA, transfers: [`${DANA}->${MARA}`] },
                { after: 'toll', holder: MARA, transfers: [`${DANA}->${MARA}`] }
            ])
            expect(favorOf(r)).toEqual([5, 5, 2])
        })

        it('Jinx declined and the kept roll takes: the title moves at that answer', () => {
            const { moments } = throughToll(NOW, { ...jinxed, reroll: false })
            expect(moments).toEqual([
                { after: 'roll', holder: DANA, transfers: [] },
                { after: 'jinx', holder: MARA, transfers: [`${DANA}->${MARA}`] },
                { after: 'toll', holder: MARA, transfers: [`${DANA}->${MARA}`] }
            ])
        })

        it('Jinx rerolls and the take fails: nothing moves until the toll ends the Campaign, then Dana to Rhys', () => {
            const { moments } = throughToll(NOW, { ...jinxed, takes: false })
            expect(moments).toEqual([
                { after: 'roll', holder: DANA, transfers: [] },
                { after: 'jinx', holder: DANA, transfers: [] },
                { after: 'toll', holder: RHYS, transfers: [`${DANA}->${RHYS}`] }
            ])
        })

        it("every seat's view, rebuilt from what it is sent for the reroll answer, equals the server's: Mara holds the title", () => {
            const { seed } = throughToll(NOW, jinxed)
            const start = build(NOW, seed, jinxed)
            const game = {
                ...testGame(start.players.map((p) => p.playerId)),
                hotseat: false,
                protectedInformation: true as const
            }
            let state = start
            for (const action of [
                BANISH,
                answer(MARA, { kind: PowerQuestionKind.RelicThiefRoll, roll: true })
            ]) {
                state = engine.runNext(action, state, game).updatedState
            }
            const before = canonical(state)
            const reroll = answer(MARA, { kind: PowerQuestionKind.RerollDice, reroll: true })
            const result = engine.executeCanonicalAction({
                action: { ...reroll, id: `a-${before.actionCount}`, index: before.actionCount },
                state: before,
                game
            })
            const after = canonical(result.updatedState)
            expect(after.oathkeeperPlayerId).toBe(MARA)
            const perspectives: Visibility.Perspective[] = [
                ...after.players.map((p) => ({ kind: 'player', playerId: p.playerId }) as const),
                { kind: 'spectator' }
            ]
            for (const perspective of perspectives) {
                const history = Visibility.projectActionHistory({
                    game,
                    currentState: after,
                    startIndex: before.actionCount,
                    actions: result.processedActions,
                    visibility: OathVisibility,
                    perspective,
                    replay: { game, runtime: OathRuntime }
                })
                let view = OathVisibility.state.project(before, perspective)
                for (const action of history.actions) {
                    view = engine.applyProcessedAction({ game, state: view, action })
                }
                expect(view).toEqual(OathVisibility.state.project(after, perspective))
                expect(view.oathkeeperPlayerId).toBe(MARA)
                expect(history.actions.filter(isTransferOathkeeper)).toHaveLength(1)
            }
        })

        it('before revision 12 (R-X.4) Rhys takes it with the spoils and Mara at the reroll, and Chaos Cult takes from each', () => {
            const { r, moments } = throughToll(BEFORE, jinxed)
            expect(moments).toEqual([
                { after: 'roll', holder: RHYS, transfers: [`${DANA}->${RHYS}`] },
                {
                    after: 'jinx',
                    holder: MARA,
                    transfers: [`${DANA}->${RHYS}`, `${RHYS}->${MARA}`]
                },
                { after: 'toll', holder: MARA, transfers: [`${DANA}->${RHYS}`, `${RHYS}->${MARA}`] }
            ])
            expect(favorOf(r)).toEqual([6, 4, 2])
        })
    })

    it('a thief roll that takes nothing is no moment: the title moves once the toll ends the Campaign, Dana to Rhys', () => {
        const { moments } = throughToll(NOW, { takes: false })
        expect(moments).toEqual([
            { after: 'roll', holder: DANA, transfers: [] },
            { after: 'toll', holder: RHYS, transfers: [`${DANA}->${RHYS}`] }
        ])
    })
})
