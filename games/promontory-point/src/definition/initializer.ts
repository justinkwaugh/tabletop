import {
    BaseGameInitializer,
    HydratedTurnManager,
    Prng,
    shuffle,
    type Game,
    type GameInitializer,
    type Player,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import {
    CURRENT_PROMONTORY_POINT_REVISION,
    HydratedPromontoryPointGameState,
    type PromontoryPointGameState
} from '../model/gameState.js'
import {
    HydratedPromontoryPointPlayerState,
    type PromontoryPointPlayerState
} from '../model/playerState.js'
import { PromontoryPointColors } from './colors.js'
import { MachineState } from './states.js'

export class PromontoryPointGameInitializer
    extends BaseGameInitializer<PromontoryPointGameState, HydratedPromontoryPointGameState>
    implements GameInitializer<PromontoryPointGameState, HydratedPromontoryPointGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedPromontoryPointGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const orderedPlayers = turnManager.turnOrder
            .map((playerId) => players.find((player) => player.playerId === playerId))
            .filter((player): player is PromontoryPointPlayerState => player !== undefined)

        const promontoryPointGameState: PromontoryPointGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.StartingTurn,
            turnManager,
            promontoryPointRevision: CURRENT_PROMONTORY_POINT_REVISION
        })

        return new HydratedPromontoryPointGameState(promontoryPointGameState)
    }

    private initializePlayers(game: Game, prng: Prng): PromontoryPointPlayerState[] {
        const colors = [...PromontoryPointColors]
        shuffle(colors, prng.random)

        return game.players.map(
            (player: Player, index: number) =>
                new HydratedPromontoryPointPlayerState({
                    playerId: player.id,
                    color: colors[index]
                })
        )
    }
}
