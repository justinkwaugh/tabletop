import {
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState,
    assertExists,
    BaseGameInitializer,
    Game,
    HydratedTurnManager,
    Prng,
    shuffle
} from '@tabletop/common'
import { HydratedLyngkGameState, LyngkGameState } from '../model/gameState.js'
import { HydratedLyngkPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import {
    FirstPlayer,
    firstPlayerFromConfig,
    LyngkSetup,
    setupFromConfig,
    variantFromConfig
} from './config.js'
import { LyngkColors } from './colors.js'
import { emptyBoard, type LyngkBoard } from '../model/board.js'
import { POINTS } from '../model/geometry.js'
import {
    ACTIVE_COLORS,
    JOKER_COUNT,
    PieceColor,
    PIECES_PER_COLOR_ON_BOARD
} from '../model/pieces.js'

// Every piece, numbered color by color and the jokers last (FIRST_JOKER_ID), in a random order.
export function shuffledPieces(random: () => number): { color: PieceColor; id: number }[] {
    const pieces = [
        ...ACTIVE_COLORS.flatMap((color) =>
            Array.from({ length: PIECES_PER_COLOR_ON_BOARD }, () => color)
        ),
        ...Array.from({ length: JOKER_COUNT }, () => PieceColor.Joker)
    ].map((color, id) => ({ color, id }))
    shuffle(pieces, random)
    return pieces
}

export class LyngkGameInitializer
    extends BaseGameInitializer<LyngkGameState, HydratedLyngkGameState>
    implements GameInitializer<LyngkGameState, HydratedLyngkGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedLyngkGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player, index) => ({
                playerId: player.id,
                color: LyngkColors[index % LyngkColors.length]
            })),
            prng.random,
            assignment ?? this.chosenFirstPlayer(game)
        )
        turnManager.seriesKeeps = 'latest'
        turnManager.startTurn(turnManager.turnOrder[0], 0)

        const dealt = setupFromConfig(game.config) === LyngkSetup.Random
        const board = dealt ? this.dealtBoard(prng) : emptyBoard()

        const players = turnManager.turnOrder.map(
            (playerId, index) =>
                new HydratedLyngkPlayerState({
                    playerId,
                    color: LyngkColors[index],
                    claimed: [],
                    scored: []
                })
        )

        const lyngkGameState: LyngkGameState = Object.assign(state, {
            players,
            machineState: dealt ? MachineState.TakingTurn : MachineState.PlacingPieces,
            turnManager,
            variant: variantFromConfig(game.config),
            board,
            claimedThisTurn: false
        })

        return new HydratedLyngkGameState(lyngkGameState)
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
        assertExists(opponent, 'LYNGK needs two players')
        const first = choice === FirstPlayer.Creator ? creator : opponent
        const second = first === creator ? opponent : creator
        return { playerIds: [first.id, second.id] }
    }

    // One piece on every point, dealt at random.
    private dealtBoard(prng: Prng): LyngkBoard {
        const pieces = shuffledPieces(prng.random)
        return {
            stacks: POINTS.map((coords, index) => ({
                coords: { ...coords },
                pieces: [pieces[index].id]
            }))
        }
    }
}
