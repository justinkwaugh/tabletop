import { CompanyChanges, CompanyChangeRecorder } from '../company/companyChanges.js'
import { applyPrivateEffects } from '../privates/privateLifecycle.js'
import type { PrivateRules } from '../privates/privateRules.js'
import type { StockRules } from '../stock/stockRules.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import {
    PhaseEvent,
    advancePhase,
    continuePhaseChange,
    type PhaseRules,
    type PhaseChangeState
} from './phaseChange.js'
import type { TrainRules } from '../trains/trainPurchase.js'
const TitleChanges = Type.Record(Type.String(), Type.Unknown())
export type AdvancePhaseSchema<Changes extends Type.TSchema = typeof TitleChanges> = Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & {
        type: Type.TLiteral<'AdvancePhase'>
        metadata: Type.TOptional<
            Type.TObject<{
                event: typeof PhaseEvent
                nextState: Type.TString
                companyChanges: Type.TOptional<typeof CompanyChanges>
                changes: Type.TOptional<Changes>
            }>
        >
    }
>
/** The phase Action, recording the title's changes under the title's own schema. */
export function advancePhaseSchema(): AdvancePhaseSchema
export function advancePhaseSchema<Changes extends Type.TSchema>(
    changes: Changes
): AdvancePhaseSchema<Changes>
export function advancePhaseSchema(
    changes: Type.TSchema = TitleChanges
): AdvancePhaseSchema<Type.TSchema> {
    return Type.Object(
        {
            ...GameAction.properties,
            type: Type.Literal('AdvancePhase'),
            metadata: Type.Optional(
                Type.Object(
                    {
                        event: PhaseEvent,
                        nextState: Type.String(),
                        companyChanges: Type.Optional(CompanyChanges),
                        changes: Type.Optional(changes)
                    },
                    { additionalProperties: false }
                )
            )
        },
        { additionalProperties: false }
    )
}
export const AdvancePhase: AdvancePhaseSchema = advancePhaseSchema()
export type AdvancePhase = Type.Static<typeof AdvancePhase>
const Validator = Compile(AdvancePhase)
export function isAdvancePhase(action: GameAction): action is AdvancePhase {
    return (
        action instanceof HydratedAdvancePhase ||
        (action.type === 'AdvancePhase' && Validator.Check(action))
    )
}
export class HydratedAdvancePhase
    extends HydratableAction<typeof AdvancePhase>
    implements AdvancePhase
{
    declare type: 'AdvancePhase'
    declare metadata?: AdvancePhase['metadata']
    readonly #rules: PhaseRules
    readonly #trainRules: TrainRules
    readonly #privateRules: Pick<PrivateRules, 'phaseEffects'>
    readonly #stockRules: StockRules
    constructor(
        data: AdvancePhase,
        rules: PhaseRules,
        trainRules: TrainRules,
        privateRules: Pick<PrivateRules, 'phaseEffects'>,
        stockRules: StockRules
    ) {
        super(data instanceof HydratedAdvancePhase ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#trainRules = trainRules
        this.#privateRules = privateRules
        this.#stockRules = stockRules
    }
    apply(state: HydratedGameState & PhaseChangeState): void {
        assert(this.source === ActionSource.System, 'Phase advancement requires a system action')
        const companies = new CompanyChangeRecorder(state)
        const { event, changes } = advancePhase(state, this.#rules, this.#trainRules)
        event.privateEffects = this.#privateRules.phaseEffects(state)
        applyPrivateEffects(state, event.privateEffects, this.#stockRules)
        this.metadata = {
            companyChanges: companies.changes(state),
            event,
            nextState: continuePhaseChange(state, this.#rules),
            ...(changes === undefined ? {} : { changes })
        }
    }
}
export class AdvancingPhaseHandler implements MachineStateHandler<
    HydratedAdvancePhase,
    HydratedGameState & PhaseChangeState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedGameState & PhaseChangeState>
    ): boolean {
        return (
            action.source === ActionSource.System &&
            isAdvancePhase(action) &&
            !!context.gameState.phaseChange &&
            context.gameState.phaseChange.event.fromPhaseId === context.gameState.phaseId
        )
    }
    validActionsForPlayer(): string[] {
        return []
    }
    enter(context: MachineContext<HydratedGameState & PhaseChangeState>): void {
        context.addSystemAction(AdvancePhase, { playerId: context.gameState.activePlayerIds[0] })
    }
    onAction(action: HydratedAdvancePhase): string {
        assert(action.metadata, 'Phase advancement requires its outcome')
        return action.metadata.nextState
    }
}
