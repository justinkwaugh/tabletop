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
import { GIPF_PIECES, HydratedMatrxGameState, MatrxGameState } from '../model/gameState.js'
import { HydratedMatrxPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { boardShapeFromConfig, WhitePlayer, whitePlayerFromConfig } from './config.js'
import { emptyBoard } from '../model/board.js'

// Rule B: each player has 3 GIPF pieces and 6 potentials of each kind, all in reserve.
const POTENTIALS_OF_KIND = 6

export class MatrxGameInitializer
    extends BaseGameInitializer<MatrxGameState, HydratedMatrxGameState>
    implements GameInitializer<MatrxGameState, HydratedMatrxGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedMatrxGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.White })),
            prng.random,
            assignment ?? this.chosenWhite(game)
        )
        turnManager.startTurn(turnManager.turnOrder[0], 0)

        const players = turnManager.turnOrder.map(
            (playerId, index) =>
                new HydratedMatrxPlayerState({
                    playerId,
                    color: index === 0 ? Color.White : Color.Black,
                    gipfPieces: GIPF_PIECES,
                    potentials: {
                        tamsk: POTENTIALS_OF_KIND,
                        zertz: POTENTIALS_OF_KIND,
                        dvonn: POTENTIALS_OF_KIND,
                        yinsh: POTENTIALS_OF_KIND,
                        punct: POTENTIALS_OF_KIND
                    },
                    captured: 0
                })
        )

        const matrxGameState: MatrxGameState = Object.assign(state, {
            players,
            machineState: MachineState.TakingTurn,
            turnManager,
            board: emptyBoard(boardShapeFromConfig(game.config)),
            movedThisTurn: false,
            resolvingPlayerIds: [],
            extraMoveOwedIds: [],
            nextDiscId: 0
        })

        return new HydratedMatrxGameState(matrxGameState)
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
        assertExists(opponent, 'MATRX GIPF needs two players')
        const white = choice === WhitePlayer.Creator ? creator : opponent
        const black = white === creator ? opponent : creator
        return { playerIds: [white.id, black.id] }
    }
}
