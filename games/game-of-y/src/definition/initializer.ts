import {
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState,
    assertExists,
    BaseGameInitializer,
    Color,
    Game,
    HydratedTurnManager,
    Prng
} from '@tabletop/common'
import { HydratedYGameState, YGameState } from '../model/gameState.js'
import { HydratedYPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { BlackPlayer, blackPlayerFromConfig } from './config.js'
import { emptyBoard } from '../model/board.js'

export class YGameInitializer
    extends BaseGameInitializer<YGameState, HydratedYGameState>
    implements GameInitializer<YGameState, HydratedYGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedYGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.Black })),
            prng.random,
            assignment ?? this.chosenBlack(game)
        )
        turnManager.seriesKeeps = 'latest'

        const players = turnManager.turnOrder.map(
            (playerId, index) =>
                new HydratedYPlayerState({
                    playerId,
                    color: index === 0 ? Color.Black : Color.White
                })
        )

        const yGameState = new HydratedYGameState(
            Object.assign(state, {
                players,
                machineState: MachineState.PlacingStones,
                turnManager,
                board: emptyBoard(),
                swapped: false
            })
        )
        yGameState.turnManager.startTurn(yGameState.turnManager.turnOrder[0], 0)
        return yGameState
    }

    // In a local game every seat belongs to the creator's user, so the first listed seat counts
    // as the creator's. A creator who does not play leaves Black to the draw.
    private chosenBlack(game: Game): StartingPositionAssignment | undefined {
        const choice = blackPlayerFromConfig(game.config)
        const creator = game.players.find((player) => player.userId === game.ownerId)
        if (choice === BlackPlayer.Random || creator === undefined) {
            return undefined
        }
        const opponent = game.players.find((player) => player.id !== creator.id)
        assertExists(opponent, 'The Game of Y needs two players')
        const black = choice === BlackPlayer.Creator ? creator : opponent
        const white = black === creator ? opponent : creator
        return { playerIds: [black.id, white.id] }
    }
}
