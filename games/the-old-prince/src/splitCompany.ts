import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { BranchSplitAllocation, BranchSplitSettlement } from './branchSplitAllocation.js'
import { TheOldPrinceBranchSplit, type BranchSplitState } from './branchSplit.js'

export const SplitCompany = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('SplitCompany'),
        parentId: Type.String(),
        branchId: Type.String(),
        marketSpaceId: Type.String(),
        allocation: BranchSplitAllocation,
        expectedFunding: Type.Integer({ minimum: 0 }),
        metadata: Type.Optional(BranchSplitSettlement)
    },
    { additionalProperties: false }
)
export type SplitCompany = Type.Static<typeof SplitCompany>
const Validator = Compile(SplitCompany)
export function isSplitCompany(action: GameAction): action is SplitCompany {
    return (
        action instanceof HydratedSplitCompany ||
        (action.type === 'SplitCompany' && Validator.Check(action))
    )
}
export class HydratedSplitCompany
    extends HydratableAction<typeof SplitCompany>
    implements SplitCompany
{
    declare type: 'SplitCompany'
    declare playerId: string
    declare parentId: string
    declare branchId: string
    declare marketSpaceId: string
    declare allocation: BranchSplitAllocation
    declare expectedFunding: number
    declare metadata?: BranchSplitSettlement
    constructor(data: SplitCompany) {
        super(data instanceof HydratedSplitCompany ? data.dehydrate() : data, Validator)
    }
    isValid(state: BranchSplitState): boolean {
        return (
            this.source === ActionSource.User &&
            new TheOldPrinceBranchSplit(state).allocate(this, this.allocation).details
                ?.childFunding === this.expectedFunding
        )
    }
    apply(state: HydratedGameState & BranchSplitState): void {
        assert(this.isValid(state), 'Invalid or stale branch split')
        this.metadata = new TheOldPrinceBranchSplit(state).apply(this, this.allocation)
    }
}
