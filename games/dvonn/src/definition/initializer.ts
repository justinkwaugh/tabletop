import {
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState,
    assertExists,
    BaseGameInitializer,
    Color,
    Game,
    HydratedTurnManager,
    Prng,
    shuffle
} from '@tabletop/common'
import { HydratedDvonnGameState, DvonnGameState, DVONN_PIECES } from '../model/gameState.js'
import { HydratedDvonnPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { DvonnVersion, versionFromConfig, WhitePlayer, whitePlayerFromConfig } from './config.js'
import { emptyBoard, type DvonnBoard, type Piece } from '../model/board.js'
import { SPACES } from '../model/geometry.js'
import { beginMovingStacks } from '../stateHandlers/movingStacks.js'

export class DvonnGameInitializer
    extends BaseGameInitializer<DvonnGameState, HydratedDvonnGameState>
    implements GameInitializer<DvonnGameState, HydratedDvonnGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedDvonnGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.White })),
            prng.random,
            assignment ?? this.chosenWhite(game)
        )

        const players = turnManager.turnOrder.map(
            (playerId, index) =>
                new HydratedDvonnPlayerState({
                    playerId,
                    color: index === 0 ? Color.White : Color.Black
                })
        )

        const version = versionFromConfig(game.config)
        const dvonnGameState = new HydratedDvonnGameState(
            Object.assign(state, {
                players,
                machineState: MachineState.PlacingPieces,
                turnManager,
                version,
                board:
                    version === DvonnVersion.RandomPlacement
                        ? this.randomBoard(turnManager.turnOrder, prng)
                        : emptyBoard()
            })
        )

        if (version === DvonnVersion.RandomPlacement) {
            dvonnGameState.machineState = beginMovingStacks(dvonnGameState)
        } else {
            dvonnGameState.turnManager.startTurn(dvonnGameState.turnManager.turnOrder[0], 0)
        }
        return dvonnGameState
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
        assertExists(opponent, 'DVONN needs two players')
        const white = choice === WhitePlayer.Creator ? creator : opponent
        const black = white === creator ? opponent : creator
        return { playerIds: [white.id, black.id] }
    }

    private randomBoard(playerIds: string[], prng: Prng): DvonnBoard {
        const owners: (string | undefined)[] = [
            ...Array.from({ length: DVONN_PIECES }, () => undefined),
            ...playerIds.flatMap((playerId) =>
                Array.from({ length: (SPACES.length - DVONN_PIECES) / 2 }, () => playerId)
            )
        ]
        shuffle(owners, prng.random)
        const board = emptyBoard()
        board.spaces.forEach((space, index) => {
            const placedAt = { ...space.coords }
            const playerId = owners[index]
            const piece: Piece =
                playerId === undefined ? { dvonn: true, placedAt } : { playerId, placedAt }
            space.stack = [piece]
        })
        return board
    }
}
