import {
    BaseGameInitializer,
    HydratedPhaseManager,
    HydratedRoundManager,
    HydratedTurnManager,
    Prng,
    assertExists,
    shuffle,
    type Game,
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { HydratedLwGameState, type LwGameState, type LwProjectedState } from '../model/gameState.js'
import { LOCOMOTIVES, LocomotiveId } from '../model/locomotives.js'
import type { LocomotiveSpace } from '../model/market.js'
import { HydratedLwPlayerState } from '../model/playerState.js'
import { startRound } from '../stateHandlers/flow.js'
import { LwColors } from './colors.js'
import { readLwSetup, startingCash, startsWithWorks } from './setup.js'
import { MachineState } from './states.js'

const OPENING_EXISTING_ORDERS = 3

export class LwGameInitializer
    extends BaseGameInitializer<LwProjectedState, HydratedLwGameState>
    implements GameInitializer<LwProjectedState, HydratedLwGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedLwGameState {
        const setup = readLwSetup(game.config)
        const prng = new Prng(state.prng)
        const playerCount = game.players.length
        const withWorks = startsWithWorks(playerCount)
        const colors = [...LwColors]
        shuffle(colors, prng.random)
        const players = game.players.map((player, index) => {
            const hydrated = new HydratedLwPlayerState({
                playerId: player.id,
                color: colors[index],
                cash: startingCash(playerCount, setup.startingCash),
                plants: [],
                developed: []
            })
            if (withWorks) {
                hydrated.addPlant(LocomotiveId.Passenger1, 1)
            }
            return hydrated
        })
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        turnManager.seriesKeeps = 'latest'
        const spaces = LOCOMOTIVES.map((locomotive): LocomotiveSpace => ({
            locomotiveId: locomotive.id,
            existingOrders: [],
            customerBase: [],
            cards:
                withWorks && locomotive.id === LocomotiveId.Passenger1
                    ? locomotive.cards - playerCount
                    : locomotive.cards
        }))
        const roll = () => prng.dieRoll(6)
        const [passenger, fast] = spaces
        if (withWorks) {
            passenger.existingOrders = Array.from({ length: OPENING_EXISTING_ORDERS }, roll)
            fast.initialOrder = roll()
        } else {
            passenger.initialOrder = roll()
        }
        const lwState: LwGameState = Object.assign(state, {
            players: turnManager.turnOrder.map((playerId) => {
                const player = players.find((candidate) => candidate.playerId === playerId)
                assertExists(player, `No player ${playerId} in the turn order`)
                return player
            }),
            machineState: MachineState.Developing,
            turnManager,
            roundManager: HydratedRoundManager.generate(),
            phaseManager: HydratedPhaseManager.generate(),
            spaces
        })
        const hydrated = new HydratedLwGameState(lwState)
        hydrated.machineState = startRound(hydrated, 0, setup.buyAndShip)
        return hydrated
    }
}
