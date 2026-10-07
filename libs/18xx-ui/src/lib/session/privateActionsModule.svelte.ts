import { assert } from '@tabletop/common'
import type { EighteenXXState, TrackConstruction, TrackLayDetails } from '@tabletop/18xx'
import type { CompanyDecisionsModule } from './companyDecisionsModule.svelte.js'
import type { LocalSelection } from './localSelections.js'
import type { PrivatesModule } from './privatesModule.svelte.js'
import type { ModuleSession } from './moduleSession.js'
import { StagedSelection } from './stagedSelection.svelte.js'

export type PrivateTrackPower = { privateCompanyId: string; playerId: string }
/**
 * A private power whose rules the title applies itself, offered with the shared powers. A track
 * power lays through the ordinary track selection on the map, a location power is chosen on the
 * map, a confirm power asks before acting, and an immediate power acts when chosen.
 */
export type TitlePrivatePower = PrivateTrackPower & { label: string; prompt: string } & (
        | {
              kind: 'track'
              construction: Pick<
                  TrackConstruction,
                  'choices' | 'canReach' | 'evaluate' | 'inventoryAfter'
              >
              commit(details: TrackLayDetails): Promise<void>
              /** Ends a power that allows several lays with the lays staged so far. */
              finish?: { label: string; run(): Promise<void> }
              /** Steps back through lays staged so far. */
              undo?(): boolean
          }
        | {
              kind: 'location'
              locationIds: readonly string[]
              choose(locationId: string): Promise<void>
          }
        | {
              kind: 'confirm'
              confirmLabel: string
              run(): Promise<void>
              /** Greyed tokens previewing where the power places stations. */
              reservations?: EighteenXXState['stationReservations']
          }
        | { kind: 'immediate'; run(): Promise<void> }
    )
export type PrivateActionSource = 'mine' | 'other' | 'powers'
type PrivateActionStages = { source: PrivateActionSource; power: PrivateTrackPower }
const PrivateActionStageOrder = ['source', 'power'] as const

export type PrivateActionsSession = ModuleSession<
    Pick<EighteenXXState, 'privateTrackLay' | 'privatePowerWindow'>,
    unknown
>
type Decisions = Pick<
    CompanyDecisionsModule,
    'choice' | 'privateTileOptions' | 'privateTrainOptions' | 'privateMarkerOptions'
>
type TrackSelection = Pick<LocalSelection, 'undo' | 'clear'>
type Exchanges = Pick<PrivatesModule, 'exchangeOptions'>

function samePower(left: PrivateTrackPower, right: PrivateTrackPower) {
    return left.privateCompanyId === right.privateCompanyId && left.playerId === right.playerId
}

export class PrivateActionsModule implements LocalSelection {
    readonly stages = new StagedSelection<PrivateActionStages>(PrivateActionStageOrder, 'pop-stage')
    constructor(
        private readonly session: PrivateActionsSession,
        private readonly decisions: Decisions,
        private readonly track: TrackSelection,
        private readonly exchanges: Exchanges,
        private readonly titlePowerOptions: () => readonly TitlePrivatePower[] = () => [],
        private readonly offeredPowerOption: () => PrivateTrackPower | undefined = () => undefined
    ) {}

    // Closing private actions declines an offered power until the next state.
    private offerDeclined = $derived.by(() => {
        void this.session.state
        return false
    })
    /** A power the title opens without being asked, such as one just bought. */
    offeredPower = $derived.by(() => {
        const offered = this.offeredPowerOption()
        return offered && !this.offerDeclined
            ? [...this.trackPowers, ...this.choosableTitlePowers].find((power) =>
                  samePower(power, offered)
              )
            : undefined
    })
    selection = $derived.by(() =>
        this.session.selectionsVisible
            ? (this.stages.value('source') ?? (this.offeredPower ? 'powers' : undefined))
            : undefined
    )
    purchaseSource = $derived.by(() => (this.selection === 'powers' ? undefined : this.selection))
    get powersAvailable() {
        return (
            this.decisions.privateTileOptions.length > 0 ||
            this.decisions.privateTrainOptions.length > 0 ||
            this.decisions.privateMarkerOptions.length > 0 ||
            this.exchanges.exchangeOptions.length > 0 ||
            this.titlePowers.length > 0
        )
    }
    get titlePowers() {
        return this.titlePowerOptions()
    }
    /** Private tile powers under the shared rules. */
    sharedTrackPowers = $derived.by(() => {
        const powers: PrivateTrackPower[] = []
        for (const { privateCompanyId, playerId } of this.decisions.privateTileOptions) {
            const power = { privateCompanyId, playerId }
            if (!powers.some((listed) => samePower(listed, power))) powers.push(power)
        }
        return powers
    })
    trackPowers = $derived.by(() => [
        ...this.sharedTrackPowers,
        ...this.titlePowers
            .filter((power) => power.kind === 'track')
            .map(({ privateCompanyId, playerId }) => ({ privateCompanyId, playerId }))
    ])
    private choosableTitlePowers = $derived.by(() =>
        this.titlePowers.filter((power) => power.kind === 'location' || power.kind === 'confirm')
    )
    private powerSelection = $derived.by(() => {
        const { state } = this.session
        if (
            !this.session.selectionsVisible ||
            (this.selection !== 'powers' && !state.privateTrackLay && !state.privatePowerWindow)
        )
            return undefined
        const selected = this.stages.entry('power')
        if (
            selected &&
            [...this.trackPowers, ...this.titlePowers].some((power) =>
                samePower(power, selected.value)
            )
        )
            return selected
        if (this.offeredPower) return { value: this.offeredPower, source: 'auto' as const }
        // A lone power needs no choice; an immediate one still waits to be pressed.
        const powers = [...this.trackPowers, ...this.choosableTitlePowers]
        return powers.length === 1 && this.titlePowers.every((power) => power.kind !== 'immediate')
            ? {
                  value: {
                      privateCompanyId: powers[0].privateCompanyId,
                      playerId: powers[0].playerId
                  },
                  source: 'auto' as const
              }
            : undefined
    })
    trackPowerSelection = $derived.by(() => {
        const selected = this.powerSelection
        return selected && this.trackPowers.some((power) => samePower(power, selected.value))
            ? selected
            : undefined
    })
    /** The chosen power when the title applies its rules. */
    titlePower = $derived.by(() => {
        const selected = this.powerSelection?.value
        return selected ? this.titlePowers.find((power) => samePower(power, selected)) : undefined
    })

    choosePowers() {
        this.chooseSource('powers')
    }
    choosePurchaseSource(source: 'mine' | 'other') {
        this.chooseSource(source)
    }
    // A power started from its own Use button opens the powers source for it, so Undo
    // returns to where the player was in one step.
    startTrackPower(power: PrivateTrackPower) {
        this.chooseSource('powers', 'auto')
        this.chooseTrackPower(power)
    }
    chooseTrackPower(power: PrivateTrackPower) {
        assert(
            this.trackPowers.some((option) => samePower(option, power)),
            'Choose an available private tile power'
        )
        this.track.clear()
        this.stages.choose('power', power)
    }
    startTitlePower(power: TitlePrivatePower) {
        if (power.kind !== 'immediate') this.chooseSource('powers', 'auto')
        this.chooseTitlePower(power)
    }
    /** Every power the private offers now, under the shared rules or the title's own. */
    powersFor(privateCompanyId: string): (PrivateTrackPower | TitlePrivatePower)[] {
        return [
            ...this.sharedTrackPowers.filter(
                (power) => power.privateCompanyId === privateCompanyId
            ),
            ...this.titlePowers.filter((power) => power.privateCompanyId === privateCompanyId)
        ]
    }
    chooseTitlePower(power: TitlePrivatePower) {
        if (power.kind === 'immediate') {
            void power.run()
            return
        }
        this.track.clear()
        this.stages.choose('power', {
            privateCompanyId: power.privateCompanyId,
            playerId: power.playerId
        })
    }

    /** Leaves private actions, discarding everything chosen under them. */
    close() {
        this.track.clear()
        this.decisions.choice.clear()
        this.stages.clear()
        this.offerDeclined = true
    }
    hasManual() {
        return this.stages.hasManual()
    }
    undo() {
        if ((this.stages.hasManual() || this.trackPowerSelection) && this.track.undo()) return true
        const power = this.titlePower
        if (power?.kind === 'track' && power.undo?.()) return true
        if (!this.stages.undo()) return false
        if (!this.stages.hasManual()) this.stages.clear()
        return true
    }
    clear() {
        this.stages.clear()
    }

    private chooseSource(source: PrivateActionSource, from: 'manual' | 'auto' = 'manual') {
        this.track.clear()
        this.decisions.choice.clear()
        this.stages.choose('source', source, from)
    }
}
