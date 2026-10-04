import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { Faction } from '../components/factions.js'
import { TechField } from '../components/techFields.js'
import { TechId } from '../components/techs.js'
import { TurnStep } from './turn.js'

export type TechMarkers = Type.Static<typeof TechMarkers>
export const TechMarkers = Type.Object({
    [TechField.Biology]: Type.Array(Type.Number()),
    [TechField.Physics]: Type.Array(Type.Number()),
    [TechField.Engineering]: Type.Array(Type.Number())
})

export type OwnedTech = Type.Static<typeof OwnedTech>
export const OwnedTech = Type.Object({
    techId: Type.Enum(TechId),
    year: Type.Number()
})

export type StellarHorizonsPlayerState = Type.Static<typeof StellarHorizonsPlayerState>
export const StellarHorizonsPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            faction: Type.Optional(Type.Enum(Faction)),
            cash: Type.Number(),
            techMarkers: TechMarkers,
            techs: Type.Array(OwnedTech),
            step: Type.Enum(TurnStep),
            remoteRepairUsed: Type.Boolean(),
            fieldsDeveloped: Type.Array(Type.Enum(TechField))
        })
    ])
)

export const StellarHorizonsPlayerStateValidator = Compile(StellarHorizonsPlayerState)

export class HydratedStellarHorizonsPlayerState
    extends Hydratable<typeof StellarHorizonsPlayerState>
    implements StellarHorizonsPlayerState
{
    declare playerId: string
    declare color: Color
    declare faction?: Faction
    declare cash: number
    declare techMarkers: TechMarkers
    declare techs: OwnedTech[]
    declare step: TurnStep
    declare remoteRepairUsed: boolean
    declare fieldsDeveloped: TechField[]

    constructor(data: StellarHorizonsPlayerState) {
        super(data, StellarHorizonsPlayerStateValidator)
    }

    ownsTech(techId: TechId): boolean {
        return this.techs.some((owned) => owned.techId === techId)
    }

    ownedTechIds(): TechId[] {
        return this.techs.map((owned) => owned.techId)
    }

    ownedBefore(techId: TechId, year: number): boolean {
        return this.techs.some((owned) => owned.techId === techId && owned.year < year)
    }

    markerTotal(field: TechField): number {
        return this.techMarkers[field].reduce((total, value) => total + value, 0)
    }
}
