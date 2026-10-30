import { assert } from '@tabletop/common'
import {
    nextOperatingCompany,
    type EighteenXXState,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import type { CompanyDecisionsModule } from './companyDecisionsModule.svelte.js'
import type { CorporateFinanceModule } from './corporateFinanceModule.svelte.js'
import type { ModuleSession } from './moduleSession.js'
import type { OperatingStepCompletion } from './operatingTurnModule.svelte.js'
import type { PrivateActionsModule } from './privateActionsModule.svelte.js'

export type OperatingMode = 'track' | 'stations' | 'finance'
export type OperatingModeOption = {
    label: string
    selected: boolean
    choose(): void
}
export type OperatingModeSession = ModuleSession<
    Pick<EighteenXXState, 'machineState' | 'purchaseOffer' | 'operatingSet' | 'companies'>,
    Pick<EighteenXXTitleRules, 'stationsWithTrack' | 'corporateFinanceRules'>
>
type Construction = {
    clearSelections(): void
    finishTrack(): Promise<void>
}

/**
 * Which panel the operating company's turn shows when a step offers more than one kind of
 * action: track or stations in a combined construction step, and issuing or redeeming shares
 * beside construction or the run. The player's choice is a view choice that Undo never changes.
 */
export class OperatingModeModule {
    constructor(
        private readonly session: OperatingModeSession,
        private readonly finance: Pick<CorporateFinanceModule, 'choices' | 'label'>,
        private readonly privateActions: Pick<
            PrivateActionsModule,
            'titlePower' | 'selection' | 'trackPowerSelection'
        >,
        private readonly decisions: Pick<CompanyDecisionsModule, 'selection'>,
        private readonly construction: Construction
    ) {}

    private stationsWithTrack = $derived.by(() => !!this.session.rules.stationsWithTrack)
    /** Whether the title has more than one kind of action in a step. */
    enabled = $derived.by(
        () => this.stationsWithTrack || !!this.session.rules.corporateFinanceRules
    )
    private scope = $derived.by(() =>
        [
            this.session.state.machineState,
            nextOperatingCompany(this.session.state),
            this.session.playerId,
            this.session.viewingHistory
        ].join(':')
    )
    private manual = $derived.by((): OperatingMode | undefined => {
        void this.scope
        return undefined
    })
    private hasAction(type: string) {
        return this.session.validActionTypes.includes(type)
    }
    private available(mode: OperatingMode): boolean {
        if (mode === 'finance') return this.finance.choices.length > 0
        if (mode === 'stations') return this.stationsWithTrack && this.hasAction('PlaceStation')
        return this.hasAction('LayTile')
    }
    mode = $derived.by((): OperatingMode => {
        const { titlePower, trackPowerSelection } = this.privateActions
        if (titlePower?.kind === 'track' || trackPowerSelection) return 'track'
        const manual = this.manual
        if (manual && this.available(manual)) return manual
        if (this.available('track')) return 'track'
        if (this.available('stations')) return 'stations'
        const { machineState } = this.session.state
        if (machineState === 'LayingTrack' && this.available('finance')) return 'finance'
        return this.stationsWithTrack ? 'stations' : 'track'
    })
    options = $derived.by((): readonly OperatingModeOption[] => {
        const { machineState } = this.session.state
        const option = (label: string, mode: OperatingMode | undefined, selected: boolean) => ({
            label,
            selected,
            choose: () => this.choose(mode)
        })
        const construction =
            machineState === 'LayingTrack'
                ? [
                      ...(this.available('track')
                          ? [option('Lay track', 'track', this.mode === 'track')]
                          : []),
                      ...(this.available('stations')
                          ? [option('Place station', 'stations', this.mode === 'stations')]
                          : [])
                  ]
                : [option('Run trains', undefined, this.mode !== 'finance')]
        const finance = this.available('finance')
            ? [option(this.finance.label, 'finance', this.mode === 'finance')]
            : []
        return [...construction, ...finance]
    })
    switchVisible = $derived.by(() => {
        const { machineState, purchaseOffer } = this.session.state
        return (
            this.enabled &&
            (machineState === 'LayingTrack' || machineState === 'RunningTrains') &&
            (this.options.length > 1 || this.mode === 'finance') &&
            !purchaseOffer &&
            !this.decisions.selection &&
            !this.privateActions.selection
        )
    })
    canChoose = $derived.by(
        () =>
            this.session.interactive &&
            (this.hasAction('FinishTrack') || this.hasAction('CorporateFinance'))
    )
    financeShown = $derived.by(
        () =>
            this.mode === 'finance' &&
            this.finance.choices.length > 0 &&
            !this.session.state.purchaseOffer &&
            !this.privateActions.selection &&
            !this.privateActions.trackPowerSelection &&
            !this.decisions.selection
    )
    stationsShown = $derived.by(
        () =>
            this.stationsWithTrack &&
            this.session.state.machineState === 'LayingTrack' &&
            this.mode === 'stations' &&
            !this.session.state.purchaseOffer
    )
    trackActive = $derived.by(
        () => !this.enabled || (this.mode === 'track' && !this.decisions.selection)
    )
    stationsActive = $derived.by(() =>
        this.stationsWithTrack
            ? this.session.state.machineState === 'LayingTrack' &&
              this.mode === 'stations' &&
              !this.privateActions.selection &&
              !this.decisions.selection
            : this.session.state.machineState === 'PlacingStation'
    )
    /** Nothing left to lay, place, issue or redeem, though construction is still open. */
    nothingToBuild = $derived.by(
        () =>
            this.session.state.machineState === 'LayingTrack' &&
            this.hasAction('FinishTrack') &&
            !this.hasAction('LayTile') &&
            !this.hasAction('PlaceStation') &&
            !this.finance.choices.length
    )
    canFinish = $derived.by(() => this.session.interactive && this.hasAction('FinishTrack'))
    /** Finishing a combined construction step skips straight to the run. */
    completion = $derived.by((): OperatingStepCompletion | undefined =>
        this.stationsWithTrack && this.hasAction('FinishTrack')
            ? { lastTarget: 1, finish: () => this.finish() }
            : undefined
    )

    choose(mode: OperatingMode | undefined) {
        assert(this.canChoose, 'The operating mode cannot change now')
        this.construction.clearSelections()
        this.manual = mode
    }
    async finish() {
        await this.construction.finishTrack()
    }
}
