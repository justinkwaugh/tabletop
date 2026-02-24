import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type StartCompanyMetadata = Type.Static<typeof StartCompanyMetadata>
export const StartCompanyMetadata = Type.Object({
})

export type StartCompany = Type.Static<typeof StartCompany>
export const StartCompany = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.StartCompany), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(StartCompanyMetadata) // Always optional, because it is an output
        })
    ])
)

export const StartCompanyValidator = Compile(StartCompany)

export function isStartCompany(action?: GameAction): action is StartCompany {
    return action?.type === ActionType.StartCompany
}

export class HydratedStartCompany extends HydratableAction<typeof StartCompany> implements StartCompany {
    declare type: ActionType.StartCompany
    declare playerId: string
    declare metadata?: StartCompanyMetadata

    constructor(data: StartCompany) {
        super(data, StartCompanyValidator)
    }

    apply(state: HydratedIndonesiaGameState, context?: MachineContext) {
        if (!this.isValidStartCompany(state)) {
            throw Error('Invalid StartCompany action')
        }

        this.metadata = {}
    }

    isValidStartCompany(state: HydratedIndonesiaGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        return true
    }

    static canStartCompany(state: HydratedIndonesiaGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return true
    }
}
