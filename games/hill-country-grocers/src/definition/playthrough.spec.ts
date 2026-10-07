import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    GameResult,
    MachineContext,
    PlayerStatus,
    assert,
    assertExists,
    validateGameResult,
    type GameAction
} from '@tabletop/common'
import { CompanyId, isGrocer } from '../components/companies.js'
import type { HcgGameState, HydratedHcgGameState } from '../model/gameState.js'
import { ACTIONS_PER_ROUND } from '../model/actionSpaces.js'
import { ActionType } from './actions.js'
import { Definition } from './definition.js'
import { HcgRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(HcgRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

export function createGame(count: number) {
    return HcgRuntime.initializer.initializeGame(
        {
            id: 'hcg-playthrough',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 11,
            config: {},
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function act<T extends GameAction>(action: T): GameAction {
    return action
}

export function botAction(state: HydratedHcgGameState, playerId: string, step: number): GameAction {
    const base = { id: `a${step}`, gameId: state.gameId, source: ActionSource.User, playerId }
    const valid = HcgRuntime.stateHandlers[state.machineState].validActionsForPlayer(
        playerId,
        new MachineContext({ gameConfig: {}, gameState: state })
    )
    switch (state.machineState) {
        case MachineState.Bidding: {
            const amount = state.smallestBid()
            const cash = state.getPlayerState(playerId).cash
            if (
                valid.includes(ActionType.PlaceBid) &&
                (!valid.includes(ActionType.PassBid) || amount <= Math.min(cash, 1 + (step % 4)))
            ) {
                return act({ ...base, type: ActionType.PlaceBid, amount })
            }
            return act({ ...base, type: ActionType.PassBid })
        }
        case MachineState.PlacingBonusCube: {
            const [hexId] = state.nextCubeHexes(CompanyId.Streamside)
            return step % 3 === 0 || !hexId
                ? act({ ...base, type: ActionType.SkipBonusCube })
                : act({
                      ...base,
                      type: ActionType.BuildNetwork,
                      companyId: CompanyId.Streamside,
                      hexIds: [hexId]
                  })
        }
        case MachineState.ChoosingAction: {
            const spaces = state.availableSpaces(playerId)
            return act({
                ...base,
                type: ActionType.ChooseAction,
                space: spaces[step % spaces.length]
            })
        }
        case MachineState.BuildingNetwork: {
            const [companyId] = state.buildableCompanies(playerId)
            const hexIds: string[] = []
            for (let count = 0; count < 1 + (step % 3); count++) {
                const next = state.nextCubeHexes(companyId, hexIds)
                if (next.length === 0) {
                    break
                }
                hexIds.push(next[step % next.length])
            }
            return act({ ...base, type: ActionType.BuildNetwork, companyId, hexIds })
        }
        case MachineState.DevelopingTowns: {
            if (valid.includes(ActionType.TakeDevelopmentCash) && step % 2 === 0) {
                return act({ ...base, type: ActionType.TakeDevelopmentCash })
            }
            if (!valid.includes(ActionType.Develop)) {
                return act({ ...base, type: ActionType.TakeDevelopmentCash })
            }
            const cities = state.developableCities()
            const cityId = cities[step % cities.length]
            const payeeIds = state.mustChooseBuilderPayees(cityId)
                ? state.grocersInCity(cityId).slice(0, state.builderPaymentsDue(cityId))
                : undefined
            return act({
                ...base,
                type: ActionType.Develop,
                cityId,
                ...(payeeIds ? { payeeIds } : {})
            })
        }
        case MachineState.StartingAuction: {
            const companies = state.auctionableCompanies()
            return act({
                ...base,
                type: ActionType.OpenAuction,
                companyId: companies[step % companies.length],
                amount: Math.min(state.getPlayerState(playerId).cash, step % 3)
            })
        }
        default:
            throw Error(`No bot move in ${state.machineState}`)
    }
}

function playToEnd(count: number, check?: (state: HydratedHcgGameState) => void): HcgGameState {
    const game = createGame(count)
    let state = engine.startGame(game, { masterSeed }).initialState
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 5000, 'Playthrough did not finish')
        const hydrated = HcgRuntime.hydrator.hydrateState(state)
        check?.(hydrated)
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        state = engine.executeCanonicalAction({
            game,
            state,
            action: botAction(hydrated, playerId, step)
        }).updatedState
    }
    return state
}

describe.each([3, 4, 5])('a %i player game', (count) => {
    it('plays from the initial auction to a declared result', () => {
        const finished = playToEnd(count)
        const hydrated = HcgRuntime.hydrator.hydrateState(finished)
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect(hydrated.isGameEndTriggered()).toBe(true)
        expect(finished.dividendsPaid).toBeGreaterThan(0)
        expect([GameResult.Win, GameResult.Draw]).toContain(finished.result)
        expect(() => validateGameResult(finished)).not.toThrow()

        const scores = HcgRuntime.scoring.finalScores(finished)
        const best = Math.max(...Object.values(scores))
        expect(finished.winningPlayerIds.every((playerId) => scores[playerId] === best)).toBe(true)
        const again = playToEnd(count)
        expect({ ...again, id: finished.id }).toEqual(finished)
    })

    it('keeps money, cubes, markers and shares within their limits', () => {
        playToEnd(count, (state) => {
            expect(state.roundTrack.length).toBeLessThanOrEqual(ACTIONS_PER_ROUND)
            expect(state.markersRemaining()).toBeGreaterThanOrEqual(0)
            for (const company of state.companies) {
                expect(company.treasury).toBeGreaterThanOrEqual(0)
                expect(state.unsoldShares(company.id)).toBeGreaterThanOrEqual(0)
                if (isGrocer(company.id)) {
                    expect(state.cubesRemaining(company.id)).toBeGreaterThanOrEqual(0)
                }
            }
            for (const player of state.players) {
                expect(player.cash).toBeGreaterThanOrEqual(0)
            }
        })
    })
})
