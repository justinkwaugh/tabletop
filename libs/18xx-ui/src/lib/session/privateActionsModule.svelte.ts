import { assert } from '@tabletop/common'
import type { EighteenXXState } from '@tabletop/18xx'
import type { CompanyDecisionsModule } from './companyDecisionsModule.svelte.js'
import type { LocalSelection } from './localSelections.js'
import type { ModuleSession } from './moduleSession.js'
import { StagedSelection } from './stagedSelection.svelte.js'

export type PrivateTrackPower = { privateCompanyId: string; playerId: string }
export type PrivateActionSource = 'mine' | 'other' | 'powers'
type PrivateActionStages = { source: PrivateActionSource; power: PrivateTrackPower }
const PrivateActionStageOrder = ['source', 'power'] as const

export type PrivateActionsSession = ModuleSession<
    Pick<EighteenXXState, 'privateTrackLay' | 'privatePowerWindow'>,
    unknown
>
type Decisions = Pick<
    CompanyDecisionsModule,
    'choice' | 'privateTileOptions' | 'privateTrainOptions'
>
type TrackSelection = Pick<LocalSelection, 'undo' | 'clear'>

function samePower(left: PrivateTrackPower, right: PrivateTrackPower) {
    return left.privateCompanyId === right.privateCompanyId && left.playerId === right.playerId
}

export class PrivateActionsModule implements LocalSelection {
    readonly stages = new StagedSelection<PrivateActionStages>(PrivateActionStageOrder, 'pop-stage')
    constructor(
        private readonly session: PrivateActionsSession,
        private readonly decisions: Decisions,
        private readonly track: TrackSelection
    ) {}

    selection = $derived.by(() =>
        this.session.selectionsVisible ? this.stages.value('source') : undefined
    )
    purchaseSource = $derived.by(() => (this.selection === 'powers' ? undefined : this.selection))
    get powersAvailable() {
        return (
            this.decisions.privateTileOptions.length > 0 ||
            this.decisions.privateTrainOptions.length > 0
        )
    }
    trackPowers = $derived.by(() => {
        const powers: PrivateTrackPower[] = []
        for (const { privateCompanyId, playerId } of this.decisions.privateTileOptions) {
            const power = { privateCompanyId, playerId }
            if (!powers.some((listed) => samePower(listed, power))) powers.push(power)
        }
        return powers
    })
    trackPowerSelection = $derived.by(() => {
        const { state } = this.session
        if (
            !this.session.selectionsVisible ||
            (this.selection !== 'powers' && !state.privateTrackLay && !state.privatePowerWindow)
        )
            return undefined
        const selected = this.stages.entry('power')
        if (selected && this.trackPowers.some((power) => samePower(power, selected.value)))
            return selected
        return this.trackPowers.length === 1
            ? { value: this.trackPowers[0], source: 'auto' as const }
            : undefined
    })

    choosePowers() {
        this.chooseSource('powers')
    }
    choosePurchaseSource(source: 'mine' | 'other') {
        this.chooseSource(source)
    }
    chooseTrackPower(power: PrivateTrackPower) {
        assert(
            this.trackPowers.some((option) => samePower(option, power)),
            'Choose an available private tile power'
        )
        this.track.clear()
        this.stages.choose('power', power)
    }

    hasManual() {
        return this.stages.hasManual()
    }
    undo() {
        if ((this.stages.hasManual() || this.trackPowerSelection) && this.track.undo()) return true
        return this.stages.undo()
    }
    clear() {
        this.stages.clear()
    }

    private chooseSource(source: PrivateActionSource) {
        this.track.clear()
        this.decisions.choice.clear()
        this.stages.choose('source', source)
    }
}
