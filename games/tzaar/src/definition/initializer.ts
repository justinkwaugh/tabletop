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
import { HydratedTzaarGameState, TzaarGameState } from '../model/gameState.js'
import { HydratedTzaarPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import {
    FirstPlayer,
    firstPlayerFromConfig,
    placesPieces,
    TzaarVersion,
    versionFromConfig
} from './config.js'
import { emptyBoard, PIECE_KINDS, PIECES_OF_KIND, type TzaarBoard } from '../model/board.js'
import { SPACES } from '../model/geometry.js'
import { FIXED_START, type StartingPiece } from '../model/startPositions.js'
import { beginPlay, stuckPlayerAtOpening } from '../stateHandlers/turnFlow.js'

export class TzaarGameInitializer
    extends BaseGameInitializer<TzaarGameState, HydratedTzaarGameState>
    implements GameInitializer<TzaarGameState, HydratedTzaarGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedTzaarGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.White })),
            prng.random,
            assignment ?? this.chosenFirstPlayer(game)
        )
        turnManager.seriesKeeps = 'latest'

        const players = turnManager.turnOrder.map(
            (playerId, index) =>
                new HydratedTzaarPlayerState({
                    playerId,
                    color: index === 0 ? Color.White : Color.Black
                })
        )

        const version = versionFromConfig(game.config)
        const tzaarGameState = new HydratedTzaarGameState(
            Object.assign(state, {
                players,
                machineState: MachineState.PlacingPieces,
                turnManager,
                board: this.startingBoard(version, turnManager.turnOrder, prng)
            })
        )

        if (placesPieces(version)) {
            tzaarGameState.turnManager.startTurn(tzaarGameState.turnManager.turnOrder[0], 0)
        } else {
            tzaarGameState.machineState = beginPlay(
                tzaarGameState,
                stuckPlayerAtOpening(tzaarGameState)
            )
        }
        return tzaarGameState
    }

    // The game creator is the player whose user created the game; in a local game every seat
    // belongs to that user, so the first listed seat counts as the creator's. A creator who does
    // not play leaves the first player to the draw.
    private chosenFirstPlayer(game: Game): StartingPositionAssignment | undefined {
        const choice = firstPlayerFromConfig(game.config)
        const creator = game.players.find((player) => player.userId === game.ownerId)
        if (choice === FirstPlayer.Random || creator === undefined) {
            return undefined
        }
        const opponent = game.players.find((player) => player.id !== creator.id)
        assertExists(opponent, 'TZAAR needs two players')
        const first = choice === FirstPlayer.Creator ? creator : opponent
        const second = first === creator ? opponent : creator
        return { playerIds: [first.id, second.id] }
    }

    private startingBoard(version: TzaarVersion, playerIds: string[], prng: Prng): TzaarBoard {
        const [whiteId, blackId] = playerIds
        if (placesPieces(version)) {
            return emptyBoard()
        }
        const pieces = version === TzaarVersion.Fixed ? FIXED_START : this.randomStart(prng)
        return {
            stacks: pieces.map(({ coords, white, kind }, id) => ({
                coords: { ...coords },
                pieces: [{ id, playerId: white ? whiteId : blackId, kind }]
            }))
        }
    }

    // Rule C2: all 60 pieces are spread over the board at random.
    private randomStart(prng: Prng): StartingPiece[] {
        const pieces = [true, false].flatMap((white) =>
            PIECE_KINDS.flatMap((kind) =>
                Array.from({ length: PIECES_OF_KIND[kind] }, () => ({ white, kind }))
            )
        )
        shuffle(pieces, prng.random)
        return SPACES.map((coords, index) => ({ coords: { ...coords }, ...pieces[index] }))
    }
}
