import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedGameState
} from '@tabletop/common'
import {
    RunInstructionStopReason,
    declaredRunInstructionFor,
    removeRunInstruction,
    type RunInstructionState
} from './instructedRuns.js'

const Fields = Type.Object({
    type: Type.Literal('StopRunInstruction'),
    companyId: Type.String({ minLength: 1 }),
    reason: RunInstructionStopReason
})
// No player: a president who has lost the company is no longer active when it operates.
export const StopRunInstruction: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type StopRunInstruction = Type.Static<typeof StopRunInstruction>
const Validator = Compile(StopRunInstruction)
export function isStopRunInstruction(action: GameAction): action is StopRunInstruction {
    return (
        action instanceof HydratedStopRunInstruction ||
        (action.type === 'StopRunInstruction' && Validator.Check(action))
    )
}

export class HydratedStopRunInstruction
    extends HydratableAction<typeof StopRunInstruction>
    implements StopRunInstruction
{
    declare type: 'StopRunInstruction'
    declare companyId: string
    declare reason: RunInstructionStopReason
    constructor(data: StopRunInstruction) {
        super(data instanceof HydratedStopRunInstruction ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & RunInstructionState): void {
        assert(this.source === ActionSource.System, 'Run instructions stop automatically')
        const declared = declaredRunInstructionFor(state, this.companyId)
        assertExists(declared, 'There is no run instruction to stop')
        if (this.reason === 'president-changed') removeRunInstruction(state, this.companyId)
        else declared.stopReason = this.reason
    }
}
