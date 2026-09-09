import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { OperatingSet, type OperatingRules, type OperatingState } from './operatingSet.js'

const StartFields = Type.Object({
    type: Type.Literal('StartOperatingSet'),
    metadata: Type.Optional(OperatingSet)
})
export const StartOperatingSet: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof StartFields.properties
> = Type.Object(
    { ...GameAction.properties, ...StartFields.properties },
    { additionalProperties: false }
)
export type StartOperatingSet = Type.Static<typeof StartOperatingSet>
const Validator = Compile(StartOperatingSet)
export function isStartOperatingSet(action: GameAction): action is StartOperatingSet {
    return (
        action instanceof HydratedStartOperatingSet ||
        (action.type === 'StartOperatingSet' && Validator.Check(action))
    )
}
export class HydratedStartOperatingSet
    extends HydratableAction<typeof StartOperatingSet>
    implements StartOperatingSet
{
    declare type: 'StartOperatingSet'
    declare metadata?: OperatingSet
    readonly #rules: OperatingRules
    constructor(data: StartOperatingSet, rules: OperatingRules) {
        super(data instanceof HydratedStartOperatingSet ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & OperatingState): void {
        assert(
            this.source === ActionSource.System,
            'Starting an operating set requires a system action'
        )
        const roundCount = this.#rules.roundCount(state)
        const companyOrder = this.#rules.companyOrder(state)
        assert(Number.isInteger(roundCount) && roundCount > 0, 'Invalid operating round count')
        assert(
            new Set(companyOrder).size === companyOrder.length &&
                companyOrder.every((id) =>
                    state.companies.some((company) => company.id === id && !company.closed)
                ),
            'Invalid operating company order'
        )
        state.operatingSet = {
            number: (state.operatingSet?.number ?? 0) + 1,
            roundNumber: 1,
            roundCount,
            companyOrder: [...companyOrder]
        }
        this.metadata = structuredClone(state.operatingSet)
    }
}
