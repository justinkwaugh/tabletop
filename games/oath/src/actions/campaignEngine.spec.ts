import { engine } from '../testing/engine.js'
import { buildAction, machineContext } from '../testing/actions.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { Color, Game, assertExists, type GameAction } from '@tabletop/common'
import { OathRuntime } from '../definition/runtime.js'
import { ActionType } from '../definition/actions.js'
import { Campaign } from './campaign.js'
import { CampaignResolveVictory } from './campaignResolveVictory.js'
import { CampaignSacrifice } from './campaignSacrifice.js'
import { Travel } from './travel.js'
import { AnswerConsent } from './answerConsent.js'
import { MachineState } from '../definition/states.js'
import { Banner, CardKind, PlayerStatus } from '../model/oathEnums.js'
import { registerCards } from '../data/cardRegistry.js'
import { bySuit } from '../data/typedData.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { expectOneWarbandColorPerSite, warbandCensus } from '../testing/census.js'
import { favorCensus } from '../testing/census.js'
import { testGame } from '../testing/game.js'


const ATTACKER = 'p1'
const DEFENDER = 'p2'
const RELIC = 'relic.test.crown'

beforeAll(() => {
    registerCards([{ id: RELIC, name: 'Crown', kind: CardKind.Relic, defenseDice: 1 }])
})

function buildGame(): Game {
    return testGame([ATTACKER, DEFENDER])
}

function buildState(seed = 20260826): OathProjectedState {
    const state = testState(
        withChancellor([
            testPlayer({
                playerId: ATTACKER,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                supply: 7,
                warbandsOnBoard: { [Color.Red]: 8 },
                warbandsInPersonalBank: { [Color.Red]: 4 }
            }),
            testPlayer({
                playerId: DEFENDER,
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                favor: 5,
                warbandsOnBoard: {},
                warbandsInPersonalBank: { [Color.Yellow]: 13 },
                relicIds: [RELIC]
            })
        ]),
        {
            machineState: MachineState.ActPhase,
            // R-6.5 — the defender rules c1, so the attacker's warbands start on their board.
            warbandsBySite: { c1: { [Color.Yellow]: 1 } },
            favorSupply: 13,
            favorBank: bySuit(() => 3),
            banners: {
                [Banner.PeoplesFavor]: { holderPlayerId: DEFENDER, value: 4, mobSide: false },
                [Banner.DarkestSecret]: { value: 1 }
            },
            prng: { seed, invocations: 0 }
        }
    ).dehydrate()

    state.turnManager = {
        series: [{ type: 'turn', playerId: ATTACKER, start: 0 }],
        turnOrder: [ATTACKER, DEFENDER],
        turnCounts: { [ATTACKER]: 0, [DEFENDER]: 0 }
    }
    state.activePlayerIds = [ATTACKER]
    return state
}

function action(built: GameAction) {
    return { ...built, id: `a-${built.type}` }
}

const FULL_CAMPAIGN = buildAction(Campaign, {
    playerId: ATTACKER,
    defender: { kind: 'player', playerId: DEFENDER },
    targets: [
        { kind: CampaignTargetKind.Site, siteId: 'c1' },
        { kind: CampaignTargetKind.Relic, cardId: RELIC },
        { kind: CampaignTargetKind.Banner, banner: Banner.PeoplesFavor },
        { kind: CampaignTargetKind.PawnAndFavor }
    ],
    attackDice: 8,
})

/** Wins on swords alone, so R-9.5 permits no sacrifice. */
function seedWhereSwordsAlreadyWin(): number {
    const game = buildGame()
    for (let seed = 1; seed < 5000; seed++) {
        const campaign = engine.run(action(FULL_CAMPAIGN), buildState(seed), game)
            .updatedState.campaign
        if (campaign && campaign.swords > campaign.defense) {
            return seed
        }
    }
    throw Error('no seed found where the attack wins outright')
}

describe('a Campaign through the engine', () => {
    it('runs the three actions and lands back in the Act Phase', () => {
        const game = buildGame()
        let state = buildState(seedWhereSwordsAlreadyWin())

        const warbandsBefore = warbandCensus(new HydratedOathGameState(state))
        const favorBefore = favorCensus(new HydratedOathGameState(state))

        expect(
            OathRuntime.stateHandlers[MachineState.ActPhase].validActionsForPlayer(
                ATTACKER,
                machineContext(new HydratedOathGameState(state))
            )
        ).toContain(ActionType.Campaign)

        let result = engine.run(action(FULL_CAMPAIGN), state, game)
        state = result.updatedState

        expect(state.machineState).toBe(MachineState.CampaignSacrifice)
        // R-4.2 — the attacker is mid-action and keeps the turn.
        expect(state.activePlayerIds).toEqual([ATTACKER])
        expect(state.campaign?.attackerPlayerId).toBe(ATTACKER)
        expect(state.campaign?.defensePool).toBe(8)
        expect(state.prng.invocations).toBe(16)

        const campaign = state.campaign
        assertExists(campaign, 'the roll opened a Campaign')
        expect(campaign.swords).toBeGreaterThan(campaign.defense)

        const defendingForce = campaign?.defendingForce ?? []
        expect(defendingForce.reduce((n, g) => n + g.count, 0)).toBe(1)

        result = engine.run(
            action(buildAction(CampaignSacrifice, {
                playerId: ATTACKER,
                sacrifice: 0,
                defeatKills: []
            })),
            state,
            game
        )
        state = result.updatedState

        expect(state.campaign?.attackerVictorious).toBe(true)
        expect(state.machineState).toBe(MachineState.CampaignVictory)
        // R-5.5.6
        expect(state.warbandsBySite['c1'][Color.Yellow]).toBe(0)

        result = engine.run(
            action(buildAction(CampaignResolveVictory, {
                playerId: ATTACKER,
                placements: [{ siteId: 'c1', color: Color.Red, count: 2 }],
                banishToSiteId: 'h3',
                burnFavor: true
            })),
            state,
            game
        )
        state = result.updatedState

        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual([ATTACKER])
        expect(state.campaign).toBeUndefined()

        const hydrated = new HydratedOathGameState(state)
        // R-5.5.7.I
        expect(state.warbandsBySite['c1'][Color.Red]).toBe(2)
        expect(state.warbandsBySite['c1'][Color.Yellow]).toBe(0)
        // R-5.5.7.II
        expect(state.players[0].relicIds).toEqual([RELIC])
        expect(state.players[1].relicIds).toEqual([])
        expect(state.banners[Banner.PeoplesFavor].holderPlayerId).toBe(ATTACKER)
        expect(state.banners[Banner.PeoplesFavor].value).toBe(2)
        expect(state.banners[Banner.PeoplesFavor].mobSide).toBe(true)
        // R-5.5.7.III
        expect(state.players[1].siteId).toBe('h3')
        expect(state.players[1].favor).toBe(3)

        expect(warbandCensus(hydrated)).toEqual(warbandsBefore)
        expect(favorCensus(hydrated)).toBe(favorBefore)
        expectOneWarbandColorPerSite(hydrated)
    })

    it('replays identically from the same seed -- the roll is in state, not the server', () => {
        const game = buildGame()
        const run = () => {
            const result = engine.run(
                action(buildAction(Campaign, {
                    playerId: ATTACKER,
                    defender: { kind: 'player', playerId: DEFENDER },
                    targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }],
                    attackDice: 8,
                })),
                buildState(),
                game
            )
            return result.updatedState.campaign
        }
        expect(run()).toEqual(run())
    })

    it('refuses a Campaign action while the machine is mid-Campaign (R-4.2)', () => {
        const game = buildGame()
        const first = engine.run(
            action(buildAction(Campaign, {
                playerId: ATTACKER,
                defender: { kind: 'player', playerId: DEFENDER },
                targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }],
                attackDice: 4,
            })),
            buildState(),
            game
        )

        expect(() =>
            engine.run(
                action(buildAction(Travel, {
                    playerId: ATTACKER,
                    siteId: 'p1'
                })),
                first.updatedState,
                game
            )
        ).toThrow()
    })

})

describe('R-5.5.2.a — a Citizen joins the defence, through the engine', () => {
    const CHANCELLOR = 'p2'
    const CITIZEN = 'p3'

    function empireAtC1(): OathProjectedState {
        const state = testState(
            [
                testPlayer({ playerId: ATTACKER, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 7, warbandsOnBoard: { [Color.Red]: 5 }, warbandsInPersonalBank: { [Color.Red]: 7 } }),
                testPlayer({ playerId: CHANCELLOR, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c1', warbandsOnBoard: { purple: 2 }, warbandsInPersonalBank: { purple: 15 } }),
                testPlayer({ playerId: CITIZEN, color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'c1', warbandsOnBoard: { purple: 1 }, warbandsInPersonalBank: { [Color.Blue]: 14 } })
            ],
            { machineState: MachineState.ActPhase, chancellorPlayerId: CHANCELLOR, warbandsBySite: { c1: { purple: 2 } }, prng: { seed: 1, invocations: 0 } }
        ).dehydrate()
        state.turnManager = {
            series: [{ type: 'turn', playerId: ATTACKER, start: 0 }],
            turnOrder: [ATTACKER, CHANCELLOR, CITIZEN],
            turnCounts: { [ATTACKER]: 0, [CHANCELLOR]: 0, [CITIZEN]: 0 }
        }
        state.activePlayerIds = [ATTACKER]
        return state
    }

    it('asks the Citizen, then the defender, each on the clock in turn, before anything is rolled', () => {
        const game = testGame([ATTACKER, CHANCELLOR, CITIZEN])
        let state = engine.runNext(buildAction(Campaign, {
            playerId: ATTACKER,
            defender: { kind: 'player', playerId: CHANCELLOR },
            targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }],
            attackDice: 3
        }), empireAtC1(), game).updatedState
        expect(state.machineState).toBe(MachineState.ConsentRequest)
        expect(state.activePlayerIds).toEqual([CITIZEN])
        expect(engine.getValidActionTypesForPlayer(game, state, CITIZEN)).toEqual([ActionType.AnswerConsent])
        expect(engine.getValidActionTypesForPlayer(game, state, ATTACKER)).toEqual([])
        expect(state.prng.invocations).toBe(0)

        state = engine.runNext(buildAction(AnswerConsent, { playerId: CITIZEN, granted: true }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.ConsentRequest)
        expect(state.activePlayerIds).toEqual([CHANCELLOR])

        state = engine.runNext(buildAction(AnswerConsent, { playerId: CHANCELLOR, granted: true }), state, game).updatedState
        expect(state.campaign?.allyPlayerIds).toEqual([CITIZEN])
        expect(state.pendingCampaign).toBeUndefined()
        // Nobody holds a battle plan, so the muster rolls and the attacker is on the clock.
        expect(state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(state.activePlayerIds).toEqual([ATTACKER])
        expect(state.prng.invocations).toBeGreaterThan(0)
    })
})
