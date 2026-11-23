import { assert, assertExists } from '@tabletop/common'
import type { EighteenXXState, TrackLayDetails } from '@tabletop/18xx'
import type { TitleTrackConstruction } from './trackModule.svelte.js'
import type { CompanyDecisionsModule } from './companyDecisionsModule.svelte.js'
import type { LocalSelection } from '@tabletop/frontend-components'
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
              construction: TitleTrackConstruction
              commit(details: TrackLayDetails): Promise<void>
              /** Ends a power that allows several lays with the lays staged so far. */
              finish?: { label: string; run(): Promise<void> }
              /** Steps back through lays staged so far. */
              undo?(): boolean
          }
        | {
              kind: 'location'
              locationIds: readonly string[]
              /** Offers the power in the station step as a button with this label. */
              stationStepLabel?: string
              /** Chooses a hex, with the city or town clicked within it when there was one. */
              choose(locationId: string, nodeId?: string): Promise<void>
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
export type PrivateListedPower = PrivateTrackPower & { kind: 'listed' }
export type PrivatePower = PrivateTrackPower | TitlePrivatePower | PrivateListedPower
export type PrivateActionSource = 'mine' | 'other' | 'powers'
type ChosenPower = PrivateTrackPower & { label?: string }
type PrivateActionStages = { source: PrivateActionSource; power: ChosenPower }
const PrivateActionStageOrder = ['source', 'power'] as const

export type PrivateActionsSession = ModuleSession<
    Pick<EighteenXXState, 'privateTrackLay' | 'privatePowerWindow'>,
    unknown
>
type Decisions = Pick<
    CompanyDecisionsModule,
    | 'choice'
    | 'privateTileOptions'
    | 'privateTrainOptions'
    | 'privateMarkerOptions'
    | 'privateTokenOptions'
>
type TrackSelection = Pick<LocalSelection, 'undo' | 'clear'>
type Exchanges = Pick<PrivatesModule, 'exchangeOptions'>

function samePower(left: PrivateTrackPower, right: PrivateTrackPower) {
    return left.privateCompanyId === right.privateCompanyId && left.playerId === right.playerId
}

function distinctPowers(options: readonly PrivateTrackPower[]): PrivateTrackPower[] {
    const powers: PrivateTrackPower[] = []
    for (const { privateCompanyId, playerId } of options) {
        const power = { privateCompanyId, playerId }
        if (!powers.some((listed) => samePower(listed, power))) powers.push(power)
    }
    return powers
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
    private get powersWithOwnButtons() {
        return this.listedPowers.length > 0 || this.exchanges.exchangeOptions.length > 0
    }
    get powersAvailable() {
        return (
            this.decisions.privateTileOptions.length > 0 ||
            this.powersWithOwnButtons ||
            this.titlePowers.length > 0
        )
    }
    get titlePowers() {
        return this.titlePowerOptions()
    }
    /** Private tile powers under the shared rules. */
    sharedTrackPowers = $derived.by(() => distinctPowers(this.decisions.privateTileOptions))
    private listedPowers = $derived.by((): PrivateListedPower[] =>
        distinctPowers([
            ...this.decisions.privateMarkerOptions,
            ...this.decisions.privateTokenOptions,
            ...this.decisions.privateTrainOptions.map((option) => {
                const { playerId } = this.session
                assertExists(playerId, 'Only a player is offered a private train')
                return { privateCompanyId: option.privateCompanyId, playerId }
            })
        ]).map((power) => ({ ...power, kind: 'listed' }))
    )
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
        // A lone power needs no choice; an immediate one still waits to be pressed, and a power
        // with its own button, such as a free station, leaves the player a choice to make.
        const powers = [...this.trackPowers, ...this.choosableTitlePowers]
        return powers.length === 1 &&
            !this.powersWithOwnButtons &&
            this.titlePowers.every((power) => power.kind !== 'immediate')
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
        const selected: ChosenPower | undefined = this.powerSelection?.value
        return selected
            ? this.titlePowers.find(
                  (power) =>
                      samePower(power, selected) &&
                      (selected.label === undefined || selected.label === power.label)
              )
            : undefined
    })

    choosePowers() {
        this.chooseSource('powers')
    }
    // Buying from another player is rare, so purchases open on the player's own privates.
    openPurchases() {
        this.chooseSource('mine')
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
    powersFor(privateCompanyId: string): PrivatePower[] {
        const ofPrivate = (power: PrivateTrackPower) => power.privateCompanyId === privateCompanyId
        const powers: PrivatePower[] = [
            ...this.sharedTrackPowers.filter(ofPrivate),
            ...this.titlePowers.filter(ofPrivate)
        ]
        return powers.length ? powers : this.listedPowers.filter(ofPrivate)
    }
    startPower(power: PrivatePower) {
        if (!('kind' in power)) this.startTrackPower(power)
        else if (power.kind === 'listed') this.startListedPower(power)
        else this.startTitlePower(power)
    }
    isChosen(power: PrivatePower): boolean {
        if ('kind' in power && power.kind === 'listed')
            return this.selection === 'powers' && !this.powerSelection
        const chosen = this.titlePower ?? this.trackPowerSelection?.value
        return (
            chosen !== undefined &&
            samePower(chosen, power) &&
            (!('label' in chosen) || !('label' in power) || chosen.label === power.label)
        )
    }
    private startListedPower(power: PrivateListedPower) {
        assert(
            this.listedPowers.some((option) => samePower(option, power)),
            'Choose an available private power'
        )
        if (this.selection !== 'powers') this.choosePowers()
    }
    chooseTitlePower(power: TitlePrivatePower) {
        if (power.kind === 'immediate') {
            void power.run()
            return
        }
        this.track.clear()
        this.stages.choose('power', {
            privateCompanyId: power.privateCompanyId,
            playerId: power.playerId,
            label: power.label
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
