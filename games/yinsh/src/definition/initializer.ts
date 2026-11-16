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
import { HydratedYinshGameState, YinshGameState } from '../model/gameState.js'
import { HydratedYinshPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { versionFromConfig, WhitePlayer, whitePlayerFromConfig } from './config.js'
import { emptyBoard } from '../model/board.js'

export class YinshGameInitializer
    extends BaseGameInitializer<YinshGameState, HydratedYinshGameState>
    implements GameInitializer<YinshGameState, HydratedYinshGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedYinshGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.White })),
            prng.random,
            assignment ?? this.chosenWhite(game)
        )
        turnManager.seriesKeeps = 'latest'
        turnManager.startTurn(turnManager.turnOrder[0], 0)

        // Rule C2: the starting player plays White.
        const players = turnManager.turnOrder.map(
            (playerId, index) =>
                new HydratedYinshPlayerState({
                    playerId,
                    color: index === 0 ? Color.White : Color.Black,
                    removedRingIds: []
                })
        )

        const yinshGameState: YinshGameState = Object.assign(state, {
            players,
            machineState: MachineState.PlacingRings,
            turnManager,
            version: versionFromConfig(game.config),
            board: emptyBoard(),
            resolvingPlayerIds: []
        })

        return new HydratedYinshGameState(yinshGameState)
    }

    // In a local game every seat is the creator's user's, so the first seat counts as theirs. A
    // creator who does not play leaves White to the draw.
    private chosenWhite(game: Game): StartingPositionAssignment | undefined {
        const choice = whitePlayerFromConfig(game.config)
        const creator = game.players.find((player) => player.userId === game.ownerId)
        if (choice === WhitePlayer.Random || creator === undefined) {
            return undefined
        }
        const opponent = game.players.find((player) => player.id !== creator.id)
        assertExists(opponent, 'YINSH needs two players')
        const white = choice === WhitePlayer.Creator ? creator : opponent
        const black = white === creator ? opponent : creator
        return { playerIds: [white.id, black.id] }
    }
}
