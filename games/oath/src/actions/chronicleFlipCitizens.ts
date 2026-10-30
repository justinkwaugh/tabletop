import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext, Color } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { flipCitizenBoards } from '../util/chronicleChoices.js'

/** The players whose boards flipped, and the boxed boards' colours. */
export type ChronicleFlipCitizensMetadata = Type.Static<typeof ChronicleFlipCitizensMetadata>
export const ChronicleFlipCitizensMetadata = Type.Object({
    flippedPlayerIds: Type.Array(Type.String()),
    /** The colours of the Citizen boards in the box that flipped with them. */
    flippedBoxColors: Type.Array(Type.Enum(Color))
})

/** R-8.2 — an Exile winner flips every Citizen board, those in the box too, to its Exile side. */
export type ChronicleFlipCitizens = Type.Static<typeof ChronicleFlipCitizens>
export const ChronicleFlipCitizens = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChronicleFlipCitizens),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(ChronicleFlipCitizensMetadata)
        })
    ])
)

export const ChronicleFlipCitizensValidator = Compile(ChronicleFlipCitizens)

export function isChronicleFlipCitizens(action?: GameAction): action is ChronicleFlipCitizens {
    return action?.type === ActionType.ChronicleFlipCitizens
}

export class HydratedChronicleFlipCitizens
    extends HydratableAction<typeof ChronicleFlipCitizens>
    implements ChronicleFlipCitizens
{
    declare type: ActionType.ChronicleFlipCitizens
    declare source: ActionSource.System
    declare metadata?: ChronicleFlipCitizensMetadata

    constructor(data: ChronicleFlipCitizens) {
        super(data, ChronicleFlipCitizensValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        this.metadata = flipCitizenBoards(state)
    }
}
