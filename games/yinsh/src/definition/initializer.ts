import {
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState,
    BaseGameInitializer,
    Color,
    Game,
    HydratedTurnManager,
    Prng
} from '@tabletop/common'
import { HydratedYinshGameState, YinshGameState } from '../model/gameState.js'
import { HydratedYinshPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { versionFromConfig } from './config.js'
import { emptyBoard } from '../model/board.js'

export class YinshGameInitializer
    extends BaseGameInitializer<YinshGameState, HydratedYinshGameState>
    implements GameInitializer<YinshGameState, HydratedYinshGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedYinshGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.White })),
            prng.random,
            assignment
        )
        turnManager.startTurn(turnManager.turnOrder[0], 0)

        // Rule C2: the starting player plays White.
        const players = turnManager.turnOrder.map(
            (playerId, index) =>
                new HydratedYinshPlayerState({
                    playerId,
                    color: index === 0 ? Color.White : Color.Black,
                    ringsRemoved: 0
                })
        )

        const yinshGameState: YinshGameState = Object.assign(state, {
            players,
            machineState: MachineState.PlacingRings,
            turnManager,
            version: versionFromConfig(game.config),
            board: emptyBoard(),
            resolvingPlayerIds: []
        })

        return new HydratedYinshGameState(yinshGameState)
    }
}
