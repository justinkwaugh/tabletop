import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Suit } from '../model/oathEnums.js'
import { ChronicleAdded, ChronicleStep } from '../model/chronicle.js'
import { ActionType } from '../definition/actions.js'
import {
    chronicleOf,
    chronicleSuitLeaders,
    reasonCannotChooseChronicleSuit
} from '../util/chronicleChoices.js'
import { sixFromArchive } from '../util/chronicleCards.js'

export type ChooseChronicleSuitMetadata = Type.Static<typeof ChooseChronicleSuitMetadata>
export const ChooseChronicleSuitMetadata = Type.Object({
    /** R-8.4 — the suits tied for the most, in the clockwise order. */
    tiedSuits: Type.Array(Type.Enum(Suit)),
    /**
     * R-8.4 — the three, two and one the choice adds, drawn by the System Action that follows;
     * absent when the Archive is short and R-8.4.a heals it instead.
     */
    added: Type.Optional(ChronicleAdded)
})

/** R-8.4 — "You choose among tied suits—if you have no advisers, choose any suit." */
export type ChooseChronicleSuit = Type.Static<typeof ChooseChronicleSuit>
export const ChooseChronicleSuit = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseChronicleSuit),
            playerId: Type.String(),
            suit: Type.Enum(Suit),
            metadata: Type.Optional(ChooseChronicleSuitMetadata)
        })
    ])
)

export const ChooseChronicleSuitValidator = Compile(ChooseChronicleSuit)

export function isChooseChronicleSuit(action?: GameAction): action is ChooseChronicleSuit {
    return action?.type === ActionType.ChooseChronicleSuit
}

export class HydratedChooseChronicleSuit
    extends HydratableAction<typeof ChooseChronicleSuit>
    implements ChooseChronicleSuit
{
    declare type: ActionType.ChooseChronicleSuit
    declare playerId: string
    declare suit: Suit
    declare metadata?: ChooseChronicleSuitMetadata

    constructor(data: ChooseChronicleSuit) {
        super(data, ChooseChronicleSuitValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = reasonCannotChooseChronicleSuit(state, this.playerId, this.suit)
        if (reason) throw Error(reason)
        this.revealsInfo = false
        const suits = sixFromArchive(state, this.suit)
        this.metadata = {
            tiedSuits: chronicleSuitLeaders(state),
            ...(suits ? { added: { suits } } : {})
        }
        chronicleOf(state).suit = this.suit
    }

    static canDoChooseChronicleSuit(state: HydratedOathGameState, playerId: string): boolean {
        if (state.chronicle?.step !== ChronicleStep.Suit) return false
        const [any] = chronicleSuitLeaders(state)
        return reasonCannotChooseChronicleSuit(state, playerId, any) === undefined
    }
}
