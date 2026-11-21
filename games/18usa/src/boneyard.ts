import * as Type from 'typebox'
import { ActionSource, assert, assertExists, type HydratedGameState } from '@tabletop/common'
import {
    closePrivate,
    continuePhaseChange,
    controllingOwner,
    releaseTrains,
    titleAction,
    trainsOverLimit,
    trainsOwnedBy,
    type ActionDefinition,
    type EighteenXXStateHandler,
    type PhaseChangeState,
    type PhaseChanges,
    type PhaseOccurrence,
    type PhaseRules,
    type Train
} from '@tabletop/18xx'
import type { EighteenUSAState, HydratedEighteenUSAState } from './state.js'
import { EighteenUSAPhases, ObsoleteTrainIds } from './trains.js'
import { PennsyBoneyardId, companyHolding } from './privateHolders.js'
import { EighteenUSATrainRules } from './trainRules.js'

export { SavingTrainState } from './state.js'
import { SavingTrainState } from './state.js'

type State = PhaseChangeState & EighteenUSAState

/** How the phase's trains rust, before P13 is asked: the + trains run once more (§8). */
function printedRustTiming(state: PhaseChangeState, train: Train) {
    const timing = EighteenUSAPhases.rustTiming(state.phaseId, train.definitionId)
    return timing && ObsoleteTrainIds.includes(train.definitionId) ? 'after-operation' : timing
}

const BoneyardChanges = Type.Object(
    {
        boneyard: Type.Optional(
            Type.Object(
                { companyId: Type.String(), trainIds: Type.Array(Type.String()) },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)

/** A rust that reaches P13's company waits for its president to save one train (P13). */
const Changes: PhaseChanges<typeof BoneyardChanges> = {
    schema: BoneyardChanges,
    apply(state: State, _event: PhaseOccurrence) {
        const companyId = companyHolding(state, PennsyBoneyardId)
        if (!companyId) return {}
        const trainIds = trainsOwnedBy(state, { kind: 'company', companyId })
            .filter((train) => printedRustTiming(state, train) === 'immediate')
            .map((train) => train.id)
        if (!trainIds.length) return {}
        state.boneyard = { companyId, trainIds }
        return { boneyard: { companyId, trainIds } }
    }
}

export const EighteenUSAPhaseRules: PhaseRules = {
    rustTiming: (state: State, train) =>
        state.boneyard?.trainIds.includes(train.id)
            ? 'after-operation'
            : printedRustTiming(state, train),
    // Companies over the limit discard to the open market, the buyer included (§12.6).
    discardOrder: (state) =>
        state.companies
            .filter((company) => company.kind !== 'private' && !company.closed)
            .map((company) => company.id),
    discardDestination: 'market',
    changes: Changes,
    decisionState: (state: State) => (state.boneyard ? SavingTrainState : undefined)
}

const SaveTrainAction = titleAction('SaveTrain', {
    companyId: Type.String(),
    /** The train kept until the company's next run; none lets every one rust. */
    trainId: Type.Optional(Type.String())
})
export const SaveTrain = SaveTrainAction.schema
export type SaveTrain = Type.Static<typeof SaveTrain>
export const isSaveTrain = SaveTrainAction.is

function saverId(state: State): string | undefined {
    const companyId = state.boneyard?.companyId
    return companyId ? controllingOwner(state, companyId)?.playerId : undefined
}

class HydratedSaveTrain extends SaveTrainAction.Base implements SaveTrain {
    declare type: 'SaveTrain'
    declare playerId: string
    declare companyId: string
    declare trainId?: string
    isValidFor(state: State): boolean {
        const pending = state.boneyard
        return (
            this.source === ActionSource.User &&
            !!pending &&
            pending.companyId === this.companyId &&
            saverId(state) === this.playerId &&
            (!this.trainId || pending.trainIds.includes(this.trainId))
        )
    }
    // The saved train still counts for the limit, and P13 is discarded (P13).
    apply(state: HydratedGameState & State): void {
        assert(this.isValidFor(state), 'The Pennsy Boneyard cannot save that train')
        const pending = state.boneyard
        assertExists(pending, 'A rust awaits the Boneyard')
        releaseTrains(
            state.trainInventory,
            pending.trainIds.filter((id) => id !== this.trainId),
            'removed'
        )
        delete state.boneyard
        if (this.trainId) {
            state.savedTrainId = this.trainId
            closePrivate(state, PennsyBoneyardId)
        }
        const change = state.phaseChange
        if (change && !change.discardCompanyIds.includes(this.companyId))
            if (trainsOverLimit(state, EighteenUSATrainRules, this.companyId).length)
                change.discardCompanyIds = [...change.discardCompanyIds, this.companyId]
    }
}

export const BoneyardActions: readonly ActionDefinition[] = [
    SaveTrainAction.define((action) => new HydratedSaveTrain(action))
]

/** P13's president decides which train, if any, the Boneyard keeps; the phase change goes on. */
export const SavingTrainHandler: EighteenXXStateHandler<HydratedEighteenUSAState> = {
    isValidAction: (action, context) =>
        action instanceof HydratedSaveTrain && action.isValidFor(context.gameState),
    validActionsForPlayer: (playerId, context) =>
        saverId(context.gameState) === playerId ? [SaveTrainAction.type] : [],
    enter(context) {
        const playerId = saverId(context.gameState)
        if (playerId) context.gameState.activePlayerIds = [playerId]
    },
    onAction: (_action, context) => continuePhaseChange(context.gameState, EighteenUSAPhaseRules)
}
