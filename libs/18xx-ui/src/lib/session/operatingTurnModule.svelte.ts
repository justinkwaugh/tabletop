import { assert } from '@tabletop/common'
import {
    FinishOperatingTurn,
    FinishTrains,
    nextOperatingCompany,
    finishOperatingTurnReason,
    type EighteenXXState,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import { operatingStepIndex } from '../table/operatingStep.js'
import type { ModuleSession } from './moduleSession.js'

type OperatingTurnState = Parameters<typeof finishOperatingTurnReason>[0] &
    Pick<
        EighteenXXState,
        | 'machineState'
        | 'operatingSet'
        | 'trackStep'
        | 'stationStep'
        | 'trainPurchaseStep'
        | 'purchaseOffer'
        | 'trackConsent'
        | 'privateTrackLay'
    >
export type OperatingTurnSession = ModuleSession<
    OperatingTurnState,
    Pick<EighteenXXTitleRules, 'trainRules'>
>
type Steps = {
    finishTrack(): Promise<void>
    finishStations(): Promise<void>
    trainSelected(): boolean
    hasLocalSelection(): boolean
}
export type OperatingStepCompletion = {
    lastTarget: number
    finish(): Promise<void>
}

export class OperatingTurnModule {
    private skipping = $state(false)
    constructor(
        private readonly session: OperatingTurnSession,
        private readonly steps: Steps,
        private readonly completion: () => OperatingStepCompletion | undefined = () =>
            OperatingTurnModule.defaultCompletion(this.session, this.steps),
        private readonly stepIndex: (state: string) => number | undefined = operatingStepIndex
    ) {}

    step = $derived.by(() => this.stepIndex(this.session.state.machineState))
    finishReason = $derived.by(() => {
        const companyId = this.session.state.trainPurchaseStep?.companyId
        return companyId
            ? finishOperatingTurnReason(
                  this.session.state,
                  this.session.rules.trainRules,
                  companyId
              )
            : undefined
    })
    /** Finishing ends the turn, or only the train step when a loan step follows it. */
    finishesTrains = $derived.by(() => this.session.validActionTypes.includes('FinishTrains'))
    canFinish = $derived.by(
        () =>
            this.session.interactive &&
            !this.steps.trainSelected() &&
            (this.finishesTrains || this.session.validActionTypes.includes('FinishOperatingTurn'))
    )

    canSkipTo(target: number): boolean {
        const current = this.step
        const completion = this.completion()
        return (
            completion !== undefined &&
            current !== undefined &&
            target > current &&
            target <= completion.lastTarget &&
            !this.skipping &&
            this.session.interactive &&
            !this.steps.hasLocalSelection() &&
            !this.interrupted(this.session.state)
        )
    }
    async skipTo(target: number) {
        assert(this.canSkipTo(target), 'This operating step cannot be skipped to')
        const operatingSet = this.session.state.operatingSet
        const roundId = [operatingSet?.number, operatingSet?.roundNumber]
        const companyId = this.operatingCompany(this.session.state)
        this.skipping = true
        try {
            while (this.step !== undefined && this.step < target) {
                const completion = this.completion()
                if (
                    !completion ||
                    target > completion.lastTarget ||
                    !this.session.interactive ||
                    this.steps.hasLocalSelection()
                )
                    break
                const previousStep = this.step
                await completion.finish()
                await this.session.settled()
                if (this.step === previousStep) break
                const state = this.session.state
                if (
                    state.operatingSet?.number !== roundId[0] ||
                    state.operatingSet?.roundNumber !== roundId[1] ||
                    this.operatingCompany(state) !== companyId ||
                    this.interrupted(state)
                )
                    break
            }
        } finally {
            this.skipping = false
        }
    }
    async finish() {
        const companyId = this.session.state.trainPurchaseStep?.companyId
        assert(this.canFinish && companyId, 'The operating turn cannot finish yet')
        await this.session.applyAction(
            this.finishesTrains
                ? this.session.createPlayerAction(FinishTrains, { companyId })
                : this.session.createPlayerAction(FinishOperatingTurn, { companyId })
        )
    }

    static defaultCompletion(
        session: OperatingTurnSession,
        steps: Pick<Steps, 'finishTrack' | 'finishStations'>
    ): OperatingStepCompletion | undefined {
        if (
            session.state.machineState === 'LayingTrack' &&
            session.validActionTypes.includes('FinishTrack')
        )
            return { lastTarget: 2, finish: () => steps.finishTrack() }
        if (
            session.state.machineState === 'PlacingStation' &&
            session.validActionTypes.includes('FinishStations')
        )
            return { lastTarget: 2, finish: () => steps.finishStations() }
        return undefined
    }
    private operatingCompany(state: OperatingTurnState) {
        return (
            nextOperatingCompany(state) ??
            state.trackStep?.companyId ??
            state.stationStep?.companyId
        )
    }
    private interrupted(state: OperatingTurnState) {
        return !!(state.purchaseOffer || state.trackConsent || state.privateTrackLay)
    }
}
