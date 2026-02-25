import { assert, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'
import { CityCard } from '../components/cards.js'
import { Era } from '../definition/eras.js'

export type IndonesiaPlayerState = Type.Static<typeof IndonesiaPlayerState>
export const IndonesiaPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            research: Type.Object({
                bid: Type.Number(),
                slots: Type.Number(),
                mergers: Type.Number(),
                expansion: Type.Number(),
                hull: Type.Number()
            }),
            bank: Type.Number(),
            cash: Type.Number(),
            cityCards: Type.Record(Type.Enum(Era), Type.Array(CityCard)),
            ownedCompanies: Type.Array(Type.String())
        })
    ])
)

export const IndonesiaPlayerStateValidator = Compile(IndonesiaPlayerState)

export class HydratedIndonesiaPlayerState
    extends Hydratable<typeof IndonesiaPlayerState>
    implements IndonesiaPlayerState
{
    declare playerId: string
    declare color: Color
    declare research: {
        bid: number
        slots: number
        mergers: number
        expansion: number
        hull: number
    }
    declare bank: number
    declare cash: number
    declare cityCards: Record<Era, CityCard[]>
    declare ownedCompanies: string[]

    constructor(data: IndonesiaPlayerState) {
        super(data, IndonesiaPlayerStateValidator)
    }

    nextCityCardForEra(era: Era, currentCard?: CityCard): CityCard {
        const cards = this.cityCards[era]
        assert(cards.length > 0, `Player ${this.playerId} has no city cards for era ${era}`)
        if (currentCard?.id !== cards[0].id) {
            return cards[0]
        }

        assert(cards.length > 1, `Player ${this.playerId} has no more city cards for era ${era}`)
        return cards[1]
    }
}
