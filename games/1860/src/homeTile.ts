import {
    TrackConstruction,
    TrackLayDetails,
    TrackRequest,
    applyTrackLay,
    controllingOwner,
    titleAction,
    type EighteenXXStateHandler
} from '@tabletop/18xx'
import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import { company1860 } from './companies.js'
import { LayingHomeTileState, type HydratedState1860 } from './state.js'
import { TrackRules1860 } from './track.js'

function director(state: HydratedState1860): string | undefined {
    const companyId = state.homeTileCompanyId
    return companyId ? controllingOwner(state, companyId)?.playerId : undefined
}

/**
 * Runs the construction as for the floating company's own lay on its home hex, with a track
 * step of its own for the length of the call.
 */
function withHomeStep<Result>(
    state: HydratedState1860,
    companyId: string,
    run: (construction: TrackConstruction) => Result
): Result {
    const previous = state.trackStep
    state.trackStep = { companyId, lays: [], completed: false }
    try {
        return run(new TrackConstruction(state, TrackRules1860))
    } finally {
        if (previous) state.trackStep = previous
        else delete state.trackStep
    }
}

/** The tiles the director may lay on the floating company's bare home hex. */
export function homeTileChoices(state: HydratedState1860): TrackLayDetails[] {
    const companyId = state.homeTileCompanyId
    if (!companyId) return []
    return withHomeStep(state, companyId, (construction) =>
        construction.choices(company1860(companyId).home)
    )
}

const LayAction = titleAction('LayHomeTile', {
    ...TrackRequest.properties,
    metadata: Type.Optional(TrackLayDetails)
})
export const LayHomeTile = LayAction.schema
export const isLayHomeTile = LayAction.is

/**
 * The director of a company floating on a hex without track lays a tile there with its home
 * base, free and beside the company's own lays (Flotation & Capitalisation).
 */
export class HydratedLayHomeTile extends LayAction.Base {
    declare playerId: string
    declare companyId: Type.Static<typeof LayHomeTile>['companyId']
    declare locationId: Type.Static<typeof LayHomeTile>['locationId']
    declare definitionId: Type.Static<typeof LayHomeTile>['definitionId']
    declare rotation: Type.Static<typeof LayHomeTile>['rotation']
    declare nodeMapping: Type.Static<typeof LayHomeTile>['nodeMapping']
    declare metadata?: Type.Static<typeof LayHomeTile>['metadata']
    isValid(state: HydratedState1860): boolean {
        if (
            this.source !== ActionSource.User ||
            state.homeTileCompanyId !== this.companyId ||
            director(state) !== this.playerId
        )
            return false
        return !!withHomeStep(state, this.companyId, (construction) => construction.evaluate(this))
            .details
    }
    apply(state: HydratedState1860): void {
        assert(this.isValid(state), 'The director lays a tile on the home hex')
        this.metadata = withHomeStep(state, this.companyId, (construction) => {
            const details = construction.evaluate(this).details
            assertExists(details, 'The home tile is legal')
            return applyTrackLay(
                state,
                TrackRules1860,
                details,
                { kind: 'company', companyId: this.companyId },
                false
            )
        })
        delete state.homeTileCompanyId
    }
}

const SkipAction = titleAction('SkipHomeTile', { companyId: Type.String({ minLength: 1 }) })
export const SkipHomeTile = SkipAction.schema
export const isSkipHomeTile = SkipAction.is

/** With no tile to fit the home hex, there is nothing to lay. */
export class HydratedSkipHomeTile extends SkipAction.Base {
    declare playerId: string
    declare companyId: Type.Static<typeof SkipHomeTile>['companyId']
    isValid(state: HydratedState1860): boolean {
        return state.homeTileCompanyId === this.companyId && homeTileChoices(state).length === 0
    }
    apply(state: HydratedState1860): void {
        assert(this.isValid(state), 'Only a home hex no tile fits is left bare')
        delete state.homeTileCompanyId
    }
}

type Context = MachineContext<HydratedState1860>

/** Returns to the stock turn of the player whose purchase or exchange floated the company. */
function resumeStockRound(state: HydratedState1860): string {
    const turn = state.turnManager.currentTurn()
    if (turn) state.activePlayerIds = [turn.playerId]
    return 'StockRound'
}

/** Waits on the floating company's director to lay its home tile, then resumes the stock turn. */
export class LayingHomeTileHandler implements EighteenXXStateHandler<HydratedState1860> {
    isValidAction(action: HydratedAction, context: Context): boolean {
        return (
            (action instanceof HydratedLayHomeTile || action instanceof HydratedSkipHomeTile) &&
            action.isValid(context.gameState)
        )
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        return director(context.gameState) === playerId ? [LayAction.type] : []
    }
    enter(context: Context): void {
        const state = context.gameState
        const playerId = director(state)
        const companyId = state.homeTileCompanyId
        assert(playerId && companyId, 'A floating company has a director to lay its home tile')
        state.activePlayerIds = [playerId]
        if (!homeTileChoices(state).length)
            context.addSystemAction(SkipHomeTile, { playerId, companyId })
    }
    onAction(_action: HydratedAction, context: Context): string {
        return resumeStockRound(context.gameState)
    }
}

/** Sends play to the director's home tile whenever a company floats on a bare home hex. */
export function laysHomeTiles(
    handler: EighteenXXStateHandler<HydratedState1860>
): EighteenXXStateHandler<HydratedState1860> {
    return {
        enter: (context) => handler.enter(context),
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        onAction(action, context) {
            const next = handler.onAction(action, context)
            return context.gameState.homeTileCompanyId ? LayingHomeTileState : next
        }
    }
}

export const HomeTileActions = [
    LayAction.define((action) => new HydratedLayHomeTile(action)),
    SkipAction.define((action) => new HydratedSkipHomeTile(action))
]
