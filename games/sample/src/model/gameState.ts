import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { SamplePlayerState, HydratedSamplePlayerState } from './playerState.js'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'

// Define the shape of the SampleGameState by extending the common GameState
// We use TypeBox to define the schema, and Static to extract the TypeScript type from the schema
export type SampleGameState = Static<typeof SampleGameState>
export const SampleGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(SamplePlayerState), // Redefine with the specific player state type
            machineState: Type.Enum(MachineState), // Redefine with the specific machine states
            total: Type.Number(), // Some game-specific property
            maxTotal: Type.Number() // Another game-specific property
        })
    ])
)

// Validator to validate the raw game state data before hydration
const SampleGameStateValidator = Compile(SampleGameState)

export class HydratedSampleGameState
    extends HydratableGameState<typeof SampleGameState, HydratedSamplePlayerState>
    implements SampleGameState
{
    // Declare properties to satisfy the interface, they will be populated by the base class
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedSamplePlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare total: number
    declare maxTotal: number

    constructor(data: SampleGameState) {
        super(data, SampleGameStateValidator)

        // We need to hydrate the players because there is no way for the base class to know what needs
        // to be hydrated and which classes to use
        this.players = data.players.map((player) => new HydratedSamplePlayerState(player))
    }

    // This is a useful place to put methods to calculate and manipulate state for the game
    calculateLeadingPlayerIds(): string[] {
        const highestScore = Math.max(...this.players.map((p) => p.score))
        const winners = this.players.filter((p) => p.score === highestScore)
        return winners.map((p) => p.playerId)
    }

    // Add to total
    addToTotal(amount: number) {
        if (!this.canAddToTotal(amount)) {
            throw Error('Invalid amount to add to total')
        }
        this.total += amount
    }

    // Check if we can add some amount to total
    canAddToTotal(amount: number): boolean {
        return amount > 0 && amount + this.total <= this.maxTotal
    }
}
