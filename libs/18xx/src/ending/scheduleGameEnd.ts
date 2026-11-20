import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { GameEnding, pendingEnding, type EndingState, type EndingRules } from './gameEnding.js'
const Fields = Type.Object({
    type: Type.Literal('ScheduleGameEnd'),
    metadata: Type.Optional(GameEnding)
})
export const ScheduleGameEnd: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type ScheduleGameEnd = Type.Static<typeof ScheduleGameEnd>
const Validator = Compile(ScheduleGameEnd)
export function isScheduleGameEnd(action: GameAction): action is ScheduleGameEnd {
    return (
        action instanceof HydratedScheduleGameEnd ||
        (action.type === 'ScheduleGameEnd' && Validator.Check(action))
    )
}
export class HydratedScheduleGameEnd
    extends HydratableAction<typeof ScheduleGameEnd>
    implements ScheduleGameEnd
{
    declare type: 'ScheduleGameEnd'
    declare metadata?: GameEnding
    readonly #rules: EndingRules
    constructor(data: ScheduleGameEnd, rules: EndingRules) {
        super(data instanceof HydratedScheduleGameEnd ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: EndingState): boolean {
        return this.source === ActionSource.System && !!pendingEnding(state, this.#rules)
    }
    apply(state: HydratedGameState & EndingState): void {
        assert(this.isValid(state), 'No new game ending has triggered')
        const ending = pendingEnding(state, this.#rules)
        state.gameEnding = ending
        // An ending that lengthens the set under way, as 1861's first 8-train in a set's first
        // round adds two more rounds to it (§13), extends the set at once.
        const set = state.operatingSet
        if (
            ending?.finalOperatingRounds !== undefined &&
            set &&
            !set.completed &&
            !set.endless &&
            set.number === ending.finalOperatingSet
        )
            set.roundCount = ending.finalOperatingRounds
        this.metadata = structuredClone(state.gameEnding)
    }
}
