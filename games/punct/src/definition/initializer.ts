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
import { HydratedPunctGameState, PunctGameState } from '../model/gameState.js'
import { HydratedPunctPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { variantFromConfig, WhitePlayer, whitePlayerFromConfig } from './config.js'
import { emptyBoard } from '../model/board.js'

export class PunctGameInitializer
    extends BaseGameInitializer<PunctGameState, HydratedPunctGameState>
    implements GameInitializer<PunctGameState, HydratedPunctGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedPunctGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.White })),
            prng.random,
            assignment ?? this.chosenWhite(game)
        )
        turnManager.seriesKeeps = 'latest'
        turnManager.startTurn(turnManager.turnOrder[0], 0)

        const players = turnManager.turnOrder.map(
            (playerId, index) =>
                new HydratedPunctPlayerState({
                    playerId,
                    color: index === 0 ? Color.White : Color.Black
                })
        )

        const punctGameState: PunctGameState = Object.assign(state, {
            players,
            machineState: MachineState.TakingTurn,
            turnManager,
            variant: variantFromConfig(game.config),
            board: emptyBoard()
        })

        return new HydratedPunctGameState(punctGameState)
    }

    // The game creator is the player whose user created the game; in a local game every seat
    // belongs to that user, so the first listed seat counts as the creator's. A creator who does
    // not play leaves White to the draw.
    private chosenWhite(game: Game): StartingPositionAssignment | undefined {
        const choice = whitePlayerFromConfig(game.config)
        const creator = game.players.find((player) => player.userId === game.ownerId)
        if (choice === WhitePlayer.Random || creator === undefined) {
            return undefined
        }
        const opponent = game.players.find((player) => player.id !== creator.id)
        assertExists(opponent, 'PÜNCT needs two players')
        const white = choice === WhitePlayer.Creator ? creator : opponent
        const black = white === creator ? opponent : creator
        return { playerIds: [white.id, black.id] }
    }
}
