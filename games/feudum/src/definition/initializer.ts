import {
    BaseGameInitializer,
    HydratedPhaseManager,
    HydratedRoundManager,
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
import { boxContents } from '../model/boxContents.js'
import {
    emptyPlayerRow,
    HydratedFeudumPlayerState,
    type FeudumPlayerState
} from '../model/playerState.js'
import { FeudumColors } from './colors.js'
import { PhaseName } from './phases.js'
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

        const roundManager = HydratedRoundManager.generate()
        const phaseManager = HydratedPhaseManager.generate()
        phaseManager.startPhase(PhaseName.Setup, state.actionCount)

        const feudumGameState: FeudumGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.StartOfTurn,
            turnManager,
            roundManager,
            phaseManager,
            feudumRevision: CURRENT_FEUDUM_REVISION,
            ...boxContents(orderedPlayers)
        })

        return new HydratedFeudumGameState(feudumGameState)
    }

    private initializePlayers(game: Game, prng: Prng): FeudumPlayerState[] {
        const colors = [...FeudumColors]
        shuffle(colors, prng.random)

        return game.players.map(
            (player: Player, index: number) =>
                new HydratedFeudumPlayerState(emptyPlayerRow(player.id, colors[index]))
        )
    }
}
