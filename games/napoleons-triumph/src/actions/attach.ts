import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { MAX_CORPS_UNITS } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { commanderCanCommand } from '../model/orders.js'
import { samePosition } from '../model/pieces.js'

export type Attach = Type.Static<typeof Attach>
export const Attach = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Attach),
            playerId: Type.String(),
            commanderId: Type.String(),
            unitId: Type.String()
        })
    ])
)

export const AttachValidator = Compile(Attach)

export function isAttach(action?: GameAction): action is Attach {
    return action?.type === ActionType.Attach
}

export class HydratedAttach extends HydratableAction<typeof Attach> implements Attach {
    declare type: ActionType.Attach
    declare playerId: string
    declare commanderId: string
    declare unitId: string

    constructor(data: Attach) {
        super(data, AttachValidator)
    }

    /** Rule 9: a commander takes one unit standing with it into its corps, from another corps if need be. */
    apply(state: HydratedNapoleonsTriumphGameState) {
        const commander = state.commander(this.commanderId)
        const unit = state.unit(this.unitId)
        assert(
            commander.playerId === this.playerId && unit.playerId === this.playerId,
            'Both pieces must belong to the commanding army'
        )
        assert(commanderCanCommand(state, commander), `${commander.id} cannot give another command`)
        assert(
            commander.position !== undefined && samePosition(commander.position, unit.position),
            'The commander and the unit must stand in the same position'
        )
        assert(unit.commanderId !== commander.id, 'That unit is already in the corps')
        assert(!unit.fixed, 'The fixed battery stays detached')
        assert(
            state.corpsUnits(commander.id).length < MAX_CORPS_UNITS,
            'A corps holds at most eight units'
        )
        if (unit.commanderId !== undefined) {
            assert(
                state.corpsUnits(unit.commanderId).length > 1,
                'A commander cannot give up its last unit'
            )
        }
        unit.commanderId = commander.id
        commander.commandsThisTurn = (commander.commandsThisTurn ?? 0) + 1
        state.getPlayerState(this.playerId).corpsCommandsUsed += 1
    }
}
