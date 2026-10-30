import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { WIN_RULES, type WinRule } from '../model/ending.js'

/** R-8 — the Chronicle begins: who won, and by which rule, as the action that won decided. */
export type ChronicleStart = Type.Static<typeof ChronicleStart>
export const ChronicleStart = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChronicleStart),
            source: Type.Literal(ActionSource.System),
            winnerPlayerId: Type.String(),
            rule: Type.Enum(WIN_RULES)
        })
    ])
)

export const ChronicleStartValidator = Compile(ChronicleStart)

export function isChronicleStart(action?: GameAction): action is ChronicleStart {
    return action?.type === ActionType.ChronicleStart
}

export class HydratedChronicleStart
    extends HydratableAction<typeof ChronicleStart>
    implements ChronicleStart
{
    declare type: ActionType.ChronicleStart
    declare source: ActionSource.System
    declare winnerPlayerId: string
    declare rule: WinRule

    constructor(data: ChronicleStart) {
        super(data, ChronicleStartValidator)
    }

    /** The Chronicle phase opens its first step; nothing on the table moves. */
    apply(_state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
    }
}
