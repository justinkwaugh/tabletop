import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Deeds } from '../components/deed.js'
import { Era } from '../definition/eras.js'

export type PlaceCompanyDeedsMetadata = Type.Static<typeof PlaceCompanyDeedsMetadata>
export const PlaceCompanyDeedsMetadata = Type.Object({
})

export type PlaceCompanyDeeds = Type.Static<typeof PlaceCompanyDeeds>
export const PlaceCompanyDeeds = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceCompanyDeeds), // This action is always this type
            metadata: Type.Optional(PlaceCompanyDeedsMetadata) // Always optional, because it is an output
        })
    ])
)

export const PlaceCompanyDeedsValidator = Compile(PlaceCompanyDeeds)

export function isPlaceCompanyDeeds(action?: GameAction): action is PlaceCompanyDeeds {
    return action?.type === ActionType.PlaceCompanyDeeds
}

export class HydratedPlaceCompanyDeeds extends HydratableAction<typeof PlaceCompanyDeeds> implements PlaceCompanyDeeds {
    declare type: ActionType.PlaceCompanyDeeds
    declare playerId?: string
    declare metadata?: PlaceCompanyDeedsMetadata

    constructor(data: PlaceCompanyDeeds) {
        super(data, PlaceCompanyDeedsValidator)
    }

    apply(state: HydratedIndonesiaGameState, context?: MachineContext) {
        if (!this.isValidPlaceCompanyDeeds(state)) {
            throw Error('Invalid PlaceCompanyDeeds action')
        }

        const eraDeeds = Deeds.filter((deed) => deed.era === state.era)
        state.availableDeeds = structuredClone(eraDeeds)
        this.metadata = {}
    }

    isValidPlaceCompanyDeeds(state: HydratedIndonesiaGameState): boolean {
        return HydratedPlaceCompanyDeeds.canPlaceCompanyDeeds(state)
    }

    static canPlaceCompanyDeeds(state: HydratedIndonesiaGameState): boolean {
        if (state.era === Era.A) {
            return false
        }

        const availableDeedIds = new Set(state.availableDeeds.map((deed) => deed.id))
        const hasMissingCurrentEraDeed = Deeds.some(
            (deed) => deed.era === state.era && !availableDeedIds.has(deed.id)
        )
        const hasOutOfEraDeed = state.availableDeeds.some((deed) => deed.era !== state.era)

        return hasMissingCurrentEraDeed || hasOutOfEraDeed
    }
}
