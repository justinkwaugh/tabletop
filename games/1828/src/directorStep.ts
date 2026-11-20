import type { HydratedAction } from '@tabletop/common'
import { controllingOwner, nextOperatingCompany, stepAction, type StepAction } from '@tabletop/18xx'
import type { HydratedState1828 } from './state.js'

export function directorStepAction<Action extends HydratedAction>(
    type: string,
    hydrated: (
        action: HydratedAction
    ) => action is Action & { isValid(state: HydratedState1828): boolean },
    open: (state: HydratedState1828, companyId: string) => boolean
): StepAction<HydratedState1828> {
    return stepAction<HydratedState1828, Action>(type, hydrated, (state, playerId) => {
        const companyId = nextOperatingCompany(state)
        return (
            !!companyId &&
            controllingOwner(state, companyId)?.playerId === playerId &&
            open(state, companyId)
        )
    })
}
