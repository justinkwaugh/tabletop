import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { AnyDeed } from '../components/deed.js'
import { ActionType } from '../definition/actions.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { HydratedStartCompany } from './startCompany.js'

export type RemoveCompanyDeedMetadata = Type.Static<typeof RemoveCompanyDeedMetadata>
export const RemoveCompanyDeedMetadata = Type.Object({
    deed: AnyDeed
})

export type RemoveCompanyDeed = Type.Static<typeof RemoveCompanyDeed>
export const RemoveCompanyDeed = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.RemoveCompanyDeed),
            metadata: Type.Optional(RemoveCompanyDeedMetadata),
            deedId: Type.String()
        })
    ])
)

export const RemoveCompanyDeedValidator = Compile(RemoveCompanyDeed)

export function isRemoveCompanyDeed(action?: GameAction): action is RemoveCompanyDeed {
    return action?.type === ActionType.RemoveCompanyDeed
}

export class HydratedRemoveCompanyDeed
    extends HydratableAction<typeof RemoveCompanyDeed>
    implements RemoveCompanyDeed
{
    declare type: ActionType.RemoveCompanyDeed
    declare playerId?: string
    declare metadata?: RemoveCompanyDeedMetadata
    declare deedId: string

    constructor(data: RemoveCompanyDeed) {
        super(data, RemoveCompanyDeedValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidRemoveCompanyDeed(state)) {
            throw Error('Invalid RemoveCompanyDeed action')
        }

        const deed = state.availableDeeds.find((entry) => entry.id === this.deedId)
        if (!deed) {
            throw Error(`Deed with id ${this.deedId} should exist before removal`)
        }

        state.availableDeeds = state.availableDeeds.filter((entry) => entry.id !== this.deedId)

        this.metadata = {
            deed
        }
    }

    isValidRemoveCompanyDeed(state: HydratedIndonesiaGameState): boolean {
        return HydratedRemoveCompanyDeed.canRemoveCompanyDeed(state, this.deedId)
    }

    static canRemoveCompanyDeed(state: HydratedIndonesiaGameState, deedId: string): boolean {
        const deed = state.availableDeeds.find((entry) => entry.id === deedId)
        if (!deed) {
            return false
        }

        return !HydratedStartCompany.canDeedBeStarted(state, deedId)
    }
}
