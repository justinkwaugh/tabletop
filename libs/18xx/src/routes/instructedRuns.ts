import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { EarningsChoice } from '../earnings/earningsDistribution.js'
import { TrainRoute } from './route.js'
import { orderedSubset } from '../game/orderedSubset.js'
import { controllingOwner, type FinancialState } from '../finance/finance.js'

const Id = Type.String({ minLength: 1 })
/** Identifies the solver input a run was solved for; only clients read it. */
const RunKey = Type.String({ minLength: 1 })
export const InstructedRun = Type.Union([
    Type.Object({ routes: Type.Array(TrainRoute), key: RunKey }, { additionalProperties: false }),
    Type.Object({ unsolved: Type.Literal(true), key: RunKey }, { additionalProperties: false })
])
export type InstructedRun = Type.Static<typeof InstructedRun>
export type SolvedRun = Extract<InstructedRun, { routes: unknown }>

export const InstructedRunAttachment = Type.Object(
    { companyId: Id, runs: Type.Array(InstructedRun, { minItems: 1 }) },
    { additionalProperties: false }
)
export type InstructedRunAttachment = Type.Static<typeof InstructedRunAttachment>
export const InstructedRunAttachments = Type.Array(InstructedRunAttachment, { minItems: 1 })

export const ignorableRunInstructionStops = ['train-lost', 'run-lowered'] as const
export const IgnorableRunInstructionStop = Type.Enum(ignorableRunInstructionStops)
export type IgnorableRunInstructionStop = Type.Static<typeof IgnorableRunInstructionStop>
export const IgnoredRunInstructionStops = Type.Array(IgnorableRunInstructionStop)

export const RunInstructionStopReason = Type.Enum([
    ...ignorableRunInstructionStops,
    'routes-unsolved',
    'routes-stale',
    'payout-unavailable',
    'must-buy-train',
    'president-changed'
])
export type RunInstructionStopReason = Type.Static<typeof RunInstructionStopReason>

export const RunInstruction = Type.Object(
    {
        payout: EarningsChoice,
        run: Type.Object({ routes: Type.Array(TrainRoute), key: RunKey }),
        ignoredStops: Type.Optional(IgnoredRunInstructionStops)
    },
    { additionalProperties: false }
)
export type RunInstruction = Type.Static<typeof RunInstruction>

export const StandingRunInstruction = Type.Object(
    {
        companyId: Id,
        playerId: Id,
        payout: EarningsChoice,
        declaredRevenue: Type.Integer({ minimum: 0 }),
        declaredTrainIds: Type.Array(Id),
        runs: Type.Array(InstructedRun, { minItems: 1 }),
        ignoredStops: Type.Optional(IgnoredRunInstructionStops),
        stopReason: Type.Optional(RunInstructionStopReason)
    },
    { additionalProperties: false }
)
export type StandingRunInstruction = Type.Static<typeof StandingRunInstruction>

export const RunInstructionFields = {
    runInstructions: Type.Optional(Type.Array(StandingRunInstruction))
}
export type RunInstructionState = Type.Static<Type.TObject<typeof RunInstructionFields>>

export function instructableCompanyIds(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    playerId: string
): string[] {
    return state.companies
        .filter(
            (company) =>
                company.kind !== 'private' &&
                !company.closed &&
                controllingOwner(state, company.id)?.playerId === playerId
        )
        .map((company) => company.id)
}

export function isSolvedRun(run: InstructedRun): run is SolvedRun {
    return 'routes' in run
}

export function setIgnoredRunStops(
    declared: Pick<StandingRunInstruction, 'ignoredStops'>,
    stops: readonly IgnorableRunInstructionStop[]
): void {
    const ordered = orderedSubset(ignorableRunInstructionStops, stops)
    if (ordered.length) declared.ignoredStops = ordered
    else delete declared.ignoredStops
}

export function isIgnorableRunStop(
    reason: RunInstructionStopReason
): reason is IgnorableRunInstructionStop {
    return ignorableRunInstructionStops.some((stop) => stop === reason)
}

export function declaredRunInstructionFor(
    state: RunInstructionState,
    companyId: string
): StandingRunInstruction | undefined {
    return state.runInstructions?.find((declared) => declared.companyId === companyId)
}

export function standingRunInstructionFor(
    state: RunInstructionState,
    companyId: string
): StandingRunInstruction | undefined {
    const declared = declaredRunInstructionFor(state, companyId)
    return declared?.stopReason ? undefined : declared
}

export function setRunInstruction(
    state: RunInstructionState,
    standing: StandingRunInstruction
): void {
    state.runInstructions = [
        ...(state.runInstructions ?? []).filter(
            (declared) => declared.companyId !== standing.companyId
        ),
        standing
    ]
}

export function removeRunInstruction(state: RunInstructionState, companyId: string): void {
    const remaining = (state.runInstructions ?? []).filter(
        (declared) => declared.companyId !== companyId
    )
    if (remaining.length > 0) state.runInstructions = remaining
    else delete state.runInstructions
}

export function nextInstructedRun(
    state: RunInstructionState,
    playerId: string,
    companyId: string
): SolvedRun | undefined {
    const standing = standingRunInstructionFor(state, companyId)
    const run = standing?.playerId === playerId ? standing.runs[0] : undefined
    return run && isSolvedRun(run) ? run : undefined
}

export function isInstructedRun(
    state: RunInstructionState,
    action: { playerId: string; companyId: string; routes: readonly TrainRoute[] }
): boolean {
    const run = nextInstructedRun(state, action.playerId, action.companyId)
    return !!run && Value.Equal(run.routes, action.routes)
}

export function isInstructedPayout(
    state: RunInstructionState,
    action: { playerId: string; companyId: string; choice: EarningsChoice }
): boolean {
    const standing = standingRunInstructionFor(state, action.companyId)
    return standing?.playerId === action.playerId && standing.payout === action.choice
}

/** The last run stays for a later turn whose client attached none. */
export function consumeInstructedRun(state: RunInstructionState, companyId: string): void {
    const declared = declaredRunInstructionFor(state, companyId)
    if (declared && declared.runs.length > 1) declared.runs = declared.runs.slice(1)
}

export function attachInstructedRuns(
    state: RunInstructionState,
    attachments: readonly InstructedRunAttachment[]
): void {
    for (const attachment of attachments) {
        const declared = declaredRunInstructionFor(state, attachment.companyId)
        if (declared) declared.runs = structuredClone(attachment.runs)
    }
}
