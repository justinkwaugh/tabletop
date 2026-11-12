import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    MachineContext,
    assert
} from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Suit } from '../model/oathEnums.js'
import { chronicleOf, chronicleSuitLeaders } from '../util/chronicleChoices.js'

/** The suit. */
export type ChronicleSettleSuitMetadata = Type.Static<typeof ChronicleSettleSuitMetadata>
export const ChronicleSettleSuitMetadata = Type.Object({ suit: Type.Enum(Suit) })

/** R-8.4 — one suit leads the winner's faceup advisers, so it is the suit; nobody is asked. */
export type ChronicleSettleSuit = Type.Static<typeof ChronicleSettleSuit>
export const ChronicleSettleSuit = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChronicleSettleSuit),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(ChronicleSettleSuitMetadata)
        })
    ])
)

export const ChronicleSettleSuitValidator = Compile(ChronicleSettleSuit)

export function isChronicleSettleSuit(action?: GameAction): action is ChronicleSettleSuit {
    return action?.type === ActionType.ChronicleSettleSuit
}

export class HydratedChronicleSettleSuit
    extends HydratableAction<typeof ChronicleSettleSuit>
    implements ChronicleSettleSuit
{
    declare type: ActionType.ChronicleSettleSuit
    declare source: ActionSource.System
    declare metadata?: ChronicleSettleSuitMetadata

    constructor(data: ChronicleSettleSuit) {
        super(data, ChronicleSettleSuitValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const leaders = chronicleSuitLeaders(state)
        assert(leaders.length === 1, "R-8.4 — one suit leads the winner's advisers")
        const [suit] = leaders
        chronicleOf(state).suit = suit
        this.metadata = { suit }
    }
}
