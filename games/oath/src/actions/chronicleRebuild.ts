import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { assertSavedMap } from '../util/chronicleMap.js'
import { rebuildWorldDeck } from '../util/chronicleCards.js'

/** The rebuilt deck's public count. */
export type ChronicleRebuildMetadata = Type.Static<typeof ChronicleRebuildMetadata>
export const ChronicleRebuildMetadata = Type.Object({
    /** R-8.8 — the Visions shuffled into the rebuilt deck, as public as the deck's backs. */
    visions: Type.Number()
})

/** R-8.7, R-8.8 — the world saved as it lies, then every denizen in play shuffled into the new world deck. */
export type ChronicleRebuild = Type.Static<typeof ChronicleRebuild>
export const ChronicleRebuild = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChronicleRebuild),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(ChronicleRebuildMetadata)
        })
    ])
)

export const ChronicleRebuildValidator = Compile(ChronicleRebuild)

export function isChronicleRebuild(action?: GameAction): action is ChronicleRebuild {
    return action?.type === ActionType.ChronicleRebuild
}

export class HydratedChronicleRebuild
    extends HydratableAction<typeof ChronicleRebuild>
    implements ChronicleRebuild
{
    declare type: ActionType.ChronicleRebuild
    declare source: ActionSource.System
    declare metadata?: ChronicleRebuildMetadata

    constructor(data: ChronicleRebuild) {
        super(data, ChronicleRebuildValidator)
    }

    /**
     * R-8.7 moves nothing (the map is already the saved stack and the boards keep their sides), so
     * the table has no moment between it and R-8.8. R-X.3 — the new deck is shuffled.
     */
    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = true
        assertSavedMap(state)
        rebuildWorldDeck(state)
        this.metadata = { visions: state.worldDeckVisions }
    }
}
