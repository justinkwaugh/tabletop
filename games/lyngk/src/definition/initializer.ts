import {
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState,
    BaseGameInitializer,
    Game,
    HydratedTurnManager,
    Prng,
    shuffle
} from '@tabletop/common'
import { HydratedLyngkGameState, LyngkGameState } from '../model/gameState.js'
import { HydratedLyngkPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { variantFromConfig } from './config.js'
import { LyngkColors } from './colors.js'
import { emptyBoard } from '../model/board.js'
import {
    ACTIVE_COLORS,
    JOKER_COUNT,
    PieceColor,
    PIECES_PER_COLOR_ON_BOARD
} from '../model/pieces.js'

export function shuffledPieces(random: () => number): PieceColor[] {
    const pieces = [
        ...ACTIVE_COLORS.flatMap((color) =>
            Array.from({ length: PIECES_PER_COLOR_ON_BOARD }, () => color)
        ),
        ...Array.from({ length: JOKER_COUNT }, () => PieceColor.Joker)
    ]
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
            assignment
        )
        turnManager.startTurn(turnManager.turnOrder[0], 0)

        const board = emptyBoard()
        const pieces = shuffledPieces(prng.random)
        board.points.forEach((point, index) => {
            point.stack = [pieces[index]]
            point.ids = [index]
        })

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
            machineState: MachineState.TakingTurn,
            turnManager,
            variant: variantFromConfig(game.config),
            board,
            claimedThisTurn: false
        })

        return new HydratedLyngkGameState(lyngkGameState)
    }
}
