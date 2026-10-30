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
    sameCoordinates,
    shuffle
} from '@tabletop/common'
import { HydratedTzaarGameState, TzaarGameState } from '../model/gameState.js'
import { HydratedTzaarPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { TzaarVersion, versionFromConfig, WhitePlayer, whitePlayerFromConfig } from './config.js'
import { emptyBoard, PIECE_KINDS, PIECES_OF_KIND, type TzaarBoard } from '../model/board.js'
import { SPACES } from '../model/geometry.js'
import { FIXED_START, type StartingPiece } from '../model/startPositions.js'
import { beginPlay } from '../stateHandlers/turnFlow.js'

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
            assignment ?? this.chosenWhite(game)
        )

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
                version,
                board: this.startingBoard(version, turnManager.turnOrder, prng)
            })
        )

        if (version === TzaarVersion.Tournament) {
            tzaarGameState.turnManager.startTurn(tzaarGameState.turnManager.turnOrder[0], 0)
        } else {
            tzaarGameState.machineState = beginPlay(tzaarGameState)
        }
        return tzaarGameState
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
        assertExists(opponent, 'TZAAR needs two players')
        const white = choice === WhitePlayer.Creator ? creator : opponent
        const black = white === creator ? opponent : creator
        return { playerIds: [white.id, black.id] }
    }

    private startingBoard(version: TzaarVersion, playerIds: string[], prng: Prng): TzaarBoard {
        const [whiteId, blackId] = playerIds
        const board = emptyBoard()
        if (version === TzaarVersion.Tournament) {
            return board
        }
        const pieces = version === TzaarVersion.Fixed ? FIXED_START : this.randomStart(prng)
        pieces.forEach(({ coords, white, kind }, id) => {
            const space = board.spaces.find((candidate) =>
                sameCoordinates(candidate.coords, coords)
            )
            assertExists(space, `No space at ${coords.q},${coords.r}`)
            space.stack = [{ id, playerId: white ? whiteId : blackId, kind }]
        })
        return board
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
