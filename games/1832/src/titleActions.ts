import { StepActionsHandler, type StepAction } from '@tabletop/18xx'
import type { HydratedEighteenThirtyTwoState } from './state.js'

/** A title action offered within a family state, which stays in that state when taken. */
export type TitleStepAction = StepAction<HydratedEighteenThirtyTwoState>

export class TitleActionsHandler extends StepActionsHandler<HydratedEighteenThirtyTwoState> {}
