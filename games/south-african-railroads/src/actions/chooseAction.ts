import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ACTION_TRACK_ADVANCE, ActionBox } from '../model/actionBoxes.js'
import type { HydratedSarGameState } from '../model/gameState.js'

export type ChooseActionMetadata = Type.Static<typeof ChooseActionMetadata>
export const ChooseActionMetadata = Type.Object({
    actionTrack: Type.Number(),
    // Construct Track with no railroad able to build, or Offer Stock with nothing to offer.
    nothingToDo: Type.Boolean()
})

export type ChooseAction = Type.Static<typeof ChooseAction>
export const ChooseAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseAction),
            playerId: Type.String(),
            metadata: Type.Optional(ChooseActionMetadata),
            box: Type.Enum(ActionBox),
            // The player's once-a-game special action, which fills no box.
            special: Type.Optional(Type.Boolean())
        })
    ])
)

export const ChooseActionValidator = Compile(ChooseAction)

export function isChooseAction(action?: GameAction): action is ChooseAction {
    return action?.type === ActionType.ChooseAction
}

export class HydratedChooseAction
    extends HydratableAction<typeof ChooseAction>
    implements ChooseAction
{
    declare type: ActionType.ChooseAction
    declare playerId: string
    declare metadata?: ChooseActionMetadata
    declare box: ActionBox
    declare special?: boolean

    constructor(data: ChooseAction) {
        super(data, ChooseActionValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        if (this.special) {
            assert(
                state.specialActionBoxes(this.playerId).includes(this.box),
                `The special action cannot take ${this.box}`
            )
            player.specialActionUsed = true
        } else {
            assert(
                state.availableBoxes(this.playerId).includes(this.box),
                `${this.box} is not available`
            )
            if (state.actionRows()) {
                state.rowsFilled = {
                    ...state.rowsFilled,
                    [this.box]: state.boxesFilled(this.box) + 1
                }
            } else {
                player.locomotive = this.box
                state.actionTrack += ACTION_TRACK_ADVANCE[this.box]
            }
        }
        state.developmentsThisTurn = 0
        this.metadata = {
            actionTrack: state.actionTrack,
            nothingToDo: HydratedChooseAction.nothingToDo(state, this.box, this.playerId)
        }
    }

    static nothingToDo(state: HydratedSarGameState, box: ActionBox, playerId: string): boolean {
        switch (box) {
            case ActionBox.ConstructTrack:
                return state.buildableRailroads().length === 0
            case ActionBox.OfferStock:
                return state.unsoldOffers().length === 0 && state.holdings(playerId).length === 0
            case ActionBox.DevelopSettlements:
                return (
                    state.developableSettlements().length === 0 &&
                    state.leaveTownOptions(playerId).length === 0
                )
            case ActionBox.PayDividends:
                return false
        }
    }

    static canChoose(state: HydratedSarGameState, playerId: string): boolean {
        return (
            state.turnPlayerId() === playerId &&
            (state.availableBoxes(playerId).length > 0 ||
                state.specialActionBoxes(playerId).length > 0)
        )
    }
}
