import { Hydratable, PlayerState } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'

// Here we define the shape of the player state for the Sample game by extending the common PlayerState
// We use TypeBox to define the schema, and Static to extract the TypeScript type from the schema
export type SamplePlayerState = Static<typeof SamplePlayerState>
export const SamplePlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            score: Type.Number(), // Player's score
            amount: Type.Number() // Some player-specific property
        })
    ])
)

// Validator to validate the raw player state data before hydration
export const SamplePlayerStateValidator = Compile(SamplePlayerState)

export class HydratedSamplePlayerState
    extends Hydratable<typeof SamplePlayerState>
    implements SamplePlayerState
{
    // Declare properties to satisfy the interface, they will be populated by the base class
    declare playerId: string
    declare color: Color
    declare score: number
    declare amount: number

    constructor(data: SamplePlayerState) {
        super(data, SamplePlayerStateValidator)
    }

    // This is a useful place to put methods to calculate and manipulate state for the player
    spendAmount(amountToSpend: number) {
        if (amountToSpend > this.amount) {
            throw Error('Not enough amount to spend')
        }
        this.amount -= amountToSpend
    }

    addAmount(amountToAdd: number) {
        this.amount += amountToAdd
    }
}
