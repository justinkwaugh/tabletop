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
import { DvonnVersion, versionFromConfig, FirstPlayer, firstPlayerFromConfig } from './config.js'
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
            assignment ?? this.chosenFirstPlayer(game)
        )
        turnManager.seriesKeeps = 'latest'

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
    // not play leaves the first player to the draw.
    private chosenFirstPlayer(game: Game): StartingPositionAssignment | undefined {
        const choice = firstPlayerFromConfig(game.config)
        const creator = game.players.find((player) => player.userId === game.ownerId)
        if (choice === FirstPlayer.Random || creator === undefined) {
            return undefined
        }
        const opponent = game.players.find((player) => player.id !== creator.id)
        assertExists(opponent, 'DVONN needs two players')
        const first = choice === FirstPlayer.Creator ? creator : opponent
        const second = first === creator ? opponent : creator
        return { playerIds: [first.id, second.id] }
    }

    private randomBoard(playerIds: string[], prng: Prng): DvonnBoard {
        const owners: (string | undefined)[] = [
            ...Array.from({ length: DVONN_PIECES }, () => undefined),
            ...playerIds.flatMap((playerId) =>
                Array.from({ length: (SPACES.length - DVONN_PIECES) / 2 }, () => playerId)
            )
        ]
        shuffle(owners, prng.random)
        return {
            stacks: SPACES.map((coords, index) => {
                const placedAt = { ...coords }
                const playerId = owners[index]
                const piece: Piece =
                    playerId === undefined ? { dvonn: true, placedAt } : { playerId, placedAt }
                return { coords: { ...coords }, pieces: [piece] }
            })
        }
    }
}
