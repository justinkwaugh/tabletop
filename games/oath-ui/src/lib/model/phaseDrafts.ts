import {
    HydratedOathGameState,
    applyPeoplesFavorStep,
    reasonCannotTakePeoplesFavorStep,
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
    forceTotal,
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
import { assertExists, range } from '@tabletop/common'
import {
    emptyPicks,
    favorBankSuits,
    powerChoicesFrom,
    type PowerChoicePicks
} from './powerChoices.js'
import { samePowerUse } from './powerUse.js'
import { StagedFlow, type PanelDraft, type StagesCover } from './stagedFlow.svelte.js'
import type { OathGameSession } from './session.svelte.js'
import { restBankChoice, restRows, type RestRow } from './restRows.js'

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
type WakeChoices = { kinds?: FavorStepKind[]; suits?: (Suit | undefined)[]; take?: OpportunityTake }

/** R-4.1.1 to R-4.1.4 — the People's Favor steps and the site power's take, before the Wake resolves. */
export class WakeDraft extends OneStepDraft<WakeChoices> {
    private get playerId(): string | undefined {
        return this.session.gameState.machineState === MachineState.WakePhase
            ? this.session.liveTurnSeatId
            : undefined
    }

    // R-4.1.1 is mandatory for the holder alone; `requiredFavorSteps` counts the steps the
    // holder is able to take (R-9.2.a) without asking who holds it.
    get holdsPeoplesFavor() {
        return (
            this.playerId !== undefined &&
            bannerHolder(this.session.gameState, Banner.PeoplesFavor) === this.playerId
        )
    }

    get stepCount() {
        return this.holdsPeoplesFavor && this.playerId
            ? requiredFavorSteps(this.session.gameState, this.playerId)
            : 0
    }

    // R-4.1.1-H1 — each step is judged on the banks as the steps before it leave them.
    private get steps(): {
        options: FavorStepKind[]
        leastBanks: Suit[]
        kind: FavorStepKind
        suit?: Suit
    }[] {
        const playerId = this.playerId
        if (!playerId) return []
        const rehearsal = new HydratedOathGameState(this.session.gameState.dehydrate())
        return range(0, this.stepCount).map((index) => {
            const options = availablePeoplesFavorOptions(rehearsal, playerId)
            const leastBanks = banksWithLeastFavor(rehearsal)
            const storedKind = this.stored?.kinds?.[index]
            const kind =
                storedKind !== undefined && options.includes(storedKind)
                    ? storedKind
                    : options.length === 1
                      ? options[0]
                      : 'place'
            const storedSuit = this.stored?.suits?.[index]
            const suit =
                storedSuit !== undefined && leastBanks.includes(storedSuit)
                    ? storedSuit
                    : leastBanks.length === 1
                      ? leastBanks[0]
                      : undefined
            const step: WakeFavorStep | undefined =
                kind === 'place' ? { kind } : suit ? { kind, toSuit: suit } : undefined
            if (step && reasonCannotTakePeoplesFavorStep(rehearsal, playerId, step) === undefined) {
                applyPeoplesFavorStep(rehearsal, playerId, step)
            }
            return { options, leastBanks, kind, suit }
        })
    }

    optionsAt(index: number): FavorStepKind[] {
        return this.steps[index]?.options ?? []
    }

    leastBanksAt(index: number): Suit[] {
        return this.steps[index]?.leastBanks ?? []
    }

    // R-4.1.4-H1 — the engine knows what the site prints and what is on it.
    get sitePowerTakes() {
        return this.playerId ? availableSitePowerTakes(this.session.gameState, this.playerId) : []
    }

    // One option, or one bank tied for least, is not a choice.
    get kinds(): FavorStepKind[] {
        return this.steps.map((step) => step.kind)
    }

    get suits(): (Suit | undefined)[] {
        return this.steps.map((step) => step.suit)
    }

    get sitePowerTake(): OpportunityTake | undefined {
        const take = this.stored?.take
        return take !== undefined && this.sitePowerTakes.includes(take) ? take : undefined
    }

    get favorSteps(): WakeFavorStep[] | undefined {
        const steps: WakeFavorStep[] = []
        for (const [index, kind] of this.kinds.entries()) {
            if (kind === 'place') {
                steps.push({ kind: 'place' })
                continue
            }
            const toSuit = this.suits[index]
            if (toSuit === undefined) return undefined
            steps.push({ kind: 'return', toSuit })
        }
        return steps
    }

    setKind(index: number, kind: FavorStepKind): void {
        if (!this.optionsAt(index).includes(kind)) return
        this.store({ ...this.stored, kinds: this.kinds.with(index, kind), suits: this.suits })
    }

    setSuit(index: number, suit: Suit): void {
        if (!this.leastBanksAt(index).includes(suit)) return
        this.store({ ...this.stored, kinds: this.kinds, suits: this.suits.with(index, suit) })
    }

    setSitePowerTake(take: OpportunityTake | undefined): void {
        this.store({ ...this.stored, take })
    }

    get sitePowerOffered(): boolean {
        return this.playerId !== undefined && canUseSitePower(this.session.gameState, this.playerId)
    }

    get blockedBecause(): string | undefined {
        const playerId = this.session.myPlayer?.id
        assertExists(playerId, 'The Wake is resolved from a seat')
        const favorSteps = this.favorSteps
        if (!favorSteps) return 'Choose which bank the favor returns to.'
        return HydratedResolveWake.reasonCannotResolveWake(
            this.session.gameState,
            playerId,
            favorSteps,
            this.sitePowerTake
        )
    }

    async resolve(): Promise<void> {
        const steps = this.favorSteps
        if (!this.playerId || !steps) return
        await this.session.resolveWake(steps, this.sitePowerTake)
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

    pickedSuit(power: LegalPowerUse): Suit | undefined {
        const options = this.bankOptions(power)
        const chosen = this.stored?.[powerKey(power.cardId, power.powerIndex)]
        return chosen !== undefined && options.includes(chosen) ? chosen : options[0]
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
        return this.playerId
            ? restRows(this.session.gameState, this.playerId, this.session.actions)
            : []
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
type CitizenshipValueByStage = { exile: string; reliquarySlot: string; terms: OfferTerms }

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

    get exilePlayerId(): string | undefined {
        const playerId = this.flow.value('exile')
        return playerId !== undefined && this.exiles.includes(playerId) ? playerId : undefined
    }

    get reliquarySlotId(): string | undefined {
        const slotId = this.flow.value('reliquarySlot')
        return this.exilePlayerId &&
            slotId !== undefined &&
            this.spaces.some((s) => s.slotId === slotId)
            ? slotId
            : undefined
    }

    get offerTerms() {
        return this.reliquarySlotId ? (this.flow.value('terms') ?? NO_TERMS) : NO_TERMS
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
            this.flow.set('terms', { ...this.offerTerms, [term]: Math.max(0, amount) })
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
        this.flow.set('terms', { ...terms, [term]: on ? [...rest, item] : rest })
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
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }
}

/** R-6.6.2, R-9.3 — which warbands become Imperial, when the Empire cannot cover them all. */
export class ConsentDraft extends OneStepDraft<number[]> {
    private get playerId(): string | undefined {
        const pending = this.session.gameState.pendingConsent
        const playerId = this.session.liveSeatId
        return pending?.request.kind === ConsentRequestKind.CitizenshipOffer &&
            playerId !== undefined &&
            pending.askedPlayerId === playerId
            ? playerId
            : undefined
    }

    get groups(): WarbandGroup[] {
        return this.playerId
            ? citizenshipReplacementGroups(this.session.gameState, this.playerId)
            : []
    }

    get imperialAvailable() {
        return availableImperialWarbands(this.session.gameState)
    }

    get mustChoose() {
        return this.playerId !== undefined && this.imperialAvailable < forceTotal(this.groups)
    }

    // The default fills the groups in order until the Imperial warbands run out.
    get picked(): number[] {
        if (!this.mustChoose) return []
        const stored = this.stored
        if (
            stored?.length === this.groups.length &&
            stored.every((count, index) => count <= this.groups[index].count)
        ) {
            return stored
        }
        let left = this.imperialAvailable
        return this.groups.map((group) => {
            const take = Math.min(group.count, left)
            left -= take
            return take
        })
    }

    get pickedTotal() {
        return this.picked.reduce((n, c) => n + c, 0)
    }

    get replacementChoice(): WarbandGroup[] | undefined {
        if (!this.mustChoose) return undefined
        return this.groups
            .map((group, index) => ({ ...group, count: this.picked[index] ?? 0 }))
            .filter((group) => group.count > 0)
    }

    setPicked(index: number, count: number): void {
        const group = this.groups[index]
        if (!this.mustChoose || !group) return
        this.store(this.picked.with(index, Math.max(0, Math.min(count, group.count))))
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

/** R-9.4 — outside this seat's Act Phase the seat card opens the let-peek picker on its own; opening it is the pick. */
export class SeatCardPeekDraft extends OneStepDraft<true> {
    get open(): boolean {
        return this.stored === true
    }

    toggle(): void {
        if (this.open) this.reset()
        else this.store(true)
    }
}
