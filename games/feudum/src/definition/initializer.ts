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
    CURRENT_FEUDUM_REVISION,
    HydratedFeudumGameState,
    type FeudumGameState
} from '../model/gameState.js'
import { HydratedFeudumPlayerState, type FeudumPlayerState } from '../model/playerState.js'
import { FeudumColors } from './colors.js'
import { MachineState } from './states.js'

export class FeudumGameInitializer
    extends BaseGameInitializer<FeudumGameState, HydratedFeudumGameState>
    implements GameInitializer<FeudumGameState, HydratedFeudumGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedFeudumGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const orderedPlayers = turnManager.turnOrder
            .map((playerId) => players.find((player) => player.playerId === playerId))
            .filter((player): player is FeudumPlayerState => player !== undefined)

        const feudumGameState: FeudumGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.StartOfTurn,
            turnManager,
            feudumRevision: CURRENT_FEUDUM_REVISION
        })

        return new HydratedFeudumGameState(feudumGameState)
    }

    private initializePlayers(game: Game, prng: Prng): FeudumPlayerState[] {
        const colors = [...FeudumColors]
        shuffle(colors, prng.random)

        return game.players.map(
            (player: Player, index: number) =>
                new HydratedFeudumPlayerState({
                    playerId: player.id,
                    color: colors[index]
                })
        )
    }
}
