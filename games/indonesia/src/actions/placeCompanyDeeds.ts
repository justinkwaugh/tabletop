import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type PlaceCompanyDeedsMetadata = Type.Static<typeof PlaceCompanyDeedsMetadata>
export const PlaceCompanyDeedsMetadata = Type.Object({
})

export type PlaceCompanyDeeds = Type.Static<typeof PlaceCompanyDeeds>
export const PlaceCompanyDeeds = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlaceCompanyDeeds), // This action is always this type
            playerId: Type.String(), // Required now
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
    declare playerId: string
    declare metadata?: PlaceCompanyDeedsMetadata

    constructor(data: PlaceCompanyDeeds) {
        super(data, PlaceCompanyDeedsValidator)
    }

    apply(state: HydratedIndonesiaGameState, context?: MachineContext) {
        if (!this.isValidPlaceCompanyDeeds(state)) {
            throw Error('Invalid PlaceCompanyDeeds action')
        }

        this.metadata = {}
    }

    isValidPlaceCompanyDeeds(state: HydratedIndonesiaGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        return true
    }

    static canPlaceCompanyDeeds(state: HydratedIndonesiaGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return true
    }
}
