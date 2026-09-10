import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import type { OperatingState } from './operatingSet.js'
import type { ConstructionState } from '../construction/trackConstruction.js'

type State = HydratedGameState & OperatingState & ConstructionState
const StartFields = Type.Object({
    type: Type.Literal('StartConstruction'),
    companyId: Type.String()
})
export const StartConstruction: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof StartFields.properties
> = Type.Object(
    { ...GameAction.properties, ...StartFields.properties },
    { additionalProperties: false }
)
export type StartConstruction = Type.Static<typeof StartConstruction>
const Validator = Compile(StartConstruction)
export function isStartConstruction(action: GameAction): action is StartConstruction {
    return (
        action instanceof HydratedStartConstruction ||
        (action.type === 'StartConstruction' && Validator.Check(action))
    )
}
export class HydratedStartConstruction
    extends HydratableAction<typeof StartConstruction>
    implements StartConstruction
{
    declare type: 'StartConstruction'
    declare companyId: string
    constructor(data: StartConstruction) {
        super(data instanceof HydratedStartConstruction ? data.dehydrate() : data, Validator)
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.System &&
                state.operatingSet?.companyOrder[0] === this.companyId,
            'Construction must start with the first operating company'
        )
        const owner = controllingOwner(state, this.companyId)
        assertExists(owner, 'The operating company requires a controlling owner')
        state.trackStep = { companyId: this.companyId, lays: [], completed: false }
        state.activePlayerIds = [owner.playerId]
        state.turnManager.startTurn(owner.playerId, state.actionCount + 1)
    }
}
export class StartConstructionHandler implements MachineStateHandler<
    HydratedStartConstruction,
    State
> {
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        return (
            action.source === ActionSource.System &&
            isStartConstruction(action) &&
            action.companyId === context.gameState.operatingSet?.companyOrder[0]
        )
    }
    validActionsForPlayer(): string[] {
        return []
    }
    enter(context: MachineContext<State>): void {
        const companyId = context.gameState.operatingSet?.companyOrder[0]
        if (companyId)
            context.addSystemAction(StartConstruction, {
                companyId,
                playerId: context.gameState.activePlayerIds[0]
            })
    }
    onAction(): string {
        return 'LayingTrack'
    }
}
