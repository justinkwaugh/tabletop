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
import {
    StockInstruction,
    removeStandingStockInstruction,
    setStandingStockInstruction,
    standingStockInstructionFor,
    createStandingStockInstruction
} from './stockInstruction.js'
import type { StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

export const SetStockInstruction = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('SetStockInstruction'),
        outOfTurn: Type.Literal(true),
        supersedable: Type.Literal(true),
        instruction: Type.Optional(StockInstruction)
    },
    { additionalProperties: false }
)
export type SetStockInstruction = Type.Static<typeof SetStockInstruction>
const Validator = Compile(SetStockInstruction)
export function isSetStockInstruction(action: GameAction): action is SetStockInstruction {
    return (
        action instanceof HydratedSetStockInstruction ||
        (action.type === 'SetStockInstruction' && Validator.Check(action))
    )
}

export function stockInstructionProblem(
    state: StockState,
    request: Pick<SetStockInstruction, 'playerId' | 'instruction'>
): string | undefined {
    if (state.stockRound.completed) return 'The stock round has completed'
    if (!state.players.some((player) => player.playerId === request.playerId))
        return 'Only a seated player can hold a standing instruction'
    const { instruction } = request
    if (!instruction)
        return standingStockInstructionFor(state, request.playerId)
            ? undefined
            : 'There is no standing instruction to clear'
    if (instruction.kind === 'pass') return undefined
    if (!state.companies.some((company) => company.id === instruction.companyId))
        return 'Unknown company'
    if (!state.certificatePools.some((pool) => pool.id === instruction.preferredPoolId))
        return 'Unknown certificate pool'
    return undefined
}

export class HydratedSetStockInstruction
    extends HydratableAction<typeof SetStockInstruction>
    implements SetStockInstruction
{
    declare type: 'SetStockInstruction'
    declare playerId: string
    declare outOfTurn: true
    declare supersedable: true
    declare instruction?: StockInstruction
    readonly #rules: StockRules
    constructor(data: SetStockInstruction, rules: StockRules) {
        super(data instanceof HydratedSetStockInstruction ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & StockState): void {
        assert(this.source === ActionSource.User, 'A standing instruction is a player decision')
        const problem = stockInstructionProblem(state, this)
        assert(!problem, problem)
        if (this.instruction)
            setStandingStockInstruction(
                state,
                createStandingStockInstruction(state, this.playerId, this.instruction, this.#rules)
            )
        else removeStandingStockInstruction(state, this.playerId)
    }
}
