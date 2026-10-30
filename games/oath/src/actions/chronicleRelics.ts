import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { ChronicleRelicsRecord } from '../model/chronicle.js'
import { chronicleWinnerOf } from '../util/chronicleChoices.js'
import { cleanUpRelics } from '../util/chronicleRelics.js'

/** R-8.6 as the table saw it: counts, never which relic (R-9.4). */
export type ChronicleRelicsMetadata = Type.Static<typeof ChronicleRelicsMetadata>
export const ChronicleRelicsMetadata = Type.Evaluate(
    Type.Intersect([ChronicleRelicsRecord, Type.Object({ winnerPlayerId: Type.String() })])
)

/** R-8.6 — the Grand Scepter boxed, the losers' relics returned, sites topped up, the winner's stacked. */
export type ChronicleRelics = Type.Static<typeof ChronicleRelics>
export const ChronicleRelics = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChronicleRelics),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(ChronicleRelicsMetadata)
        })
    ])
)

export const ChronicleRelicsValidator = Compile(ChronicleRelics)

export function isChronicleRelics(action?: GameAction): action is ChronicleRelics {
    return action?.type === ActionType.ChronicleRelics
}

export class HydratedChronicleRelics
    extends HydratableAction<typeof ChronicleRelics>
    implements ChronicleRelics
{
    declare type: ActionType.ChronicleRelics
    declare source: ActionSource.System
    declare metadata?: ChronicleRelicsMetadata

    constructor(data: ChronicleRelics) {
        super(data, ChronicleRelicsValidator)
    }

    /** R-X.3 — the relic deck is shuffled and relics are dealt facedown. */
    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = true
        const record = cleanUpRelics(state)
        this.metadata = { ...record, winnerPlayerId: chronicleWinnerOf(state) }
    }
}
