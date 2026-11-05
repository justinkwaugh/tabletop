import {
    type AxialCoordinates,
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
import { HydratedGipfPotentialsGameState, GipfPotentialsGameState } from '../model/gameState.js'
import { HydratedGipfPotentialsPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import {
    potentialsFromConfig,
    VERSION_RULES,
    versionFromConfig,
    WhitePlayer,
    whitePlayerFromConfig
} from './config.js'
import { emptyBoard, HydratedGipfPotentialsBoard } from '../model/board.js'
import { PieceKind } from '../model/pieces.js'

// Standard: three GIPF-pieces each on alternate corners of the play area (as GIPF).
const STARTING_SPOTS: readonly AxialCoordinates[][] = [
    [
        { q: 0, r: 3 },
        { q: -3, r: 0 },
        { q: 3, r: -3 }
    ],
    [
        { q: 0, r: -3 },
        { q: -3, r: 3 },
        { q: 3, r: 0 }
    ]
]

export class GipfPotentialsGameInitializer
    extends BaseGameInitializer<GipfPotentialsGameState, HydratedGipfPotentialsGameState>
    implements GameInitializer<GipfPotentialsGameState, HydratedGipfPotentialsGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedGipfPotentialsGameState {
        const prng = new Prng(state.prng)
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.White })),
            prng.random,
            assignment ?? this.chosenWhite(game)
        )
        turnManager.startTurn(turnManager.turnOrder[0], 0)

        const version = versionFromConfig(game.config)
        const rules = VERSION_RULES[version]
        const potentials = potentialsFromConfig(game.config)
        const board = new HydratedGipfPotentialsBoard(emptyBoard())
        let nextDiscId = 0
        const players = turnManager.turnOrder.map((playerId, index) => {
            const startingSpots = rules.startsWithGipfPieces ? STARTING_SPOTS[index] : []
            for (const coords of startingSpots) {
                board.place(coords, {
                    playerId,
                    kind: PieceKind.Gipf,
                    discIds: [nextDiscId++, nextDiscId++]
                })
            }
            return new HydratedGipfPotentialsPlayerState({
                playerId,
                color: index === 0 ? Color.White : Color.Black,
                reserve: rules.pieces - 2 * startingSpots.length,
                potentials: { ...potentials },
                captured: [],
                playedOther: false
            })
        })

        const gipfPotentialsGameState: GipfPotentialsGameState = Object.assign(state, {
            players,
            machineState: MachineState.TakingTurn,
            turnManager,
            version,
            board: board.dehydrate(),
            movedThisTurn: false,
            resolvingPlayerIds: [],
            extraMoveOwedIds: [],
            nextDiscId
        })

        return new HydratedGipfPotentialsGameState(gipfPotentialsGameState)
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
        assertExists(opponent, 'GIPF with Potentials needs two players')
        const white = choice === WhitePlayer.Creator ? creator : opponent
        const black = white === creator ? opponent : creator
        return { playerIds: [white.id, black.id] }
    }
}
