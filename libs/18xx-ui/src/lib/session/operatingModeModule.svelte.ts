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

/**
 * A title's own optional action in the operating turn, such as buying one of 1833NE's ferries:
 * an entry in the operating mode switch whose panel the table draws by `id`.
 */
export type TitleOperatingMode = ModeLabel & { id: string }
/** A mode's switch label, and the shorter one shown when the switch is pressed for room. */
export type ModeLabel = { label: string; shortLabel: string }
export type OperatingMode = 'track' | 'stations' | 'finance' | { titleModeId: string }
export type OperatingModeOption = ModeLabel & {
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

const LayTrack: ModeLabel = { label: 'Lay track', shortLabel: 'Track' }
const PlaceStation: ModeLabel = { label: 'Place station', shortLabel: 'Station' }
const RunTrains: ModeLabel = { label: 'Run trains', shortLabel: 'Run' }

function titleModeId(mode: OperatingMode): string | undefined {
    return typeof mode === 'object' ? mode.titleModeId : undefined
}

/**
 * Which panel the operating company's turn shows when a step offers more than one kind of
 * action: track or stations in a combined construction step, a title's own optional actions,
 * and issuing or redeeming shares beside construction or the run. The player's choice is a view
 * choice that Undo never changes.
 */
export class OperatingModeModule {
    constructor(
        private readonly session: OperatingModeSession,
        private readonly finance: Pick<CorporateFinanceModule, 'choices' | 'modeLabel'>,
        private readonly privateActions: Pick<
            PrivateActionsModule,
            'titlePower' | 'selection' | 'trackPowerSelection'
        >,
        private readonly decisions: Pick<CompanyDecisionsModule, 'selection'>,
        private readonly construction: Construction,
        /** The title's modes open to the operating company now. */
        private readonly titleModes: () => readonly TitleOperatingMode[]
    ) {}

    private stationsWithTrack = $derived.by(() => !!this.session.rules.stationsWithTrack)
    /** Whether a step can offer more than one kind of action. */
    enabled = $derived.by(
        () =>
            this.stationsWithTrack ||
            !!this.session.rules.corporateFinanceRules ||
            this.titleModes().length > 0
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
        const titleId = titleModeId(mode)
        if (titleId) return this.titleModes().some((title) => title.id === titleId)
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
        const [title] = this.titleModes()
        if (machineState === 'LayingTrack' && title) return { titleModeId: title.id }
        return this.stationsWithTrack ? 'stations' : 'track'
    })
    private selectedTitleId = $derived.by(() => titleModeId(this.mode))
    options = $derived.by((): readonly OperatingModeOption[] => {
        const { machineState } = this.session.state
        const option = (
            { label, shortLabel }: ModeLabel,
            mode: OperatingMode | undefined,
            selected: boolean
        ) => ({
            label,
            shortLabel,
            selected,
            choose: () => this.choose(mode)
        })
        const construction =
            machineState === 'LayingTrack'
                ? [
                      ...(this.available('track')
                          ? [option(LayTrack, 'track', this.mode === 'track')]
                          : []),
                      ...(this.available('stations')
                          ? [option(PlaceStation, 'stations', this.mode === 'stations')]
                          : [])
                  ]
                : [option(RunTrains, undefined, this.mode !== 'finance' && !this.selectedTitleId)]
        const titles = this.titleModes().map((title) =>
            option(title, { titleModeId: title.id }, this.selectedTitleId === title.id)
        )
        const finance = this.available('finance')
            ? [option(this.finance.modeLabel, 'finance', this.mode === 'finance')]
            : []
        return [...construction, ...titles, ...finance]
    })
    switchVisible = $derived.by(() => {
        const { machineState, purchaseOffer } = this.session.state
        return (
            this.enabled &&
            (machineState === 'LayingTrack' || machineState === 'RunningTrains') &&
            (this.options.length > 1 || this.mode === 'finance' || !!this.titleModeShown) &&
            !purchaseOffer &&
            !this.decisions.selection &&
            !this.privateActions.selection
        )
    })
    canChoose = $derived.by(
        () =>
            this.session.interactive &&
            (this.hasAction('FinishTrack') ||
                this.hasAction('CorporateFinance') ||
                this.titleModes().length > 0)
    )
    /** No offer, selection or decision takes the panel from the chosen mode. */
    private panelFree = $derived.by(
        () =>
            !this.session.state.purchaseOffer &&
            !this.privateActions.selection &&
            !this.privateActions.trackPowerSelection &&
            !this.decisions.selection
    )
    financeShown = $derived.by(
        () => this.mode === 'finance' && this.finance.choices.length > 0 && this.panelFree
    )
    /** Set to the title mode's id while its panel replaces the family's. */
    titleModeShown = $derived.by(() => (this.panelFree ? this.selectedTitleId : undefined))
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
    /** Nothing left to lay, place, issue or redeem, nor a title mode, though construction is open. */
    nothingToBuild = $derived.by(
        () =>
            this.constructionOpen &&
            !this.hasAction('LayTile') &&
            !this.hasAction('PlaceStation') &&
            !this.finance.choices.length &&
            !this.titleModes().length
    )
    /** Construction can still be finished, whoever is looking. */
    constructionOpen = $derived.by(
        () => this.session.state.machineState === 'LayingTrack' && this.hasAction('FinishTrack')
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
