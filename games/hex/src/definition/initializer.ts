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
import { HydratedHexGameState, HexGameState } from '../model/gameState.js'
import { HydratedHexPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { RedPlayer, redPlayerFromConfig, boardSizeFromConfig } from './config.js'
import { emptyBoard } from '../model/board.js'

export class HexGameInitializer
    extends BaseGameInitializer<HexGameState, HydratedHexGameState>
    implements GameInitializer<HexGameState, HydratedHexGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedHexGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.Red })),
            prng.random,
            assignment ?? this.chosenRed(game)
        )
        turnManager.seriesKeeps = 'latest'

        const players = turnManager.turnOrder.map(
            (playerId, index) =>
                new HydratedHexPlayerState({
                    playerId,
                    color: index === 0 ? Color.Red : Color.Blue
                })
        )

        const hexGameState = new HydratedHexGameState(
            Object.assign(state, {
                players,
                machineState: MachineState.PlacingStones,
                turnManager,
                board: emptyBoard(boardSizeFromConfig(game.config)),
                swapped: false
            })
        )
        hexGameState.turnManager.startTurn(hexGameState.turnManager.turnOrder[0], 0)
        return hexGameState
    }

    // In a local game every seat belongs to the creator's user, so the first listed seat counts
    // as the creator's. A creator who does not play leaves Red to the draw.
    private chosenRed(game: Game): StartingPositionAssignment | undefined {
        const choice = redPlayerFromConfig(game.config)
        const creator = game.players.find((player) => player.userId === game.ownerId)
        if (choice === RedPlayer.Random || creator === undefined) {
            return undefined
        }
        const opponent = game.players.find((player) => player.id !== creator.id)
        assertExists(opponent, 'Hex needs two players')
        const red = choice === RedPlayer.Creator ? creator : opponent
        const blue = red === creator ? opponent : creator
        return { playerIds: [red.id, blue.id] }
    }
}
