import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { assertExists, Color, Prng, type Game, type GameAction } from '@tabletop/common'
import { Campaign, type CampaignDefender } from './campaign.js'
import { CampaignResolveVictory } from './campaignResolveVictory.js'
import { CampaignSacrifice } from './campaignSacrifice.js'
import { CampaignDefeatKills } from './campaignDefeatKills.js'
import { MachineState } from '../definition/states.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { relicDefenseDice } from '../data/cardRegistry.js'
import { CampaignTargetKind, type CampaignTarget, type RolledAttackFace, type RolledDefenseFace, type WarbandGroup } from '../model/campaign.js'
import { testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { expectOneWarbandColorPerSite, warbandCensus } from '../testing/census.js'
import {
    ATTACK_DIE_FACES,
    DEFENSE_DIE_FACES,
    rollAttackDice,
    rollDefenseDice
} from '../data/dice.js'
import { testGame } from '../testing/game.js'
import { siteTarget } from '../testing/choices.js'

const ATTACK_FACE_BY_NAME: Record<string, RolledAttackFace> = {
    sword: { swords: 1, hollowSwords: 0, skulls: 0 },
    hollow: { swords: 0, hollowSwords: 1, skulls: 0 },
    'skull+2swords': { swords: 2, hollowSwords: 0, skulls: 1 }
}

const DEFENSE_FACE_BY_NAME: Record<string, RolledDefenseFace> = {
    blank: { shields: 0, doubling: false },
    shield: { shields: 1, doubling: false },
    '2shields': { shields: 2, doubling: false },
    x2: { shields: 0, doubling: true }
}

export function attackFaces(names: readonly string[]): RolledAttackFace[] {
    return names.map((name) => {
        const face = ATTACK_FACE_BY_NAME[name]
        assertExists(face, `${name} is not an attack die face`)
        return face
    })
}

export function defenseFaces(names: readonly string[]): RolledDefenseFace[] {
    return names.map((name) => {
        const face = DEFENSE_FACE_BY_NAME[name]
        assertExists(face, `${name} is not a defense die face`)
        return face
    })
}

/** R-5.5 — no rule reads the order the dice fell in. */
function multiset(faces: readonly object[]): string {
    return faces
        .map((face) => JSON.stringify(face))
        .sort()
        .join('|')
}

/** Defense then attack, the order `rollCampaign` draws them in. */
export function findSeedFor(
    recorded: { defense: readonly RolledDefenseFace[]; attack: readonly RolledAttackFace[] },
    searchLimit = 2_000_000
): number {
    const wantDefense = multiset(recorded.defense)
    const wantAttack = multiset(recorded.attack)

    for (let seed = 1; seed <= searchLimit; seed++) {
        const prng = new Prng({ seed, invocations: 0 })
        if (multiset(rollDefenseDice(prng, recorded.defense.length)) !== wantDefense) continue
        if (multiset(rollAttackDice(prng, recorded.attack.length)) !== wantAttack) continue
        return seed
    }
    throw Error(
        `no seed within ${searchLimit} reproduces that roll ` +
            `(${recorded.defense.length} defense dice, ${recorded.attack.length} attack dice)`
    )
}

describe('the golden vector harness', () => {
    it("reads the recording template's face vocabulary", () => {
        expect(attackFaces(['sword', 'hollow', 'skull+2swords'])).toEqual([
            { swords: 1, hollowSwords: 0, skulls: 0 },
            { swords: 0, hollowSwords: 1, skulls: 0 },
            { swords: 2, hollowSwords: 0, skulls: 1 }
        ])
        expect(defenseFaces(['blank', 'shield', '2shields', 'x2'])).toEqual([
            { shields: 0, doubling: false },
            { shields: 1, doubling: false },
            { shields: 2, doubling: false },
            { shields: 0, doubling: true }
        ])
    })

    it('rejects a face name that is not on the die', () => {
        expect(() => attackFaces(['shield'])).toThrow(/not an attack die face/)
        expect(() => defenseFaces(['sword'])).toThrow(/not a defense die face/)
    })

    it('only knows the faces the dice actually have', () => {
        for (const face of Object.values(ATTACK_FACE_BY_NAME)) {
            expect(ATTACK_DIE_FACES).toContainEqual(face)
        }
        for (const face of Object.values(DEFENSE_FACE_BY_NAME)) {
            expect(DEFENSE_DIE_FACES).toContainEqual(face)
        }
    })

    it('finds a seed that reproduces a recorded roll', () => {
        const recorded = {
            defense: defenseFaces(['shield', 'x2', 'blank']),
            attack: attackFaces(['sword', 'hollow', 'hollow', 'skull+2swords'])
        }
        const seed = findSeedFor(recorded)

        const prng = new Prng({ seed, invocations: 0 })
        const defense = rollDefenseDice(prng, recorded.defense.length)
        const attack = rollAttackDice(prng, recorded.attack.length)

        expect(multiset(defense)).toBe(multiset(recorded.defense))
        expect(multiset(attack)).toBe(multiset(recorded.attack))
    })

    it('gives up loudly rather than mocking when no seed reproduces the roll', () => {
        expect(() =>
            findSeedFor(
                {
                    defense: defenseFaces(['x2', 'x2', 'x2', 'x2', 'x2', 'x2']),
                    attack: attackFaces(['skull+2swords', 'skull+2swords', 'skull+2swords'])
                },
                50
            )
        ).toThrow(/no seed within 50/)
    })
})

const A = 'attacker'
const D = 'defender'
const IVORY_EYE = 'relic.ivory-eye'
const MOUNTAIN = 'site.mountain'
const PLAINS = 'site.plains'
const LONGBOWS = 'denizen.order.longbows'
const BANDITS: CampaignDefender = { kind: 'bandits' }


beforeAll(() => {
    // R-2.4.2
    expect(
        relicDefenseDice(IVORY_EYE),
        'the Ivory Eye prints 2 defense dice'
    ).toBe(2)
})

interface Board {
    attackerBoard: number
    attackerSupply?: number
    defenderBoard?: number
    defenderFavor?: number
    /** R-1.23.1 */
    defenderSiteId?: string
    sites?: Record<string, number>
    defenderRelicIds?: string[]
    defenderIsOathkeeper?: boolean
    /** Every slot left out is facedown. */
    siteCards?: Record<string, string>
    denizensBySite?: Record<string, string[]>
}

const ATTACKER_SITE = 'c1'
const ELSEWHERE = 'h2'

function buildState(board: Board, seed: number): OathProjectedState {
    const sites = board.sites ?? {}
    const onSites = Object.values(sites).reduce((n, c) => n + c, 0)

    const state = testState(
        withChancellor([
            testPlayer({
                playerId: A,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: ATTACKER_SITE,
                supply: board.attackerSupply ?? 7,
                warbandsOnBoard: { [Color.Red]: board.attackerBoard },
                warbandsInPersonalBank: { [Color.Red]: 14 - board.attackerBoard }
            }),
            testPlayer({
                playerId: D,
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: board.defenderSiteId ?? ELSEWHERE,
                favor: board.defenderFavor ?? 0,
                warbandsOnBoard: { [Color.Yellow]: board.defenderBoard ?? 0 },
                warbandsInPersonalBank: {
                    [Color.Yellow]: 14 - (board.defenderBoard ?? 0) - onSites
                },
                relicIds: board.defenderRelicIds ?? []
            })
        ]),
        {
            machineState: MachineState.ActPhase,
            warbandsBySite: Object.fromEntries(
                Object.entries(sites).map(([siteId, n]) => [siteId, { [Color.Yellow]: n }])
            ),
            oathkeeperPlayerId: board.defenderIsOathkeeper ? D : undefined,
            ...(board.siteCards ? { siteCards: board.siteCards } : {}),
            ...(board.denizensBySite ? { denizensBySite: board.denizensBySite } : {}),
            favorSupply: 20,
            prng: { seed, invocations: 0 }
        }
    ).dehydrate()

    state.turnManager = {
        series: [{ type: 'turn', playerId: A, start: 0 }],
        turnOrder: [A, D],
        turnCounts: { [A]: 0, [D]: 0 }
    }
    state.activePlayerIds = [A]
    return state
}

function act(action: GameAction, tag = '') {
    return { ...action, id: `a-${action.type}-${tag}` }
}

const relicTarget = (cardId: string): CampaignTarget => ({
    kind: CampaignTargetKind.Relic,
    cardId
})
const PAWN_AND_FAVOR: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

function runCampaign(
    board: Board,
    campaign: { targets: CampaignTarget[]; attackDice: number; defender?: CampaignDefender },
    pinned: { defense: string[]; attack: string[] }
) {
    const seed = findSeedFor({
        defense: defenseFaces(pinned.defense),
        attack: attackFaces(pinned.attack)
    })
    const game = testGame([A, D])
    const before = buildState(board, seed)
    const result = engine.run(
        act(buildAction(Campaign, {
            playerId: A,
            defender: campaign.defender ?? { kind: 'player', playerId: D },
            targets: campaign.targets,
            attackDice: campaign.attackDice,
        })),
        before,
        game
    )
    return { game, state: result.updatedState, seed }
}

function wholeForce(state: OathProjectedState): WarbandGroup[] {
    return (state.campaign?.defendingForce ?? []).map((g) => ({ ...g }))
}

/** R-5.5.6 */
function firstOfForce(state: OathProjectedState, count: number): WarbandGroup[] {
    const picked: WarbandGroup[] = []
    let left = count
    for (const group of wholeForce(state)) {
        if (left === 0) break
        const take = Math.min(group.count, left)
        picked.push({ ...group, count: take })
        left -= take
    }
    return picked
}

function boardOf(state: OathProjectedState, playerId: string): number {
    const p = state.players.find((x) => x.playerId === playerId)
    return Object.values(p?.warbandsOnBoard ?? {}).reduce((n, c) => n + c, 0)
}

function siteOf(state: OathProjectedState, siteId: string): number {
    return state.warbandsBySite[siteId]?.[Color.Yellow] ?? 0
}

/** R-5.5.5, R-5.5.6.a */
function win(rolled: OathProjectedState, game: Game, sacrifice: number, kills: WarbandGroup[]) {
    const sacrificed = engine.run(
        act(buildAction(CampaignSacrifice, { playerId: A, sacrifice })),
        rolled,
        game
    ).updatedState
    const chooser = sacrificed.campaign?.pendingDefeatKills?.chooserPlayerId
    if (chooser === undefined) return sacrificed
    return engine.run(
        act(buildAction(CampaignDefeatKills, { playerId: chooser, kills })),
        sacrificed,
        game
    ).updatedState
}

describe('Campaign golden vectors', () => {
    it('baseline single-site win: pools, skull, rounding, vacate-and-place', () => {
        const board: Board = {
            attackerBoard: 4,
            attackerSupply: 4,
            sites: { [ATTACKER_SITE]: 2 }
        }
        const { game, state: rolled } = runCampaign(
            board,
            { targets: [siteTarget(ATTACKER_SITE)], attackDice: 4 },
            { defense: ['shield'], attack: ['sword', 'hollow', 'hollow', 'skull+2swords'] }
        )

        expect(rolled.campaign?.attackPool).toBe(4)
        expect(rolled.campaign?.defensePool).toBe(1)
        expect(rolled.campaign?.defense).toBe(3)
        expect(rolled.campaign?.swords).toBe(4)
        // R-5.5.5 — the skull kills before any sacrifice.
        expect(boardOf(rolled, A)).toBe(3)
        expect(rolled.players[0].supply).toBe(2)

        let state = win(rolled, game, 0, firstOfForce(rolled, 1))

        expect(state.campaign?.attackerVictorious).toBe(true)
        expect(siteOf(state, ATTACKER_SITE)).toBe(0)
        expect(boardOf(state, D)).toBe(1)

        state = engine.run(
            act(buildAction(CampaignResolveVictory, {
                playerId: A,
                placements: [{ siteId: ATTACKER_SITE, color: Color.Red, count: 2 }],
                burnFavor: false
            })),
            state,
            game
        ).updatedState

        expect(state.warbandsBySite[ATTACKER_SITE][Color.Red]).toBe(2)
        expect(boardOf(state, A)).toBe(1)
        expectSettled(state)
    })

    it('a tie goes to the defender; the defeat penalty rounds down', () => {
        const { game, state: rolled } = runCampaign(
            { attackerBoard: 3, sites: { [ATTACKER_SITE]: 2 } },
            { targets: [siteTarget(ATTACKER_SITE)], attackDice: 3 },
            { defense: ['2shields'], attack: ['sword', 'sword', 'skull+2swords'] }
        )

        expect(rolled.campaign?.swords).toBe(4)
        expect(rolled.campaign?.defense).toBe(4)
        expect(boardOf(rolled, A)).toBe(2)

        // R-5.5.5.b
        const state = engine.run(
            act(buildAction(CampaignSacrifice, {
                playerId: A,
                sacrifice: 0,
                defeatKills: [{ at: { kind: 'board', playerId: A }, color: Color.Red, count: 1 }]
            })),
            rolled,
            game
        ).updatedState

        expect(state.campaign).toBeUndefined()
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(boardOf(state, A)).toBe(1)
        expect(siteOf(state, ATTACKER_SITE)).toBe(2)
        expect(boardOf(state, D)).toBe(0)
        expectSettled(state)
    })

    it('the hollow-sword floor, and a sacrifice that flips the result', () => {
        const { game, state: rolled } = runCampaign(
            { attackerBoard: 5, sites: { [ATTACKER_SITE]: 3 } },
            { targets: [siteTarget(ATTACKER_SITE)], attackDice: 5 },
            {
                defense: ['blank'],
                attack: ['hollow', 'hollow', 'hollow', 'sword', 'sword']
            }
        )

        expect(rolled.campaign?.swords).toBe(3)
        expect(rolled.campaign?.defense).toBe(3)
        expect(boardOf(rolled, A)).toBe(5)

        expect(rolled.machineState).toBe(MachineState.CampaignSacrifice)

        const state = win(rolled, game, 1, firstOfForce(rolled, 1))

        expect(state.campaign?.attackerVictorious).toBe(true)
        expect(boardOf(state, A)).toBe(4)
        expect(boardOf(state, D)).toBe(2)
        expect(siteOf(state, ATTACKER_SITE)).toBe(0)
        expectSettled(state)
    })

    it('the sacrifice is capped, and never automatic', () => {
        const { game, state: rolled } = runCampaign(
            { attackerBoard: 2, sites: { [ATTACKER_SITE]: 4 } },
            { targets: [siteTarget(ATTACKER_SITE)], attackDice: 2 },
            { defense: ['shield'], attack: ['hollow', 'hollow'] }
        )

        expect(rolled.campaign?.swords).toBe(1)
        expect(rolled.campaign?.defense).toBe(5)

        const before = JSON.stringify(rolled)
        expect(() =>
            engine.run(
                act(buildAction(CampaignSacrifice, {
                    playerId: A,
                    sacrifice: 3,
                    defeatKills: []
                }), 'illegal'),
                rolled,
                game
            )
        ).toThrow(/only 2 warbands in your force/)
        expect(JSON.stringify(rolled)).toBe(before)

        const state = engine.run(
            act(buildAction(CampaignSacrifice, {
                playerId: A,
                sacrifice: 0,
                defeatKills: [{ at: { kind: 'board', playerId: A }, color: Color.Red, count: 1 }]
            }), 'decline'),
            rolled,
            game
        ).updatedState

        expect(state.campaign).toBeUndefined()
        expect(boardOf(state, A)).toBe(1)
        expect(siteOf(state, ATTACKER_SITE)).toBe(4)
        expectSettled(state)
    })

    it('doubler stacking, relic dice, the Oathkeeper die, board-warband defense', () => {
        const { game, state: rolled } = runCampaign(
            {
                attackerBoard: 6,
                defenderBoard: 2,
                defenderSiteId: ATTACKER_SITE,
                defenderRelicIds: [IVORY_EYE],
                defenderIsOathkeeper: true,
                sites: { [ATTACKER_SITE]: 1 }
            },
            {
                targets: [siteTarget(ATTACKER_SITE), relicTarget(IVORY_EYE)],
                attackDice: 6
            },
            {
                defense: ['shield', '2shields', 'x2', 'x2'],
                attack: ['sword', 'sword', 'sword', 'sword', 'sword', 'skull+2swords']
            }
        )

        expect(rolled.campaign?.defensePool).toBe(4)
        // R-5.5.4.a — the doubling never touches the warbands: 3 × 2² + 1 + 2.
        expect(rolled.campaign?.defense).toBe(15)
        expect(rolled.campaign?.swords).toBe(7)
        expect(boardOf(rolled, A)).toBe(5)

        // R-5.5.5.c, R-9.5 — 7 + 5 cannot reach 16, so declining is the only legal move.
        expect(() =>
            engine.run(
                act(buildAction(CampaignSacrifice, {
                    playerId: A,
                    sacrifice: 5,
                    defeatKills: []
                }), 'hopeless'),
                rolled,
                game
            )
        ).toThrow(/must sacrifice exactly 9/)

        const state = engine.run(
            act(buildAction(CampaignSacrifice, {
                playerId: A,
                sacrifice: 0,
                defeatKills: [{ at: { kind: 'board', playerId: A }, color: Color.Red, count: 2 }]
            })),
            rolled,
            game
        ).updatedState

        expect(state.campaign).toBeUndefined()
        expect(boardOf(state, A)).toBe(3)
        expect(state.players[1].relicIds).toEqual([IVORY_EYE])
        expectSettled(state)
    })

    it('doubling stacks exponentially, and three doublers prove it', () => {
        const S2 = 'p1'
        const { game, state: rolled } = runCampaign(
            {
                attackerBoard: 6,
                defenderBoard: 0,
                defenderSiteId: ATTACKER_SITE,
                defenderRelicIds: [IVORY_EYE],
                defenderIsOathkeeper: true,
                sites: { [ATTACKER_SITE]: 1, [S2]: 1 }
            },
            {
                targets: [siteTarget(ATTACKER_SITE), siteTarget(S2), relicTarget(IVORY_EYE)],
                attackDice: 6
            },
            {
                defense: ['shield', 'x2', 'x2', 'x2', 'blank'],
                attack: ['sword', 'sword', 'sword', 'sword', 'sword', 'sword']
            }
        )

        expect(rolled.campaign?.defensePool).toBe(5)
        // Three doublers, because two cannot tell 2ⁿ from 2n: 1 × 2³ + 2.
        expect(rolled.campaign?.defense).toBe(10)
        expect(rolled.campaign?.swords).toBe(6)

        // R-5.5.5.c — 6 + 5 > 10; R-5.5.6 — floor(2/2).
        const state = win(rolled, game, 5, firstOfForce(rolled, 1))

        expect(state.campaign?.attackerVictorious).toBe(true)
        expect(boardOf(state, A)).toBe(1)
    })

    it('doubling zero is zero', () => {
        const { game, state: rolled } = runCampaign(
            {
                attackerBoard: 6,
                defenderBoard: 2,
                defenderSiteId: ATTACKER_SITE,
                defenderRelicIds: [IVORY_EYE],
                defenderIsOathkeeper: true,
                sites: { [ATTACKER_SITE]: 1 }
            },
            {
                targets: [siteTarget(ATTACKER_SITE), relicTarget(IVORY_EYE)],
                attackDice: 6
            },
            {
                defense: ['blank', 'blank', 'x2', 'x2'],
                attack: ['sword', 'sword', 'sword', 'sword', 'sword', 'skull+2swords']
            }
        )

        expect(rolled.campaign?.defense).toBe(3)
        expect(rolled.campaign?.swords).toBe(7)

        const state = win(rolled, game, 0, firstOfForce(rolled, 1))

        expect(state.campaign?.attackerVictorious).toBe(true)
        expectSettled(state)
    })

    it('multi-target: dice and flat defense sum from a single roll', () => {
        const S2 = 'p1'
        const { game, state: rolled } = runCampaign(
            { attackerBoard: 8, sites: { [ATTACKER_SITE]: 2, [S2]: 3 } },
            { targets: [siteTarget(ATTACKER_SITE), siteTarget(S2)], attackDice: 8 },
            {
                defense: ['shield', 'x2'],
                attack: [
                    'sword',
                    'sword',
                    'sword',
                    'skull+2swords',
                    'skull+2swords',
                    'hollow',
                    'hollow',
                    'hollow'
                ]
            }
        )

        expect(rolled.campaign?.defensePool).toBe(2)
        expect(rolled.campaign?.defense).toBe(7)
        expect(rolled.campaign?.swords).toBe(8)
        expect(boardOf(rolled, A)).toBe(6)

        let state = win(rolled, game, 0, firstOfForce(rolled, 2))

        expect(state.campaign?.attackerVictorious).toBe(true)
        expect(boardOf(state, D)).toBe(3)
        expect(siteOf(state, ATTACKER_SITE)).toBe(0)
        expect(siteOf(state, S2)).toBe(0)

        state = engine.run(
            act(buildAction(CampaignResolveVictory, {
                playerId: A,
                placements: [
                    { siteId: ATTACKER_SITE, color: Color.Red, count: 1 },
                    { siteId: S2, color: Color.Red, count: 2 }
                ],
                burnFavor: false
            })),
            state,
            game
        ).updatedState

        expect(state.warbandsBySite[ATTACKER_SITE][Color.Red]).toBe(1)
        expect(state.warbandsBySite[S2][Color.Red]).toBe(2)
        expect(boardOf(state, A)).toBe(3)
        expectSettled(state)

        // R-2.11-H1, R-5.5.7.I — under Supremacy the title follows rule of the sites.
        expect(rolled.oathkeeperPlayerId).toBe(D)
        expect(state.oathkeeperPlayerId).toBe(A)
    })

    it('the attacker may roll fewer dice than they have warbands', () => {
        const { game, state: rolled } = runCampaign(
            {
                attackerBoard: 5,
                defenderIsOathkeeper: true,
                sites: { [ATTACKER_SITE]: 2 }
            },
            { targets: [siteTarget(ATTACKER_SITE)], attackDice: 3 },
            { defense: ['shield', 'shield'], attack: ['sword', 'sword', 'sword'] }
        )

        expect(rolled.campaign?.attackPool).toBe(3)
        // R-2.11.c
        expect(rolled.campaign?.defensePool).toBe(2)
        expect(rolled.campaign?.defense).toBe(4)
        expect(rolled.campaign?.swords).toBe(3)

        // R-5.5.5.c — exactly 4 + 1 − 3.
        const state = win(rolled, game, 2, firstOfForce(rolled, 1))

        expect(state.campaign?.attackerVictorious).toBe(true)
        expect(boardOf(state, A)).toBe(3)
        expect(boardOf(state, D)).toBe(1)
        expectSettled(state)
    })

    it('pawn-and-favor target: banish and favor burn', () => {
        const { game, state: rolled } = runCampaign(
            {
                attackerBoard: 6,
                defenderBoard: 3,
                defenderFavor: 5,
                defenderSiteId: ATTACKER_SITE,
                // D is a legal defender by pawn presence alone.
                sites: {}
            },
            { targets: [PAWN_AND_FAVOR], attackDice: 6 },
            {
                defense: ['2shields', 'blank'],
                attack: ['sword', 'sword', 'sword', 'sword', 'hollow', 'hollow']
            }
        )

        // R-5.5.2
        expect(rolled.campaign?.defensePool).toBe(2)
        expect(rolled.campaign?.defense).toBe(5)
        expect(rolled.campaign?.swords).toBe(5)

        let state = win(rolled, game, 1, firstOfForce(rolled, 1))

        expect(state.campaign?.attackerVictorious).toBe(true)
        expect(boardOf(state, A)).toBe(5)
        expect(boardOf(state, D)).toBe(2)

        state = engine.run(
            act(buildAction(CampaignResolveVictory, {
                playerId: A,
                placements: [],
                banishToSiteId: 'h3',
                burnFavor: true
            })),
            state,
            game
        ).updatedState

        expect(state.players[1].siteId).toBe('h3')
        // R-10.4 — floor(5/2) burned.
        expect(state.players[1].favor).toBe(3)
        expect(state.favorSupply).toBe(22)
        expectSettled(state)
    })

    it('underflow: a die removed from an empty pool becomes a defense die; a win on sacrifice alone', () => {
        const board: Board = {
            attackerBoard: 2,
            siteCards: { [ATTACKER_SITE]: MOUNTAIN, p1: PLAINS },
            denizensBySite: { p1: [LONGBOWS] }
        }
        const { game, state: rolled } = runCampaign(
            board,
            { targets: [siteTarget(ATTACKER_SITE)], attackDice: 1, defender: BANDITS },
            { defense: ['blank', 'blank'], attack: [] }
        )

        // R-5.5.3-H1 — the bandits rule the Plains too, so its cost-free Longbows is theirs.
        expect(rolled.campaign?.plansUsedBy?.bandits).toEqual([LONGBOWS])
        expect(rolled.campaign?.attackPool).toBe(0)
        expect(rolled.campaign?.defensePool).toBe(2)
        expect(rolled.campaign?.attackRoll).toEqual([])
        expect(rolled.campaign?.defendingBandits).toBe(1)
        expect(rolled.campaign?.defense).toBe(1)
        expect(rolled.campaign?.swords).toBe(0)

        let state = engine.run(
            act(buildAction(CampaignSacrifice, {
                playerId: A,
                sacrifice: 2,
                defeatKills: []
            })),
            rolled,
            game
        ).updatedState

        expect(state.campaign?.attackerVictorious).toBe(true)
        expect(boardOf(state, A)).toBe(0)

        state = engine.run(
            act(buildAction(CampaignResolveVictory, {
                playerId: A,
                placements: [],
                burnFavor: false
            })),
            state,
            game
        ).updatedState

        expect(state.warbandsBySite[ATTACKER_SITE]?.[Color.Red] ?? 0).toBe(0)
        expectSettled(state)
    })

    it('a site modifier is mandatory: the Mountain takes its die from any pool', () => {
        const board: Board = { attackerBoard: 3, siteCards: { [ATTACKER_SITE]: MOUNTAIN } }
        const pinned = { defense: ['blank'], attack: ['hollow', 'hollow'] }

        const full = runCampaign(
            board,
            { targets: [siteTarget(ATTACKER_SITE)], attackDice: 3, defender: BANDITS },
            pinned
        )
        expect(full.state.campaign?.attackPool).toBe(2)
        expect(full.state.campaign?.attackRoll).toHaveLength(2)

        const fewer = runCampaign(
            board,
            { targets: [siteTarget(ATTACKER_SITE)], attackDice: 2, defender: BANDITS },
            { defense: ['blank'], attack: ['hollow'] }
        )
        expect(fewer.state.campaign?.attackPool).toBe(1)
    })
})

function expectSettled(state: OathProjectedState) {
    const hydrated = new HydratedOathGameState(state)
    expectOneWarbandColorPerSite(hydrated)
    // R-1.9 — 14 per Exile.
    const census = warbandCensus(hydrated)
    expect(census[Color.Red]).toBe(14)
    expect(census[Color.Yellow]).toBe(14)
}
