import {
    HydratedOathGameState,
    applyPeoplesFavorStep,
    ActionType,
    Banner,
    bannerHolder,
    ConsentRequestKind,
    HydratedCompleteRest,
    HydratedOfferCitizenship,
    HydratedResolveCitizenshipOffer,
    HydratedResolveWake,
    HydratedUseActionPower,
    HydratedUseRestPower,
    MachineState,
    PlayerStatus,
    PowerChoiceKind,
    availableImperialWarbands,
    availablePeoplesFavorOptions,
    availableSitePowerTakes,
    banksWithLeastFavor,
    canUseSitePower,
    citizenshipReplacementGroups,
    endDieIsRolled,
    powerKey,
    requiredFavorSteps,
    usableFavor,
    type CitizenshipTerms,
    type LegalPowerUse,
    type OpportunityTake,
    type PowerChoice,
    type PowerUseKey,
    type Suit,
    type WakeFavorStep,
    type WarbandGroup,
    OathRevision,
    isAtLeastOathRevision
} from '@tabletop/oath'
import { assert, assertExists, range } from '@tabletop/common'
import {
    citizenshipConversion,
    pickPiece,
    piecesByPlace,
    replacementGroups,
    type Conversion,
    type PiecePlace
} from './citizenshipAnswer.js'
import {
    emptyPicks,
    favorBankSuits,
    picksComplete,
    powerChoicesFrom,
    type PowerChoicePicks
} from './powerChoices.js'
import { samePowerUse } from './powerUse.js'
import { StagedFlow, type PanelDraft, type StagesCover } from './stagedFlow.svelte.js'
import type { OathGameSession } from './session.svelte.js'
import { restBankChoice, restRows, type RestRow } from './restRows.js'
import { suitName } from './names.js'

/** The panel drafts with one step: Undo clears the draft, and the derived default returns. */
abstract class OneStepDraft<V> implements PanelDraft {
    private flow = new StagedFlow<{ draft: V }>(['draft'])

    constructor(protected readonly session: OathGameSession) {}

    protected get stored(): V | undefined {
        return this.flow.value('draft')
    }

    protected store(value: V): void {
        this.flow.set('draft', value)
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    back(): boolean {
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }
}

export type FavorStepKind = 'place' | 'return'
type SiteTake = OpportunityTake | 'nothing'
type WakeValueByStage = {
    firstKind: FavorStepKind
    firstBank: Suit
    secondKind: FavorStepKind
    secondBank: Suit
    siteTake: SiteTake
}

const WAKE_STAGE_ORDER = ['firstKind', 'firstBank', 'secondKind', 'secondBank', 'siteTake'] as const
const _wakeStagesAreCovered: StagesCover<WakeValueByStage, typeof WAKE_STAGE_ORDER> = true
void _wakeStagesAreCovered

/** R-4.1.1.II — "repeat R-4.1.1.I once": the People's Favor resolves at most twice. */
const FAVOR_STEP_STAGES = [
    { kind: 'firstKind', bank: 'firstBank' },
    { kind: 'secondKind', bank: 'secondBank' }
] as const

/** The one Wake choice on screen: a People's Favor step, the bank of its return, or the site's take. */
export type WakeQuestion =
    | { kind: 'favorStep'; index: number; options: FavorStepKind[] }
    | { kind: 'returnBank'; index: number; banks: Suit[] }
    | { kind: 'siteTake'; takes: OpportunityTake[] }

type FavorStepView = {
    options: FavorStepKind[]
    leastBanks: Suit[]
    kind?: FavorStepKind
    step?: WakeFavorStep
}

function favorStepLine(step: WakeFavorStep): string {
    return step.kind === 'place'
        ? 'Placed 1 favor.'
        : `Returned 1 favor to the ${suitName(step.toSuit)} bank.`
}

/**
 * R-4.1.1 to R-4.1.4 — the Wake asks one choice at a time: each People's Favor step, then the
 * site power's take. Each tap is its own pick, and the tap that answers the last choice sends
 * the Wake; a choice with one legal answer is taken without a tap.
 */
export class WakeDraft implements PanelDraft {
    private flow = new StagedFlow<WakeValueByStage>(WAKE_STAGE_ORDER)

    constructor(private readonly session: OathGameSession) {}

    private get playerId(): string | undefined {
        return this.session.gameState.machineState === MachineState.WakePhase
            ? this.session.liveTurnSeatId
            : undefined
    }

    // R-4.1.1 is mandatory for the holder alone; `requiredFavorSteps` counts the steps the
    // holder is able to take (R-9.2.a) without asking who holds it.
    get stepCount(): number {
        const playerId = this.playerId
        return playerId !== undefined &&
            bannerHolder(this.session.gameState, Banner.PeoplesFavor) === playerId
            ? requiredFavorSteps(this.session.gameState, playerId)
            : 0
    }

    private stagesOf(index: number) {
        const stages = FAVOR_STEP_STAGES[index]
        assertExists(stages, 'R-4.1.1.II — the People’s Favor resolves at most twice')
        return stages
    }

    // R-4.1.1-H1 — each step is judged on the banks as the steps before it leave them; a step
    // with neither option open is skipped (R-9.2.a).
    private get steps(): FavorStepView[] {
        const playerId = this.playerId
        if (!playerId) return []
        const rehearsal = new HydratedOathGameState(this.session.gameState.dehydrate())
        const views: FavorStepView[] = []
        for (const index of range(0, this.stepCount)) {
            const options = availablePeoplesFavorOptions(rehearsal, playerId)
            if (options.length === 0) break
            const leastBanks = banksWithLeastFavor(rehearsal)
            const stages = this.stagesOf(index)
            const pickedKind = this.flow.value(stages.kind)
            const kind =
                pickedKind !== undefined && options.includes(pickedKind)
                    ? pickedKind
                    : options.length === 1
                      ? options[0]
                      : undefined
            const pickedBank = this.flow.value(stages.bank)
            const bank =
                pickedBank !== undefined && leastBanks.includes(pickedBank)
                    ? pickedBank
                    : leastBanks.length === 1
                      ? leastBanks[0]
                      : undefined
            const step: WakeFavorStep | undefined =
                kind === 'place'
                    ? { kind }
                    : kind === 'return' && bank !== undefined
                      ? { kind, toSuit: bank }
                      : undefined
            views.push({ options, leastBanks, kind, step })
            if (!step) break
            applyPeoplesFavorStep(rehearsal, playerId, step)
        }
        return views
    }

    // R-4.1.4-H1 — the engine knows what the site prints and what is on it.
    get sitePowerTakes(): OpportunityTake[] {
        return this.playerId ? availableSitePowerTakes(this.session.gameState, this.playerId) : []
    }

    get sitePowerOffered(): boolean {
        return this.playerId !== undefined && canUseSitePower(this.session.gameState, this.playerId)
    }

    get siteCardId(): string | undefined {
        const playerId = this.playerId
        if (!playerId) return undefined
        const state = this.session.gameState
        return state.siteCardAt(state.getPlayerState(playerId).siteId)
    }

    private get siteTake(): SiteTake | undefined {
        const take = this.flow.value('siteTake')
        return take === 'nothing' || (take !== undefined && this.sitePowerTakes.includes(take))
            ? take
            : undefined
    }

    get question(): WakeQuestion | undefined {
        const steps = this.steps
        const open = steps.findIndex((view) => view.step === undefined)
        const view = steps[open]
        if (view) {
            return view.kind === 'return'
                ? { kind: 'returnBank', index: open, banks: view.leastBanks }
                : { kind: 'favorStep', index: open, options: view.options }
        }
        if (this.sitePowerOffered && this.siteTake === undefined) {
            return { kind: 'siteTake', takes: this.sitePowerTakes }
        }
        return undefined
    }

    /** Each People's Favor step already answered, by a tap or because it had one answer. */
    get answeredLines(): string[] {
        return this.favorSteps.map(favorStepLine)
    }

    /** "End Wake Phase" is offered only when the Wake asks nothing: every step had one answer. */
    get readyToEnd(): boolean {
        return (
            this.playerId !== undefined && this.question === undefined && !this.hasManualSelection()
        )
    }

    private get favorSteps(): WakeFavorStep[] {
        return this.steps.flatMap(({ step }) => (step ? [step] : []))
    }

    private get sitePowerTake(): OpportunityTake | undefined {
        const take = this.siteTake
        return take === 'nothing' ? undefined : take
    }

    /** The engine's refusal of the answered Wake, shown if a send would be refused. */
    get refusedBecause(): string | undefined {
        const playerId = this.playerId
        if (!playerId || this.question !== undefined) return undefined
        return HydratedResolveWake.reasonCannotResolveWake(
            this.session.gameState,
            playerId,
            this.favorSteps,
            this.sitePowerTake
        )
    }

    async chooseKind(kind: FavorStepKind): Promise<void> {
        const question = this.question
        if (question?.kind !== 'favorStep' || !question.options.includes(kind)) return
        this.flow.set(this.stagesOf(question.index).kind, kind)
        await this.sendWhenAnswered()
    }

    async chooseBank(suit: Suit): Promise<void> {
        const question = this.question
        if (question?.kind !== 'returnBank' || !question.banks.includes(suit)) return
        this.flow.set(this.stagesOf(question.index).bank, suit)
        await this.sendWhenAnswered()
    }

    async chooseSiteTake(take: OpportunityTake | undefined): Promise<void> {
        const question = this.question
        if (question?.kind !== 'siteTake') return
        if (take !== undefined && !question.takes.includes(take)) return
        this.flow.set('siteTake', take ?? 'nothing')
        await this.sendWhenAnswered()
    }

    async end(): Promise<void> {
        if (this.readyToEnd) await this.sendWhenAnswered()
    }

    private async sendWhenAnswered(): Promise<void> {
        if (!this.playerId || this.question !== undefined || this.refusedBecause !== undefined) {
            return
        }
        await this.session.resolveWake(this.favorSteps, this.sitePowerTake)
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    back(): boolean {
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }
}

/** R-4.3.5, R-7.3.4 — the favor bank each Rest power's gain comes from. */
export class RestDraft extends OneStepDraft<Record<string, Suit>> {
    private get playerId(): string | undefined {
        return this.session.gameState.machineState === MachineState.RestPhase
            ? this.session.liveTurnSeatId
            : undefined
    }

    get powers() {
        return this.playerId
            ? HydratedUseRestPower.legalRestPowers(this.session.gameState, this.playerId)
            : []
    }

    bankOptions(power: LegalPowerUse): Suit[] {
        const bank = power.choices.find((c) => c.spec.kind === PowerChoiceKind.FavorBank)
        return favorBankSuits(bank?.options ?? [])
    }

    // No default where the player has a choice: a single bank offered is taken as picked.
    pickedSuit(power: LegalPowerUse): Suit | undefined {
        const options = this.bankOptions(power)
        const chosen = this.stored?.[powerKey(power.cardId, power.powerIndex)]
        if (chosen !== undefined && options.includes(chosen)) return chosen
        return options.length === 1 ? options[0] : undefined
    }

    /** "Use" waits for the bank, when the power offers a choice of them. */
    bankPicked(power: LegalPowerUse): boolean {
        return this.bankOptions(power).length === 0 || this.pickedSuit(power) !== undefined
    }

    choicesFor(power: LegalPowerUse): PowerChoice[] {
        const suit = this.pickedSuit(power)
        return suit === undefined ? [] : [{ kind: PowerChoiceKind.FavorBank, suit }]
    }

    pickBank(power: LegalPowerUse, suit: Suit): void {
        if (!this.bankOptions(power).includes(suit)) return
        this.store({ ...this.stored, [powerKey(power.cardId, power.powerIndex)]: suit })
    }

    reasonCannotUse(power: LegalPowerUse): string | undefined {
        const playerId = this.session.myPlayer?.id
        assertExists(playerId, 'A Rest power is used from a seat')
        if (power.choices.some((c) => c.spec.kind !== PowerChoiceKind.FavorBank))
            return 'this power asks a choice this panel does not offer'
        return HydratedUseRestPower.reasonCannotUse(
            this.session.gameState,
            playerId,
            power.cardId,
            power.powerIndex,
            this.choicesFor(power)
        )
    }

    // R-3.3 — the last turn of the round, from round 5, while the Empire holds the title.
    get rollsEndDie(): boolean {
        const playerId = this.session.myPlayer?.id
        assertExists(playerId, 'The Rest Phase is shown to a seat')
        const state = this.session.gameState
        return HydratedCompleteRest.isLastTurnOfRound(state, playerId) && endDieIsRolled(state)
    }

    get completeBlockedBecause(): string | undefined {
        const playerId = this.session.myPlayer?.id
        assertExists(playerId, 'The Rest Phase is completed from a seat')
        return HydratedCompleteRest.reasonCannotCompleteRest(this.session.gameState, playerId)
    }

    async use(power: LegalPowerUse): Promise<void> {
        if (!this.playerId) return
        await this.session.useRestPower(power.cardId, power.powerIndex, this.choicesFor(power))
    }

    /** R-X.4 — a game created before the turn-flow revision keeps its Rest panel. */
    get turnFlow(): boolean {
        return isAtLeastOathRevision(this.session.gameState, OathRevision.TurnFlow)
    }

    get rows(): RestRow[] {
        return this.playerId ? restRows(this.session.gameState, this.playerId) : []
    }

    async useWithBank(row: RestRow, suit: Suit): Promise<void> {
        if (!this.playerId) return
        await this.session.useRestPower(row.cardId, row.powerIndex, restBankChoice(suit))
    }

    async useAlone(row: RestRow): Promise<void> {
        if (!this.playerId) return
        await this.session.useRestPower(row.cardId, row.powerIndex, [])
    }
}

/** R-6.2, R-7.3.2 — the choices each "Action:" power's text opens. */
export class ActionPowersDraft extends OneStepDraft<Record<string, PowerChoicePicks>> {
    private get playerId(): string | undefined {
        return this.session.selection.action === ActionType.UseActionPower
            ? this.session.liveTurnSeatId
            : undefined
    }

    get powers() {
        return this.playerId
            ? HydratedUseActionPower.legalActionPowers(this.session.gameState, this.playerId)
            : []
    }

    picksOf(use: PowerUseKey): PowerChoicePicks {
        return this.stored?.[powerKey(use.cardId, use.powerIndex)] ?? emptyPicks()
    }

    setPicks(use: PowerUseKey, picks: PowerChoicePicks): void {
        if (!this.powers.some((p) => samePowerUse(p, use))) {
            return
        }
        this.store({ ...this.stored, [powerKey(use.cardId, use.powerIndex)]: picks })
    }

    /** "Use" waits until every choice the power opens has its picks. */
    picksComplete(power: LegalPowerUse): boolean {
        return picksComplete(power.choices, this.picksOf(power))
    }

    choicesFor(power: LegalPowerUse): PowerChoice[] {
        return powerChoicesFrom(power.choices, this.picksOf(power))
    }

    reasonCannotUse(power: LegalPowerUse): string | undefined {
        const playerId = this.session.myPlayer?.id
        assertExists(playerId, 'An Action power is used from a seat')
        return HydratedUseActionPower.reasonCannotUse(
            this.session.gameState,
            playerId,
            power.cardId,
            power.powerIndex,
            this.choicesFor(power)
        )
    }

    async use(power: LegalPowerUse): Promise<void> {
        if (!this.playerId) return
        await this.session.useActionPower(power.cardId, power.powerIndex, this.choicesFor(power))
    }
}

type OfferTerms = {
    givenFavor: number
    givenSecrets: number
    givenRelics: string[]
    givenBanners: Banner[]
    askedFavor: number
    askedSecrets: number
    askedRelics: string[]
    askedBanners: Banner[]
}
type TermCount = 'givenFavor' | 'givenSecrets' | 'askedFavor' | 'askedSecrets'
type TermList = 'givenRelics' | 'givenBanners' | 'askedRelics' | 'askedBanners'
// The terms stage keeps the terms after each pick, so Back and Undo take one pick at a time.
type CitizenshipValueByStage = { exile: string; reliquarySlot: string; terms: OfferTerms[] }

const CITIZENSHIP_STAGE_ORDER = ['exile', 'reliquarySlot', 'terms'] as const
const _citizenshipStagesAreCovered: StagesCover<
    CitizenshipValueByStage,
    typeof CITIZENSHIP_STAGE_ORDER
> = true
void _citizenshipStagesAreCovered

type SideHoldings = { favor: number; secrets: number; relicIds: string[]; banners: Banner[] }

const NO_TERMS: OfferTerms = {
    givenFavor: 0,
    givenSecrets: 0,
    givenRelics: [],
    givenBanners: [],
    askedFavor: 0,
    askedSecrets: 0,
    askedRelics: [],
    askedBanners: []
}

function transferOf(favor: number, secrets: number, relicCardIds: string[], banners: Banner[]) {
    if (favor === 0 && secrets === 0 && relicCardIds.length === 0 && banners.length === 0) {
        return undefined
    }
    return {
        favor: favor || undefined,
        secrets: secrets || undefined,
        relicCardIds: relicCardIds.length > 0 ? relicCardIds : undefined,

        banners: banners.length > 0 ? banners : undefined
    }
}

/** R-6.6.1, R-9.6 — an offer of Citizenship: the Exile, the relic space, then the terms. */
export class CitizenshipDraft implements PanelDraft {
    private flow = new StagedFlow<CitizenshipValueByStage>(CITIZENSHIP_STAGE_ORDER)

    constructor(private readonly session: OathGameSession) {}

    private get playerId(): string | undefined {
        return this.session.selection.action === ActionType.OfferCitizenship
            ? this.session.liveTurnSeatId
            : undefined
    }

    // R-6.6.1 — "any Exile (including yourself)".
    get exiles() {
        return this.playerId
            ? this.session.gameState.players
                  .filter((p) => p.status === PlayerStatus.Exile)
                  .map((p) => p.playerId)
            : []
    }

    // R-2.3 — the spaces still holding a relic.
    get spaces() {
        return this.playerId ? this.session.gameState.reliquarySlots() : []
    }

    // One legal option is not a choice: it is read as picked, and never stored, so Back skips it.
    get exilePlayerId(): string | undefined {
        const exiles = this.exiles
        const playerId = this.flow.value('exile')
        if (playerId !== undefined && exiles.includes(playerId)) return playerId
        return exiles.length === 1 ? exiles[0] : undefined
    }

    get reliquarySlotId(): string | undefined {
        if (!this.exilePlayerId) return undefined
        const spaces = this.spaces
        const slotId = this.flow.value('reliquarySlot')
        if (slotId !== undefined && spaces.some((s) => s.slotId === slotId)) return slotId
        return spaces.length === 1 ? spaces[0].slotId : undefined
    }

    get offerTerms(): OfferTerms {
        return this.reliquarySlotId ? (this.flow.value('terms')?.at(-1) ?? NO_TERMS) : NO_TERMS
    }

    // R-6.6.1 — favor, secrets, banners and non-Reliquary relics, each way. Omitted rather than
    // sent as empty transfers: the schema makes `terms` optional.
    get terms(): CitizenshipTerms | undefined {
        const t = this.offerTerms
        const fromScepterHolder = transferOf(
            t.givenFavor,
            t.givenSecrets,
            t.givenRelics,
            t.givenBanners
        )
        const fromExile = transferOf(t.askedFavor, t.askedSecrets, t.askedRelics, t.askedBanners)
        if (!fromScepterHolder && !fromExile) return undefined
        return { fromScepterHolder, fromExile }
    }

    get holdings(): { offerer: SideHoldings; exile: SideHoldings } {
        const exilePlayerId = this.exilePlayerId
        assertExists(exilePlayerId, 'The terms are set once the Exile is chosen')
        return { offerer: this.holdingsOf(this.offererId), exile: this.holdingsOf(exilePlayerId) }
    }

    private get offererId(): string {
        const playerId = this.playerId
        assertExists(playerId, 'An Exile is chosen only from the live seat')
        return playerId
    }

    private holdingsOf(playerId: string): SideHoldings {
        const state = this.session.gameState
        const player = state.getPlayerState(playerId)
        return {
            favor: usableFavor(state, playerId),
            secrets: player.secrets,
            relicIds: player.relicIds,
            banners: Object.values(Banner).filter(
                (banner) => bannerHolder(state, banner) === playerId
            )
        }
    }

    get blockedBecause(): string | undefined {
        const exilePlayerId = this.exilePlayerId
        const reliquarySlotId = this.reliquarySlotId
        if (!exilePlayerId || !reliquarySlotId) return 'Choose an Exile and a relic.'
        const playerId = this.offererId
        return HydratedOfferCitizenship.reasonCannotOffer(this.session.gameState, playerId, {
            exilePlayerId,
            reliquarySlotId,
            terms: this.terms
        })
    }

    chooseExile(playerId: string): void {
        if (this.exiles.includes(playerId)) this.flow.set('exile', playerId)
    }

    chooseReliquarySlot(slotId: string): void {
        if (this.exilePlayerId && this.spaces.some((s) => s.slotId === slotId)) {
            this.flow.set('reliquarySlot', slotId)
        }
    }

    setTerm(term: TermCount, amount: number): void {
        if (this.reliquarySlotId) {
            this.pickTerms({ ...this.offerTerms, [term]: Math.max(0, amount) })
        }
    }

    toggleRelic(term: 'givenRelics' | 'askedRelics', relicId: string, on: boolean): void {
        const side = term === 'givenRelics' ? 'offerer' : 'exile'
        if (!this.reliquarySlotId || !this.holdings[side].relicIds.includes(relicId)) return
        this.setList(term, relicId, on)
    }

    toggleBanner(term: 'givenBanners' | 'askedBanners', banner: Banner, on: boolean): void {
        const side = term === 'givenBanners' ? 'offerer' : 'exile'
        if (!this.reliquarySlotId || !this.holdings[side].banners.includes(banner)) return
        this.setList(term, banner, on)
    }

    private setList<T extends string>(term: TermList, item: T, on: boolean): void {
        const terms = this.offerTerms
        const rest = terms[term].filter((listed) => listed !== item)
        this.pickTerms({ ...terms, [term]: on ? [...rest, item] : rest })
    }

    // A tap that changes nothing is no pick for Undo to take back.
    private pickTerms(next: OfferTerms): void {
        if (JSON.stringify(next) === JSON.stringify(this.offerTerms)) return
        this.flow.set('terms', [...(this.flow.value('terms') ?? []), next])
    }

    async offer(): Promise<void> {
        const exilePlayerId = this.exilePlayerId
        const reliquarySlotId = this.reliquarySlotId
        if (this.blockedBecause || !exilePlayerId || !reliquarySlotId) return
        await this.session.offerCitizenship(exilePlayerId, reliquarySlotId, this.terms)
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    back(): boolean {
        const picks = this.flow.value('terms')
        if (picks !== undefined && picks.length > 1) {
            this.flow.set('terms', picks.slice(0, -1))
            return true
        }
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }
}

/** R-6.6.2, R-9.3 — which of the Exile's warbands become Imperial, one entry for every pick. */
export class ConsentDraft extends OneStepDraft<string[]> {
    private get playerId(): string | undefined {
        const pending = this.session.gameState.pendingConsent
        const playerId = this.session.liveSeatId
        return pending?.request.kind === ConsentRequestKind.CitizenshipOffer &&
            playerId !== undefined &&
            pending.askedPlayerId === playerId
            ? playerId
            : undefined
    }

    private get groups(): WarbandGroup[] {
        return this.playerId
            ? citizenshipReplacementGroups(this.session.gameState, this.playerId)
            : []
    }

    get conversion(): Conversion {
        return citizenshipConversion(this.groups, availableImperialWarbands(this.session.gameState))
    }

    get places(): PiecePlace[] {
        return piecesByPlace(this.groups)
    }

    private get pieceKeys(): string[] {
        return this.places.flatMap((place) => place.pieces.map((piece) => piece.key))
    }

    get canPick(): boolean {
        return this.conversion.kind === 'short'
    }

    // The default is the first pieces the Empire can cover, in the engine's order.
    get picked(): string[] {
        if (!this.canPick) return []
        const keys = this.pieceKeys
        const stored = this.stored
        if (stored?.every((key) => keys.includes(key))) return stored
        return keys.slice(0, this.conversion.imperial)
    }

    /** R1 — every piece the Empire covers is picked, so Accept can show. */
    get picksComplete(): boolean {
        return !this.canPick || this.picked.length === this.conversion.imperial
    }

    isImperial(key: string): boolean {
        return this.conversion.kind === 'enough' || this.picked.includes(key)
    }

    pick(key: string): void {
        if (!this.canPick) return
        assert(this.pieceKeys.includes(key), `${key} is not one of the Exile's warbands`)
        this.store(pickPiece(this.picked, key, this.conversion.imperial))
    }

    get replacementChoice(): WarbandGroup[] | undefined {
        if (this.conversion.kind === 'enough') return undefined
        return replacementGroups(this.groups, this.picked)
    }

    get blockedBecause(): string | undefined {
        const playerId = this.session.myPlayer?.id
        assertExists(playerId, 'A Citizenship offer is answered from a seat')
        return HydratedResolveCitizenshipOffer.reasonCannotResolve(
            this.session.gameState,
            playerId,
            { granted: true, replacementChoice: this.replacementChoice }
        )
    }

    async answer(granted: boolean): Promise<void> {
        if (!this.playerId) return
        await this.session.answerCitizenshipOffer(
            granted,
            granted ? this.replacementChoice : undefined
        )
    }
}

type SeatCardPeekValueByStage = { open: true; subject: string }

const SEAT_CARD_PEEK_STAGE_ORDER = ['open', 'subject'] as const
const _seatCardPeekStagesAreCovered: StagesCover<
    SeatCardPeekValueByStage,
    typeof SEAT_CARD_PEEK_STAGE_ORDER
> = true
void _seatCardPeekStagesAreCovered

/**
 * R-9.4 — outside this seat's Act Phase the seat card opens the let-peek picker on its own:
 * opening it is one pick, and the card to show is the next.
 */
export class SeatCardPeekDraft implements PanelDraft {
    private flow = new StagedFlow<SeatCardPeekValueByStage>(SEAT_CARD_PEEK_STAGE_ORDER)

    get open(): boolean {
        return this.flow.value('open') === true
    }

    /** The key of the card tapped to show (`letPeekKey`), if any. */
    get subject(): string | undefined {
        return this.flow.value('subject')
    }

    toggle(): void {
        if (this.open) this.reset()
        else this.flow.set('open', true)
    }

    pick(key: string): void {
        assert(this.open, 'A card to show is picked in the open picker')
        this.flow.set('subject', key)
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    back(): boolean {
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }
}
