import { createStockRound } from './stockRound.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'

const Fields = Type.Object({ type: Type.Literal('StartStockRound') })
export const StartStockRound: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type StartStockRound = Type.Static<typeof StartStockRound>
const Validator = Compile(StartStockRound)
export function isStartStockRound(action: GameAction): action is StartStockRound {
    return (
        action instanceof HydratedStartStockRound ||
        (action.type === 'StartStockRound' && Validator.Check(action))
    )
}
export function canStartStockRound(state: OperatingState): boolean {
    const set = state.operatingSet
    return (
        !!set &&
        !set.completed &&
        set.privateIncomePaid &&
        set.roundNumber === set.roundCount &&
        !nextOperatingCompany(state)
    )
}
export class HydratedStartStockRound
    extends HydratableAction<typeof StartStockRound>
    implements StartStockRound
{
    declare type: 'StartStockRound'
    constructor(data: StartStockRound) {
        super(data instanceof HydratedStartStockRound ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & OperatingState): void {
        assert(
            this.source === ActionSource.System && canStartStockRound(state),
            'The operating set is not complete'
        )
        state.operatingSet!.completed = true
        state.stockRound = createStockRound(state.stockRound.number + 1)
        const playerId = state.turnManager.turnOrder[0]
        assert(playerId, 'Stock round requires a priority player')
        state.activePlayerIds = [playerId]
        state.turnManager.startTurn(playerId, state.actionCount + 1)
    }
}
