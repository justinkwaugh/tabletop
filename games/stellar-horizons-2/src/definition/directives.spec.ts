import { describe, expect, it } from 'vitest'
import { assertExists, type GameAction } from '@tabletop/common'
import { AnomalyChallenge } from '../components/anomalyCatalog.js'
import {
    DIRECTIVES,
    DirectiveAttack,
    DirectiveProduction,
    DirectiveType
} from '../components/directives.js'
import { Faction } from '../components/factions.js'
import { ScenarioId } from '../components/scenarios.js'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { TradeGood } from '../components/tradeGoods.js'
import { WorldClass } from '../components/worldTypes.js'
import {
    directiveScore,
    directiveTargets,
    redrawDirective,
    ruledDifficulty
} from '../model/directives.js'
import { recordTurnProgress } from '../model/turnRecord.js'
import {
    StellarHorizonsGameStateValidator,
    type HydratedStellarHorizonsGameState,
    type StellarHorizonsProjectedState
} from '../model/gameState.js'
import { DirectiveStatus } from '../model/pieces.js'
import {
    chooseDirectives,
    edit,
    endPhase,
    executeAll,
    finishDecade,
    giveDirective,
    hydrate,
    placeBase,
    startedGame,
    userAction
} from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { StellarHorizonsRuntime } from './runtime.js'
import { MachineState } from './states.js'

const CAMPAIGN = { scenario: ScenarioId.Campaign }

function campaign() {
    return startedGame(3, CAMPAIGN)
}

function held(state: StellarHorizonsProjectedState, playerId: string, status: DirectiveStatus) {
    return hydrate(state)
        .getPlayerState(playerId)
        .heldDirectives.filter((entry) => entry.status === status)
}

function playerOf(state: HydratedStellarHorizonsGameState, faction: Faction): string {
    const player = state.players.find((candidate) => candidate.faction === faction)
    assertExists(player, `Nobody plays ${faction}`)
    return player.playerId
}

describe('Directives at the start', () => {
    it('are drawn three each and one kept by each Player in secret', () => {
        const { game, state } = startedGame(3, CAMPAIGN, { choosingDirectives: true })
        expect(state.machineState).toBe(MachineState.ChoosingDirective)
        for (const player of state.players) {
            expect(held(state, player.playerId, DirectiveStatus.Drawn)).toHaveLength(3)
        }
        expect(hydrate(state).directivePile.remaining).toBe(DIRECTIVES.length - 9)
        if (!StellarHorizonsGameStateValidator.Check(state)) {
            throw new Error('Expected complete canonical state')
        }
        const [viewer, other] = state.players.map((player) => player.playerId)
        const view = StellarHorizonsRuntime.visibility.state.project(
            state,
            { kind: 'player', playerId: viewer },
            { config: game.config }
        )
        const theirs = view.players.find((player) => player.playerId === other)
        expect(theirs?.heldDirectives).toHaveLength(3)
        expect(theirs?.heldDirectives.every((entry) => entry.directiveId === undefined)).toBe(true)
        expect(view.directivePile.directives).toEqual([])

        const chosen = chooseDirectives(game, state)
        expect(chosen.machineState).toBe(MachineState.Exploring)
        for (const player of chosen.players) {
            expect(held(chosen, player.playerId, DirectiveStatus.Current)).toHaveLength(1)
            expect(held(chosen, player.playerId, DirectiveStatus.Drawn)).toEqual([])
        }
        // The two not kept go back to the pool (campaign plan, slice 6, Q3).
        expect(hydrate(chosen).directivePile.remaining).toBe(DIRECTIVES.length - 3)
    })

    it('are not played when the option is off', () => {
        const { state } = startedGame(3, { ...CAMPAIGN, directives: false })
        expect(state.machineState).toBe(MachineState.Exploring)
        expect(state.players.every((player) => player.heldDirectives.length === 0)).toBe(true)
    })

    it('fill hidden directives and the pool when exploring from a Player’s view', () => {
        const { game, state } = campaign()
        if (!StellarHorizonsGameStateValidator.Check(state)) {
            throw new Error('Expected complete canonical state')
        }
        const viewer = state.players[0].playerId
        const view = StellarHorizonsRuntime.visibility.state.project(
            state,
            { kind: 'player', playerId: viewer },
            { config: game.config }
        )
        const populate = StellarHorizonsRuntime.exploration.createFromProjectedState
        assertExists(populate)
        let seed = 7
        const sample = populate({
            game,
            state: view,
            actions: [],
            perspective: { kind: 'player', playerId: viewer },
            random: () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
        })
        expect(StellarHorizonsGameStateValidator.Check(sample)).toBe(true)
        expect(sample.players[0].heldDirectives).toEqual(state.players[0].heldDirectives)
        const all = [
            ...sample.directivePile.directives,
            ...sample.players.flatMap((player) =>
                player.heldDirectives.map((entry) => entry.directiveId)
            )
        ]
        expect(all.toSorted()).toEqual(DIRECTIVES.map((directive) => directive.id).toSorted())
    })
})

describe('Fulfilling a directive', () => {
    it('is automatic once the turn’s total reaches it: 1 IP, face up, nothing held', () => {
        const { state } = campaign()
        const hydrated = hydrate(state)
        const [playerId] = hydrated.initiativeOrder()
        giveDirective(hydrated, playerId, 'p4')
        const influence = hydrated.getPlayerState(playerId).influence
        const cash = (amount: number) =>
            recordTurnProgress(hydrated, playerId, {
                kind: DirectiveType.Production,
                production: DirectiveProduction.BaseProductionCash,
                amount
            })
        expect(cash(4)).toBeUndefined()
        expect(cash(3)).toEqual({ playerId, directiveId: 'p4', year: hydrated.year })
        const player = hydrated.getPlayerState(playerId)
        expect(player.influence).toBe(influence + 1)
        expect(player.heldDirectives).toEqual([])
        expect(player.fulfilledDirectives.map((entry) => entry.directiveId)).toEqual(['p4'])
    })

    it('counts the turn’s sales of the named goods at the named system', () => {
        const { state } = campaign()
        const hydrated = hydrate(state)
        const [playerId] = hydrated.initiativeOrder()
        giveDirective(hydrated, playerId, 't3')
        const sell = (systemId: string, good: TradeGood) =>
            recordTurnProgress(hydrated, playerId, {
                kind: DirectiveType.Trade,
                systemId,
                good
            })
        expect(sell(SOL_SYSTEM_ID, TradeGood.Ore)).toBeUndefined()
        expect(sell(SOL_SYSTEM_ID, TradeGood.Food)).toBeUndefined()
        expect(sell('alpha-centauri', TradeGood.Ore)).toBeUndefined()
        expect(sell(SOL_SYSTEM_ID, TradeGood.Ore)?.directiveId).toBe('t3')
    })

    it('meets a combat directive against the Player with most settlements at bases, ties too', () => {
        const { state } = campaign()
        const hydrated = hydrate(state)
        const [holder, second, third] = hydrated.initiativeOrder()
        placeBase(hydrated, second, 'alpha-centauri', 6)
        placeBase(hydrated, third, 'barnards-star', 4)
        expect(directiveTargets(hydrated, holder)).toEqual([second])
        placeBase(hydrated, third, 'procyon', 2)
        expect(directiveTargets(hydrated, holder).toSorted()).toEqual([second, third].toSorted())
        giveDirective(hydrated, holder, 'c1')
        const attack = (attack: DirectiveAttack, targetId: string) =>
            recordTurnProgress(hydrated, holder, {
                kind: DirectiveType.Combat,
                attack,
                targetId
            })
        expect(attack(DirectiveAttack.Blockade, third)).toBeUndefined()
        expect(attack(DirectiveAttack.Raid, third)?.directiveId).toBe('c1')
    })

    it('meets an anomaly directive at the ruled difficulty, and a terraform by class', () => {
        const { state } = campaign()
        const hydrated = hydrate(state)
        const starfarers = playerOf(hydrated, Faction.Starfarers)
        const givers = playerOf(hydrated, Faction.Givers)
        // Printed 5, 3 Players; the Starfarers take 1 off science when they take part (Q6).
        expect(ruledDifficulty(hydrated, 5, AnomalyChallenge.Science, [givers])).toBe(8)
        expect(ruledDifficulty(hydrated, 5, AnomalyChallenge.Science, [givers, starfarers])).toBe(7)
        expect(ruledDifficulty(hydrated, 5, AnomalyChallenge.Combat, [starfarers])).toBe(8)
        giveDirective(hydrated, givers, 'a2')
        const resolve = (challenge: AnomalyChallenge, difficulty: number) =>
            recordTurnProgress(hydrated, givers, {
                kind: DirectiveType.Anomaly,
                challenge,
                difficulty
            })
        expect(resolve(AnomalyChallenge.Science, 9)).toBeUndefined()
        expect(resolve(AnomalyChallenge.Combat, 6)).toBeUndefined()
        expect(resolve(AnomalyChallenge.Combat, 7)?.directiveId).toBe('a2')
        giveDirective(hydrated, givers, 'tf2')
        const terraform = (worldClass: WorldClass) =>
            recordTurnProgress(hydrated, givers, {
                kind: DirectiveType.Terraform,
                worldClass
            })
        expect(terraform(WorldClass.L)).toBeUndefined()
        expect(terraform(WorldClass.O)?.directiveId).toBe('tf2')
    })
})

describe('The next directive', () => {
    it('is drawn at the start of the next turn; a surveyed system’s directive is redrawn', () => {
        const { game, state: start } = campaign()
        let surveyor = ''
        let fulfiller = ''
        const ready = edit(start, (hydrated) => {
            ;[surveyor, fulfiller] = hydrated.initiativeOrder()
            giveDirective(hydrated, surveyor, 's4')
            hydrated.systemState('procyon').explorationMarker = 0
            giveDirective(hydrated, fulfiller, 'p1')
            recordTurnProgress(hydrated, fulfiller, {
                kind: DirectiveType.Production,
                production: DirectiveProduction.MiningCash,
                amount: 3
            })
        })
        expect(held(ready, fulfiller, DirectiveStatus.Current)).toEqual([])
        const next = finishDecade(game, ready)
        expect(next.year).toBe(start.year + 10)
        expect(next.machineState).toBe(MachineState.ChoosingDirective)
        expect(next.removedDirectives).toEqual([{ playerId: surveyor, directiveId: 's4' }])
        for (const playerId of [surveyor, fulfiller]) {
            expect(held(next, playerId, DirectiveStatus.Drawn)).toHaveLength(2)
        }
        const chosen = chooseDirectives(game, next)
        expect(chosen.machineState).not.toBe(MachineState.ChoosingDirective)
        expect(held(chosen, surveyor, DirectiveStatus.Current)).toHaveLength(1)
    })
})

describe('Redrawing a directive', () => {
    it('in a Branch gives it up for 1 IP and deals two once the span ends', () => {
        const { game, state: start } = campaign()
        const ready = edit(start, (hydrated) => {
            for (const player of hydrated.players) {
                player.influence = 2
            }
        })
        const [playerId] = ready.activePlayerIds
        const result = executeAll(
            game,
            ready,
            userAction(game, playerId, ActionType.RedrawDirective, {})
        )
        const redraw = result.processedActions.find(
            (action: GameAction) => action.type === ActionType.RedrawDirective
        )
        expect(redraw?.revealsInfo).toBeFalsy()
        let state = result.state
        const [givenUp] = held(state, playerId, DirectiveStatus.GivenUp)
        expect(givenUp?.directiveId).toBeDefined()
        expect(hydrate(state).getPlayerState(playerId).influence).toBe(1)
        // Once a turn.
        expect(() =>
            executeAll(game, state, userAction(game, playerId, ActionType.RedrawDirective, {}))
        ).toThrow()
        while (state.machineState !== MachineState.ChoosingDirective) {
            state = endPhase(game, state)
        }
        expect(state.activePlayerIds).toEqual([playerId])
        const drawn = held(state, playerId, DirectiveStatus.Drawn)
        expect(drawn).toHaveLength(2)
        // The directive given up goes back only after the draw, so it cannot be drawn again.
        expect(drawn.map((entry) => entry.directiveId)).not.toContain(givenUp.directiveId)
        expect(held(state, playerId, DirectiveStatus.GivenUp)).toEqual([])
        const chosen = chooseDirectives(game, state)
        expect(held(chosen, playerId, DirectiveStatus.Current)).toHaveLength(1)
        expect(hydrate(chosen).directivePile.remaining).toBe(DIRECTIVES.length - 3)
    })

    it('on the Main Line draws the two at once', () => {
        const { state } = campaign()
        const hydrated = hydrate(state)
        hydrated.parallelSpan = undefined
        const [playerId] = hydrated.initiativeOrder()
        hydrated.getPlayerState(playerId).influence = 1
        // With two left, the draw takes both, never the one given up.
        hydrated.directivePile.directives = hydrated.directivePile.directives.slice(0, 2)
        hydrated.directivePile.remaining = 2
        const result = redrawDirective(hydrated, playerId)
        expect(result.queued).toBe(false)
        expect(result.drawn).toHaveLength(2)
        expect(result.drawn.map((entry) => entry.directiveId)).not.toContain(
            result.givenUp.directiveId
        )
        expect(hydrated.directivePile.directives).toEqual([result.givenUp.directiveId])
    })
})

describe('Scoring directives', () => {
    it('adds their points and takes 15 for each short of the faction’s goal', () => {
        const { state } = campaign()
        const hydrated = hydrate(state)
        const givers = playerOf(hydrated, Faction.Givers)
        const player = hydrated.getPlayerState(givers)
        // The Givers must fulfil 2 terraform directives.
        player.fulfilledDirectives = [
            { playerId: givers, directiveId: 'tf1', year: 2100 },
            { playerId: givers, directiveId: 's9', year: 2110 }
        ]
        expect(directiveScore(hydrated, givers)).toEqual({ points: 12, shortfall: 1, penalty: 15 })
    })
})

describe('Directives in play', () => {
    it('go on to the economic phase once the turn’s draws are chosen', () => {
        const { game, state } = campaign()
        const next = chooseDirectives(game, finishDecade(game, state))
        expect(next.year).toBe(state.year + 10)
        // The first turn had no economic phase; this one has drawn its tile.
        expect(state.economicTile).toBeUndefined()
        expect(next.economicTile).toBeDefined()
    })
})
