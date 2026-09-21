import { assert } from '@tabletop/common'
import {
    FinishOperatingTurn,
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
const LastSkippableStep = 2

export class OperatingTurnModule {
    private skipping = $state(false)
    constructor(
        private readonly session: OperatingTurnSession,
        private readonly steps: Steps
    ) {}

    step = $derived.by(() => operatingStepIndex(this.session.state.machineState))
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
    canFinish = $derived.by(
        () =>
            this.session.interactive &&
            !this.steps.trainSelected() &&
            this.session.validActionTypes.includes('FinishOperatingTurn')
    )

    canSkipTo(target: number): boolean {
        const current = this.step
        return (
            current !== undefined &&
            target > current &&
            target <= LastSkippableStep &&
            !this.skipping &&
            this.session.interactive &&
            !this.steps.hasLocalSelection() &&
            !this.interrupted(this.session.state) &&
            this.session.validActionTypes.includes(current === 0 ? 'FinishTrack' : 'FinishStations')
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
                if (this.step === 0) await this.steps.finishTrack()
                else if (
                    this.step === 1 &&
                    this.session.validActionTypes.includes('FinishStations')
                )
                    await this.steps.finishStations()
                else break
                await this.session.settled()
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
            this.session.createPlayerAction(FinishOperatingTurn, { companyId })
        )
    }

    private operatingCompany(state: OperatingTurnState) {
        return state.trackStep?.companyId ?? state.stationStep?.companyId
    }
    private interrupted(state: OperatingTurnState) {
        return !!(state.purchaseOffer || state.trackConsent || state.privateTrackLay)
    }
}
