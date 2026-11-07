import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    assertExists,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { beginPhase, PhaseName } from '../definition/phases.js'
import {
    DawnSheetRow,
    fillLandscapes,
    LandscapeFilled,
    scoreDawn,
    serfsWithFilledLandscapes
} from '../model/dawn.js'
import { TriggeredEpoch } from '../model/flow.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

export type BeginDawnMetadata = Type.Static<typeof BeginDawnMetadata>
export const BeginDawnMetadata = Type.Object({
    /** R-4.12 The sunray the marker moved to. */
    epoch: TriggeredEpoch,
    /** R-4.12.1, R-4.12.2 One row per seat, in turn order. */
    sheet: Type.Array(DawnSheetRow),
    /** R-4.12.3 Every landscape, in the order it filled (R-4.12-H1). */
    fills: Type.Array(LandscapeFilled)
})

export type BeginDawn = Type.Static<typeof BeginDawn>
export const BeginDawn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source']),
        Type.Object({
            type: Type.Literal(ActionType.BeginDawn),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(BeginDawnMetadata)
        })
    ])
)

export const BeginDawnValidator = Compile(BeginDawn)

export function isBeginDawn(action?: GameAction): action is BeginDawn {
    return action?.type === ActionType.BeginDawn
}

export class HydratedBeginDawn extends HydratableAction<typeof BeginDawn> implements BeginDawn {
    declare type: ActionType.BeginDawn
    declare source: ActionSource.System
    declare metadata?: BeginDawnMetadata

    constructor(data: BeginDawn) {
        super(data, BeginDawnValidator)
    }

    /**
     * R-4.12, R-4.11-H1 The marker moves, then in order: scores, disloyalty, the fill. D12 The serfs
     * with something to collect are named in turn order. Everything is public: never a barrier.
     */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        beginPhase(state, PhaseName.Dawn)
        const epoch = state.flow.epochTriggered
        assertExists(epoch, 'R-4.11.2 A dawn follows a triggered epoch')
        state.epoch = epoch
        state.flow.epochTriggered = undefined

        const sheet = scoreDawn(state, epoch)
        const fills = fillLandscapes(state)
        const pending = serfsWithFilledLandscapes(state)
        state.flow.landscapes = pending.length > 0 ? { pending } : undefined
        this.metadata = { epoch, sheet, fills }
    }
}
