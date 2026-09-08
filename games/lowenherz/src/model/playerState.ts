import { assertExists, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'
import { PoliticsCard } from '../definition/politicsCards.js'

export type LowenherzPlayerState = Type.Static<typeof LowenherzPlayerState>
export const LowenherzPlayerState = Type.Object({
    ...PlayerState.properties,
    money: Type.Number(),
    powerPoints: Type.Number(),
    knightsInStock: Type.Number(), // starts at 12, minus those placed on the board
    politicsCards: Visibility.protect(Type.Array(PoliticsCard), {
        policy: Visibility.Policy.Owner
    }),
    politicsCardCount: Type.Optional(Type.Number()),
    politicsInspection: Visibility.protect(
        Type.Optional(
            Type.Object({
                pile: Type.Union([Type.Literal('A'), Type.Literal('B')]),
                cards: Type.Array(PoliticsCard)
            })
        ),
        { policy: Visibility.Policy.Owner }
    )
})

export const LowenherzPlayerStateValidator = Compile(LowenherzPlayerState)

export const LowenherzProjectedPlayerState = Visibility.createProjectionSchema(LowenherzPlayerState)
export type LowenherzProjectedPlayerState = Type.Static<typeof LowenherzProjectedPlayerState>
const ProjectedPlayerValidator = Compile(LowenherzProjectedPlayerState)

export class HydratedLowenherzPlayerState
    extends Hydratable<typeof LowenherzProjectedPlayerState>
    implements LowenherzProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare money: number
    declare powerPoints: number
    declare knightsInStock: number
    declare politicsCards?: PoliticsCard[]
    declare politicsCardCount?: number
    declare politicsInspection?: { pile: 'A' | 'B'; cards: PoliticsCard[] }

    getPoliticsCards(): PoliticsCard[] {
        assertExists(this.politicsCards, 'Politics hand is unavailable')
        return this.politicsCards
    }

    syncPoliticsCardCount() {
        this.politicsCardCount = this.getPoliticsCards().length
    }

    constructor(data: LowenherzProjectedPlayerState) {
        super(data, ProjectedPlayerValidator)
        this.politicsCardCount ??= data.politicsCards?.length
    }
}
