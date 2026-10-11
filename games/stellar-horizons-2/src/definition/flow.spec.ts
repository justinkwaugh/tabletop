import { describe, expect, it } from 'vitest'
import { GameResult, type Game } from '@tabletop/common'
import { TechId } from '../components/techs.js'
import { WorldClass, WorldSide, maxPopulation, worldTile } from '../components/worlds.js'
import type {
    HydratedStellarHorizonsGameState,
    StellarHorizonsProjectedState
} from '../model/gameState.js'
import { CargoPartnerKind } from '../model/cargoTransfer.js'
import { TurnStep } from '../model/turn.js'
import { edit, execute, hydrate, startedGame, takeTile, userAction } from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'

function finishDecade(game: Game, state: StellarHorizonsProjectedState) {
    let current = state
    while (current.machineState === MachineState.PlayingTurn && current.year === state.year) {
        const [playerId] = current.activePlayerIds
        const step = hydrate(current).getPlayerState(playerId).step
        current = execute(game, current, userAction(game, playerId, ActionType.EndStep, { step }))
    }
    return current
}

function settleAlphaCentauri(state: HydratedStellarHorizonsGameState, settlements: number) {
    state.systemState('alpha-centauri').worlds = [
        {
            tileId: takeTile(state, (id) => worldTile(id).worldClass === WorldClass.M),
            side: WorldSide.I
        }
    ]
    for (const playerId of state.initiativeOrder()) {
        state.bases.push({
            playerId,
            systemId: 'alpha-centauri',
            settlements,
            spent: 0,
            cloned: false
        })
    }
}

describe('Footfall turn flow', () => {
    it('ends in a win once a player lands a tenth settlement in a 25-population system', () => {
        const { game, state: started } = startedGame(2)
        const [first] = started.turnManager.turnOrder
        let state = edit(started, (hydrated) => {
            settleAlphaCentauri(hydrated, 9)
            hydrated.bases = hydrated.bases.filter((base) => base.playerId === first)
            hydrated.ships.push({
                shipId: 'starfarers-andromeda',
                playerId: first,
                systemId: 'alpha-centauri',
                transit: 0,
                damage: 0,
                settlements: 1,
                loadedFromBase: false,
                explored: false
            })
            hydrated.getPlayerState(first).step = TurnStep.Cargo
        })
        state = execute(
            game,
            state,
            userAction(game, first, ActionType.TransferCargo, {
                shipId: 'starfarers-andromeda',
                partner: { kind: CargoPartnerKind.Base },
                settlements: -1
            })
        )
        state = finishDecade(game, state)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual([first])
    })

    it('ties when several players reach the goal in the same decade', () => {
        const { game, state: started } = startedGame(2)
        const state = finishDecade(
            game,
            edit(started, (hydrated) => settleAlphaCentauri(hydrated, 10))
        )
        expect(state.result).toBe(GameResult.Draw)
        expect(state.winningPlayerIds.toSorted()).toEqual(started.turnManager.turnOrder.toSorted())
    })

    it('ends in a loss when nobody reaches the goal by the end of 2300', () => {
        const { game, state: started } = startedGame(1)
        const state = finishDecade(
            game,
            edit(started, (hydrated) => (hydrated.year = 2300))
        )
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Loss)
        expect(state.winningPlayerIds).toEqual([])
    })

    it('starts the next decade with arrivals, then pays income in even decades', () => {
        const { game, state: started } = startedGame(2)
        const [first] = started.turnManager.turnOrder
        let state = edit(started, (hydrated) => {
            hydrated.ships.push({
                shipId: 'starfarers-kepler',
                playerId: first,
                systemId: 'alpha-centauri',
                transit: 1,
                damage: 0,
                settlements: 0,
                loadedFromBase: false,
                explored: false
            })
        })
        state = finishDecade(game, state)
        const next = hydrate(state)
        expect(next.year).toBe(2160)
        expect(next.ship('starfarers-kepler').transit).toBe(0)
        expect(next.players.every((player) => player.cash === 40)).toBe(true)
        expect(next.players.every((player) => player.step === TurnStep.Build)).toBe(true)
    })

    it('asks the surveyor whether to swap in a better small world', () => {
        const { game, state: started } = startedGame(2)
        const [first] = started.turnManager.turnOrder
        let state = edit(started, (hydrated) => {
            const system = hydrated.systemState('luhman-16')
            system.worlds = [
                {
                    tileId: takeTile(hydrated, (id) => maxPopulation(id, WorldSide.I) === 1),
                    side: WorldSide.I
                },
                {
                    tileId: takeTile(hydrated, (id) => maxPopulation(id, WorldSide.I) === 2),
                    side: WorldSide.I
                }
            ]
            hydrated.worldPool = hydrated.worldPool.filter(
                (id) => maxPopulation(id, WorldSide.I) === 9
            )
            hydrated.pendingSurveys.push({ playerId: first, shipId: 'x', systemId: 'luhman-16' })
        })
        state = finishDecade(game, state)
        expect(state.machineState).toBe(MachineState.ChoosingSurveyWorld)
        expect(state.activePlayerIds).toEqual([first])
        state = execute(
            game,
            state,
            userAction(game, first, ActionType.ChooseSurveyWorld, { slot: 0 })
        )
        const after = hydrate(state)
        expect(maxPopulation(after.systemState('luhman-16').worlds[0].tileId, WorldSide.I)).toBe(9)
        expect(after.year).toBe(2160)
    })

    it('offers terraforming at the end of even decades to players with the tech and a base', () => {
        const { game, state: started } = startedGame(2)
        const [first, second] = started.turnManager.turnOrder
        let state = edit(started, (hydrated) => {
            hydrated.year = 2160
            hydrated.getPlayerState(first).techs.push({ techId: TechId.Terraforming, year: 2150 })
            settleAlphaCentauri(hydrated, 1)
        })
        state = finishDecade(game, state)
        expect(state.machineState).toBe(MachineState.Terraforming)
        expect(state.activePlayerIds).toEqual([first])
        state = execute(
            game,
            state,
            userAction(game, first, ActionType.Terraform, { systemId: 'alpha-centauri', slot: 0 })
        )
        const after = hydrate(state)
        expect(after.systemState('alpha-centauri').worlds[0].side).toBe(WorldSide.II)
        expect(after.year).toBe(2170)
        expect(after.getPlayerState(second).step).toBe(TurnStep.Build)
    })

    it("ends the movement step once none of the player's ships can move", () => {
        const { game, state: started } = startedGame(2)
        const [first] = started.turnManager.turnOrder
        const probe = (shipId: string) => ({
            shipId,
            playerId: first,
            systemId: 'sol',
            transit: 0,
            damage: 0,
            settlements: 0,
            loadedFromBase: false,
            explored: false
        })
        let state = edit(started, (hydrated) => {
            hydrated.ships.push(probe('starfarers-kepler'), probe('starfarers-copernicus'))
            hydrated.getPlayerState(first).step = TurnStep.Movement
        })
        const move = (shipId: string) =>
            execute(
                game,
                state,
                userAction(game, first, ActionType.MoveShip, { shipId, systemId: 'alpha-centauri' })
            )
        state = move('starfarers-kepler')
        expect(hydrate(state).getPlayerState(first).step).toBe(TurnStep.Movement)
        state = move('starfarers-copernicus')
        expect(hydrate(state).getPlayerState(first).step).toBe(TurnStep.Exploration)
    })

    it('skips the movement step for a player with nothing to move', () => {
        const { game, state: started } = startedGame(2)
        const [first] = started.turnManager.turnOrder
        let state = edit(started, (hydrated) => {
            hydrated.getPlayerState(first).step = TurnStep.Cargo
        })
        state = execute(
            game,
            state,
            userAction(game, first, ActionType.EndStep, { step: TurnStep.Cargo })
        )
        expect(hydrate(state).getPlayerState(first).step).toBe(TurnStep.Exploration)
    })
})
