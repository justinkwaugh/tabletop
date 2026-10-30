import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { ChronicleMapRecord } from '../model/chronicle.js'
import { chronicleOf, chronicleWinnerOf } from '../util/chronicleChoices.js'
import { cleanUpMap } from '../util/chronicleMap.js'

/** R-8.3.2 to R-8.3.5 as the table saw them, and the winner whose sites were kept. */
export type ChronicleMapMetadata = Type.Static<typeof ChronicleMapMetadata>
export const ChronicleMapMetadata = Type.Evaluate(
    Type.Intersect([ChronicleMapRecord, Type.Object({ winnerPlayerId: Type.String() })])
)

/** R-8.3.2 to R-8.3.5 — the map cleaned up and refilled: sites shuffled into the site deck and dealt. */
export type ChronicleMap = Type.Static<typeof ChronicleMap>
export const ChronicleMap = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChronicleMap),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(ChronicleMapMetadata)
        })
    ])
)

export const ChronicleMapValidator = Compile(ChronicleMap)

export function isChronicleMap(action?: GameAction): action is ChronicleMap {
    return action?.type === ActionType.ChronicleMap
}

export class HydratedChronicleMap
    extends HydratableAction<typeof ChronicleMap>
    implements ChronicleMap
{
    declare type: ActionType.ChronicleMap
    declare source: ActionSource.System
    declare metadata?: ChronicleMapMetadata

    constructor(data: ChronicleMap) {
        super(data, ChronicleMapValidator)
    }

    /** R-X.3 — the site deck is shuffled and sites are dealt and flipped. */
    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = true
        const record = cleanUpMap(state)
        chronicleOf(state).ruined = record.ruins.map((ruin) => ruin.edificeId)
        this.metadata = { ...record, winnerPlayerId: chronicleWinnerOf(state) }
    }
}
