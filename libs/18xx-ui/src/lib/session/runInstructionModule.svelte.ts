import { assert, assertExists, type GameAction } from '@tabletop/common'
import {
    SetRunInstruction,
    SetRunInstructionStops,
    declaredRunInstructionFor,
    ignorableRunInstructionStops,
    instructableCompanyIds,
    isIgnorableRunStop,
    isSolvedRun,
    toggledMember,
    type IgnorableRunInstructionStop,
    type HydratedEighteenXXState,
    type InstructedRun,
    type StandingRunInstruction
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'

type RunInstructionView = Pick<
    HydratedEighteenXXState,
    'result' | 'companies' | 'certificates' | 'runInstructions'
>
const RunInstructionDeclaration = {
    outOfTurn: true,
    supersedable: true,
    supersessionScope: 'companyId'
} as const

export type RunInstructionSession = ModuleSession<RunInstructionView, unknown>
export type InstructedRunSolve = (companyId: string) => Promise<InstructedRun>
type RunInstructionFailure = { companyId: string; message: string }

export class RunInstructionModule {
    constructor(
        private readonly session: RunInstructionSession,
        private readonly solve: () => InstructedRunSolve | undefined
    ) {}

    changing = $state<{ companyId: string; on: boolean }>()
    #failure = $state.raw<RunInstructionFailure & { shownState: RunInstructionView }>()
    #draftIgnoredStops = $state<{
        playerId: string
        stops: Record<string, IgnorableRunInstructionStop[]>
    }>()

    private get state(): RunInstructionView {
        return this.session.state
    }
    available = $derived.by(
        () =>
            this.state.result === undefined &&
            !!this.solve() &&
            !!this.session.playerId &&
            this.session.validActionTypes.includes('SetRunInstruction') &&
            (!this.session.ordinaryHotseatPlay || this.session.viewingAsNonActivePlayer)
    )
    canChange = $derived.by(() => this.available && this.session.interactive && !this.changing)
    presided = $derived.by((): string[] => {
        const playerId = this.session.playerId
        if (!this.available || !playerId) return []
        return instructableCompanyIds(this.state, playerId)
    })
    shown = $derived(this.presided.length > 0)
    declared = $derived.by((): StandingRunInstruction[] =>
        this.presided.flatMap((companyId) => {
            const declared = declaredRunInstructionFor(this.state, companyId)
            return declared && declared.playerId === this.session.playerId ? [declared] : []
        })
    )
    stopped = $derived(
        this.declared.filter((declared) => declared.stopReason && this.isOn(declared.companyId))
    )
    anyOn = $derived(this.presided.some((companyId) => this.isOn(companyId)))

    get failure(): RunInstructionFailure | undefined {
        return this.#failure?.shownState === this.state ? this.#failure : undefined
    }

    isOn(companyId: string): boolean {
        return this.changing?.companyId === companyId
            ? this.changing.on
            : this.declared.some((declared) => declared.companyId === companyId)
    }

    ignoredStops(companyId: string): readonly IgnorableRunInstructionStop[] {
        const declared = this.declared.find((declared) => declared.companyId === companyId)
        if (declared) return declared.ignoredStops ?? []
        const drafts = this.#draftIgnoredStops
        if (!drafts || drafts.playerId !== this.session.playerId) return []
        return drafts.stops[companyId] ?? []
    }

    async toggleIgnoredStop(companyId: string, stop: IgnorableRunInstructionStop) {
        const ignoredStops = toggledMember(
            ignorableRunInstructionStops,
            this.ignoredStops(companyId),
            stop
        )
        if (this.declared.some((declared) => declared.companyId === companyId)) {
            await this.change(companyId, true, async () =>
                this.session.createPlayerAction(SetRunInstructionStops, {
                    ...RunInstructionDeclaration,
                    companyId,
                    ignoredStops
                })
            )
            return
        }
        this.#setDraft(companyId, ignoredStops)
    }

    async declare(companyId: string) {
        const solve = this.solve()
        assertExists(solve, 'Run instructions need the route solver')
        const ignoredStops = [...this.ignoredStops(companyId)]
        await this.change(companyId, true, async () => {
            const run = await solve(companyId)
            if (!isSolvedRun(run)) {
                this.#failure = {
                    companyId,
                    message: 'The best run could not be found in time.',
                    shownState: this.state
                }
                return undefined
            }
            this.#setDraft(companyId, undefined)
            return this.session.createPlayerAction(SetRunInstruction, {
                ...RunInstructionDeclaration,
                companyId,
                instruction: {
                    payout: 'pay',
                    run,
                    ...(ignoredStops.length ? { ignoredStops } : {})
                }
            })
        })
    }

    async cancel(companyId: string) {
        await this.change(companyId, false, async () =>
            this.session.createPlayerAction(SetRunInstruction, {
                ...RunInstructionDeclaration,
                companyId
            })
        )
    }

    async keepGoing(companyId: string) {
        const declared = declaredRunInstructionFor(this.state, companyId)
        assertExists(declared, 'There is no run instruction')
        const reason = declared.stopReason
        assertExists(reason, 'The run instruction has not stopped')
        assert(isIgnorableRunStop(reason), 'The run instruction stopped for good reason')
        await this.change(companyId, true, async () =>
            this.session.createPlayerAction(SetRunInstructionStops, {
                ...RunInstructionDeclaration,
                companyId,
                ignoredStops: [...(declared.ignoredStops ?? []), reason]
            })
        )
    }

    private async change(
        companyId: string,
        on: boolean,
        declaration: () => Promise<GameAction | undefined>
    ) {
        assert(this.canChange, 'Run instructions are unavailable')
        this.#failure = undefined
        this.changing = { companyId, on }
        try {
            const action = await declaration()
            if (!action) return
            await this.session.applyAction(this.session.withSupersededAction(action))
            // A declaration that acts is presented first; until then the state shown predates it.
            await this.session.settled()
        } finally {
            this.changing = undefined
        }
    }

    #setDraft(companyId: string, stops: IgnorableRunInstructionStop[] | undefined) {
        const playerId = this.session.playerId
        assertExists(playerId, 'Only a seated player chooses stops')
        const current =
            this.#draftIgnoredStops?.playerId === playerId ? this.#draftIgnoredStops.stops : {}
        const others = Object.fromEntries(
            Object.entries(current).filter(([id]) => id !== companyId)
        )
        this.#draftIgnoredStops = {
            playerId,
            stops: stops ? { ...others, [companyId]: stops } : others
        }
    }
}
