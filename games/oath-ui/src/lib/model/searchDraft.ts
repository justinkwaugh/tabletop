import { assert, assertExists } from '@tabletop/common'
import {
    CardKind,
    HydratedSearchSwap,
    MachineState,
    SearchPlay,
    discardFirstReach,
    kindOf,
    playMapChanges,
    reasonCannotPairSecondPlay,
    reasonCannotPlaceCard,
    reasonCannotPlayCard,
    reasonCannotPlaySecondCard,
    searchPlayModifiers,
    sitePlayGain,
    type LegalChoice,
    type PlayMapChanges,
    type PowerChoice,
    type SearchSecondPlay,
    type SitePlayGain,
    type Suit
} from '@tabletop/oath'
import { FACEDOWN_ADVISER_LABEL, PLAY_LABELS } from './adviserPlacements.js'
import { discardOrderOf, isDiscardOrderComplete } from './discardOrder.js'
import {
    discardFirstFields,
    discardFirstRow,
    opensWithSomeFirsts,
    rowReach,
    tapDiscardFirst,
    type DiscardFirstRow
} from './discardFirstPicks.js'
import { cardName } from './names.js'
import {
    emptyPicks,
    picksComplete,
    powerChoicesFrom,
    type PowerChoicePicks
} from './powerChoices.js'
import { whenPlayedBanks, whenPlayedOnPicks } from './whenPlayed.js'
import {
    adviserRoom,
    firstDiscard,
    NO_ROOM,
    offeredDiscards,
    toggledDiscard,
    type AdviserRoom
} from './adviserDiscards.js'
import {
    NO_CONSPIRACY_PICK,
    conspiracyNoTake,
    conspiracyPickComplete,
    conspiracyPlayOf,
    conspiracyPrizes,
    conspiracyTargets,
    type ConspiracyNoTakeLine,
    type ConspiracyPick,
    type TakePrizeOption
} from './conspiracyTake.js'
import { StagedFlow, type PanelDraft, type StagesCover } from './stagedFlow.svelte.js'
import type { OathGameSession } from './session.svelte.js'

export type SearchPlacement = Omit<SearchSecondPlay, 'cardId'>
export type SearchPlacementOption = SearchPlacement & {
    label: string
    /** R-5.1.4.II, R-7.6.4 — at the adviser limit, how many must go and which may. */
    room: AdviserRoom
}
type JudgedPlacement = SearchPlacementOption & { blockedBecause: string | undefined }
export type SecondPlay = SearchSecondPlay & {
    label: string
    mode: string
    key: string
    /** R-5.1.4.II — at the adviser limit, how many must go and which may, as for the kept card. */
    room: AdviserRoom
}

/** Chosen beside the placement: another site, the cards discarded first, a Land Warden second play. */
type SearchExtras = { toSiteId?: string; discardFirsts?: string[]; secondKey?: string }

/** R-7.3.3 — the picks stay editable until the player plays the card with them. */
type WhenPlayedPicks = { picks: PowerChoicePicks; confirmed: boolean }

/** Great Spire — the drawn denizens picked to swap, or the swap passed over ("No swap"). */
type SwapPicks = { picked: string[]; skipped: boolean }

type SearchValueByStage = {
    swap: SwapPicks
    kept: string
    extras: SearchExtras
    placement: SearchPlacement
    displaced: string[]
    whenPlayed: WhenPlayedPicks
    conspiracy: ConspiracyPick
    secondDisplaced: string[]
    discardOrder: string[]
}

const SEARCH_STAGE_ORDER = [
    'swap',
    'kept',
    'extras',
    'placement',
    'displaced',
    'whenPlayed',
    'conspiracy',
    'secondDisplaced',
    'discardOrder'
] as const
const _searchStagesAreCovered: StagesCover<SearchValueByStage, typeof SEARCH_STAGE_ORDER> = true
void _searchStagesAreCovered

const PLACEMENTS: (SearchPlacement & { label: string })[] = [
    { play: SearchPlay.Site, label: PLAY_LABELS[SearchPlay.Site] },
    { play: SearchPlay.Adviser, label: 'Adviser, faceup', faceUp: true },
    { play: SearchPlay.Adviser, label: FACEDOWN_ADVISER_LABEL, faceUp: false },
    { play: SearchPlay.RevealedVision, label: PLAY_LABELS[SearchPlay.RevealedVision] },
    { play: SearchPlay.Conspiracy, label: PLAY_LABELS[SearchPlay.Conspiracy] },
    { play: SearchPlay.Discard, label: PLAY_LABELS[SearchPlay.Discard] }
]

// Land Warden — the second card's row says the kept card's words in its own lower case.
const lowerFirst = (label: string) => label.charAt(0).toLowerCase() + label.slice(1)
const SECOND_VISION_MODE = lowerFirst(PLAY_LABELS[SearchPlay.RevealedVision])

/** R-5.1.2 to R-5.1.5 — the kept card, how it is played, and the order the rest are discarded in. */
export class SearchDraft implements PanelDraft {
    private flow = new StagedFlow<SearchValueByStage>(SEARCH_STAGE_ORDER)

    constructor(private readonly session: OathGameSession) {}

    private get playerId(): string | undefined {
        return this.session.gameState.machineState === MachineState.Searching
            ? this.session.liveTurnSeatId
            : undefined
    }

    private get extras(): SearchExtras {
        return this.flow.value('extras') ?? {}
    }

    // R-5.1.2 draws into the hand, so `handIds` is the set being chosen from.
    get drawn(): string[] {
        const playerId = this.playerId
        if (!playerId) return []
        const hand = this.session.gameState.getPlayerState(playerId).handIds
        assertExists(hand, 'A seat is shown its own hand')
        return hand
    }

    /**
     * Great Spire — its own step after the draw and before "Keep one.", while the engine offers the
     * swap on this seat's own view (public counts only) and the player has not passed it over.
     */
    get swapping(): boolean {
        const playerId = this.playerId
        if (!playerId) return false
        if (!HydratedSearchSwap.canDoSearchSwap(this.session.gameState, playerId)) return false
        return !(this.flow.value('swap')?.skipped ?? false)
    }

    /** R-5.1.2 — only drawn denizens swap: a Vision stays in the row and cannot be picked. */
    canSwap(cardId: string): boolean {
        return kindOf(cardId) === CardKind.Denizen
    }

    get swapPicked(): string[] {
        return (this.flow.value('swap')?.picked ?? []).filter((id) => this.drawn.includes(id))
    }

    /** No more than the Dispossessed holds, a public count. */
    get swapCap(): number {
        return this.session.gameState.dispossessedCount
    }

    tapSwap(cardId: string): void {
        if (!this.swapping || !this.canSwap(cardId)) return
        const picked = this.swapPicked
        if (picked.includes(cardId)) {
            this.flow.set('swap', { picked: picked.filter((id) => id !== cardId), skipped: false })
            return
        }
        if (picked.length >= this.swapCap) return
        this.flow.set('swap', { picked: [...picked, cardId], skipped: false })
    }

    /** "No swap": on to "Keep one." with nothing sent. */
    skipSwap(): void {
        this.flow.set('swap', { picked: [], skipped: true })
    }

    async swap(): Promise<void> {
        const picked = this.swapPicked
        if (!this.swapping || picked.length === 0) return
        await this.session.searchSwap(picked)
    }

    get kept(): string | undefined {
        const cardId = this.flow.value('kept')
        return cardId !== undefined && this.drawn.includes(cardId) ? cardId : undefined
    }

    // R-5.1.4.III and R-7.2.1 are card properties, so the placements change with the kept card;
    // a play the engine refuses is not offered (contract rule 2).
    // R-7.3.3 — a placement is judged apart from its When Played choices, which are asked after
    // it; at the limit it is open when some adviser could make room (R-5.1.4.II).
    get placements(): SearchPlacementOption[] {
        const cardId = this.kept
        const playerId = this.playerId
        if (!cardId || !playerId) return []
        const options = PLACEMENTS.flatMap((option) => {
            const { blockedBecause, ...placed } = this.placementOption(playerId, cardId, option)
            const refused = blockedBecause ?? this.reasonSecondCannotPair(playerId, option)
            return refused === undefined ? [placed] : []
        })
        assert(options.length > 0, 'R-5.1.4 — a kept card can always be discarded')
        return options
    }

    get placement(): SearchPlacement | undefined {
        return this.chosenOption && this.flow.value('placement')
    }

    private get chosenOption(): SearchPlacementOption | undefined {
        const chosen = this.flow.value('placement')
        if (chosen === undefined || this.placementReason !== undefined) return undefined
        return this.placements.find((o) => this.samePlacement(o, chosen))
    }

    /**
     * R-5.1.4.I, R-11.10 — the site play is offered when some site or discard first opens it, so
     * the one picked beside it (another site, a card discarded first, or neither) is judged when
     * the play is chosen; a refused pick stays on this step with the engine's reason.
     */
    get placementReason(): string | undefined {
        const chosen = this.flow.value('placement')
        const cardId = this.kept
        const playerId = this.playerId
        if (chosen?.play !== SearchPlay.Site || !cardId || !playerId) return undefined
        if (!this.placements.some((o) => this.samePlacement(o, chosen))) return undefined
        return reasonCannotPlaceCard(
            this.session.gameState,
            playerId,
            cardId,
            SearchPlay.Site,
            this.playExtras(SearchPlay.Site)
        )
    }

    /** R-5.1.4.II — the advisers the chosen play may discard; empty when there is room. */
    get room(): AdviserRoom {
        return this.chosenOption?.room ?? NO_ROOM
    }

    get displaceable(): string[] {
        return offeredDiscards(this.room, this.displaced)
    }

    get displaced(): string[] {
        return (this.flow.value('displaced') ?? []).filter((id) =>
            this.room.discardable.includes(id)
        )
    }

    get needsDisplaced(): boolean {
        return this.displaced.length < this.room.needed
    }

    // R-5.1.4.I, R-11.10 — the card picked beside the site play goes first; R-7.3.3 — the play's gains
    // come before the power, as the engine plans them.
    private get playChanges(): PlayMapChanges | undefined {
        const cardId = this.kept
        const playerId = this.playerId
        const placement = this.placement
        if (!cardId || !playerId || !placement) return undefined
        return playMapChanges(this.session.gameState, playerId, cardId, placement.play, {
            faceUp: placement.faceUp,
            discardedAdviserCardIds: this.displaced,
            ...this.playExtras(placement.play)
        })
    }

    /** R-7.3.3 — read on the picks made so far. */
    get whenPlayed(): LegalChoice[] {
        return this.whenPlayedOn(this.picks).choices
    }

    /** R-7.3.3 — the When Played choices on `picks`, and the picks as they read back (`whenPlayedOnPicks`). */
    private whenPlayedOn(
        picks: PowerChoicePicks,
        shown?: readonly LegalChoice[]
    ): { choices: LegalChoice[]; picks: PowerChoicePicks } {
        const cardId = this.kept
        const playerId = this.playerId
        const placement = this.placement
        if (!cardId || !playerId || !placement) return { choices: [], picks }
        return whenPlayedOnPicks(
            this.session.gameState,
            playerId,
            cardId,
            placement.play,
            placement.faceUp,
            this.playChanges,
            picks,
            shown
        )
    }

    /** R-7.3.3 — the favor banks the When Played picks are judged on (Salad Days'). */
    get whenPlayedBanks(): Readonly<Record<Suit, number>> {
        return whenPlayedBanks(this.session.gameState, this.playChanges)
    }

    /**
     * R-5.1.4.I, R-11.2, R-7.4 — what "To your site" gains the kept card's player, as the engine plans the play on
     * the banks as they stand, with the card picked to go first; none while "To which site" names another.
     */
    get siteGain(): SitePlayGain | undefined {
        const cardId = this.kept
        const playerId = this.playerId
        if (!cardId || !playerId || this.toSite !== undefined) return undefined
        return sitePlayGain(
            playMapChanges(
                this.session.gameState,
                playerId,
                cardId,
                SearchPlay.Site,
                this.playExtras(SearchPlay.Site)
            )
        )
    }

    get picks(): PowerChoicePicks {
        return this.flow.value('whenPlayed')?.picks ?? emptyPicks()
    }

    /** "Play" waits until every When Played choice has its picks. */
    get whenPlayedComplete(): boolean {
        return picksComplete(this.whenPlayed, this.picks)
    }

    get needsWhenPlayed(): boolean {
        return (
            !this.needsDisplaced &&
            this.whenPlayed.length > 0 &&
            this.flow.value('whenPlayed')?.confirmed !== true
        )
    }

    private get choices(): PowerChoice[] | undefined {
        const legal = this.whenPlayed
        return legal.length > 0 ? powerChoicesFrom(legal, this.picks) : undefined
    }

    /** R-5.1.4.IV — the players the Conspiracy may take from, when it is the play chosen. */
    get conspiracyTargets(): string[] {
        const playerId = this.playerId
        return playerId && this.placement?.play === SearchPlay.Conspiracy
            ? conspiracyTargets(this.session.gameState, playerId)
            : []
    }

    conspiracyPrizesOf(targetPlayerId: string): TakePrizeOption[] {
        const playerId = this.playerId
        return playerId ? conspiracyPrizes(this.session.gameState, playerId, targetPlayerId) : []
    }

    get conspiracyPick(): ConspiracyPick {
        return this.flow.value('conspiracy') ?? NO_CONSPIRACY_PICK
    }

    private get conspiracy() {
        const playerId = this.playerId
        return playerId && this.conspiracyTargets.length > 0
            ? conspiracyPlayOf(this.session.gameState, playerId, this.conspiracyPick)
            : undefined
    }

    /** When no one here can be taken from, why: one line per player here. */
    get conspiracyNoTake(): ConspiracyNoTakeLine[] {
        const playerId = this.playerId
        return playerId && this.placement?.play === SearchPlay.Conspiracy
            ? conspiracyNoTake(this.session.gameState, playerId)
            : []
    }

    // R-5.1.4.IV — the take is asked whenever the Conspiracy is played, even with no one to take
    // from: the step then says why, and "Play" plays it with no take.
    get needsConspiracy(): boolean {
        return (
            !this.needsDisplaced &&
            !this.needsWhenPlayed &&
            this.placement?.play === SearchPlay.Conspiracy &&
            !this.conspiracyPick.confirmed
        )
    }

    /** The take is picked whole: nobody (no take, R-5.1.4.IV's "may"), or a player and a prize. */
    get conspiracyComplete(): boolean {
        const playerId = this.playerId
        return (
            !playerId ||
            this.placement?.play !== SearchPlay.Conspiracy ||
            conspiracyPickComplete(this.session.gameState, playerId, this.conspiracyPick)
        )
    }

    setConspiracyPick(pick: Omit<ConspiracyPick, 'confirmed'>): void {
        if (this.conspiracyTargets.length > 0) {
            this.flow.set('conspiracy', { ...pick, confirmed: false })
        }
    }

    async confirmConspiracy(): Promise<void> {
        if (
            !this.needsConspiracy ||
            !this.conspiracyComplete ||
            this.whenPlayedReason !== undefined
        )
            return
        this.flow.set('conspiracy', { ...this.conspiracyPick, confirmed: true })
        await this.resolveWhenOrdered()
    }

    /** The engine's refusal of the play as picked, shown before the player confirms it. */
    get whenPlayedReason(): string | undefined {
        const cardId = this.kept
        const playerId = this.playerId
        const placement = this.placement
        if (!cardId || !playerId || !placement) return undefined
        return reasonCannotPlayCard(this.session.gameState, playerId, cardId, placement.play, {
            faceUp: placement.faceUp,
            choices: this.choices,
            discardedAdviserCardIds: this.displaced,
            conspiracy: this.conspiracy,
            ...this.playExtras(placement.play)
        })
    }

    // As the engine judges the play: with the Search's carried modifiers, and for a site play the
    // site and the card discarded first picked beside it.
    private playExtras(play: SearchPlay) {
        const carried = searchPlayModifiers(this.session.gameState)
        return play === SearchPlay.Site
            ? { carried, toSiteId: this.toSite, ...discardFirstFields(this.discardFirsts) }
            : { carried }
    }

    /** The placement and the picks both plays ask for are all made; the discard order is next. */
    get placed(): boolean {
        return this.keptPlayPicked && !this.needsSecondDisplaced
    }

    /** The kept card's placement and the picks its play asks for are all made. */
    private get keptPlayPicked(): boolean {
        return (
            this.placement !== undefined &&
            !this.needsDisplaced &&
            !this.needsWhenPlayed &&
            !this.needsConspiracy
        )
    }

    // Land Warden — a second drawn card played rather than discarded.
    get secondAllowed() {
        return (
            this.playerId !== undefined &&
            searchPlayModifiers(this.session.gameState).some((m) => m.hooks.secondPlay)
        )
    }

    get secondPlays(): SecondPlay[] {
        const kept = this.kept
        const playerId = this.playerId
        if (!kept || !playerId) return []
        return this.drawn
            .filter((id) => id !== kept)
            .flatMap((cardId) => [
                this.secondPlay(playerId, cardId, SearchPlay.Site, 'to your site'),
                this.secondPlay(playerId, cardId, SearchPlay.Adviser, 'adviser, faceup', true),
                this.secondPlay(playerId, cardId, SearchPlay.Adviser, 'adviser, facedown', false),
                // R-5.1.4.III — an Exile's Vision, offered where the engine accepts it (from revision 32).
                this.secondPlay(playerId, cardId, SearchPlay.RevealedVision, SECOND_VISION_MODE)
            ])
            .filter((option) => this.pairsWithAnOpenPlacement(playerId, kept, option))
    }

    get second() {
        return this.secondPlays.find((option) => option.key === this.extras.secondKey)
    }

    /** Land Warden, R-5.1.4.II — the advisers the second card's play may discard; empty when there is room. */
    get secondRoom(): AdviserRoom {
        return this.second?.room ?? NO_ROOM
    }

    get secondDisplaceable(): string[] {
        return offeredDiscards(this.secondRoom, this.secondDisplaced)
    }

    get secondDisplaced(): string[] {
        return (this.flow.value('secondDisplaced') ?? []).filter((id) =>
            this.secondRoom.discardable.includes(id)
        )
    }

    // The kept card is played first, with its own picks; the second card's adviser is asked after them.
    get needsSecondDisplaced(): boolean {
        return this.keptPlayPicked && this.secondDisplaced.length < this.secondRoom.needed
    }

    get others() {
        return this.drawn.filter((id) => id !== this.kept && id !== this.second?.cardId)
    }

    /** Land Warden — the cards a second play may take, each once. */
    get secondCandidates(): string[] {
        return [...new Set(this.secondPlays.map((option) => option.cardId))]
    }

    /** A tap on a card picks its first way to play, and a tap on the picked card drops it. */
    tapSecondCard(cardId: string): void {
        if (this.second?.cardId === cardId) {
            this.setSecondPlay(undefined)
            return
        }
        this.setSecondPlay(this.secondPlays.find((option) => option.cardId === cardId)?.key)
    }

    get tapped(): string[] {
        if (!this.placed) return []
        return (this.flow.value('discardOrder') ?? []).filter((id) => this.others.includes(id))
    }

    get orderComplete() {
        return isDiscardOrderComplete(this.tapped, this.others)
    }

    private sitePlayOpen(toSiteId: string | undefined, firsts: readonly string[] = []): boolean {
        const cardId = this.kept
        const playerId = this.playerId
        if (!cardId || !playerId) return false
        return (
            reasonCannotPlaceCard(this.session.gameState, playerId, cardId, SearchPlay.Site, {
                toSiteId,
                ...discardFirstFields(firsts),
                carried: searchPlayModifiers(this.session.gameState)
            }) === undefined
        )
    }

    /** R-11.10, Crop Rotation, R-5.1.4.I — the play to `toSiteId` opens with no card first, or with some. */
    private sitePlayCanOpen(toSiteId: string | undefined): boolean {
        const playerId = this.playerId
        if (!playerId) return false
        return opensWithSomeFirsts(this.discardFirstReachFor(playerId, toSiteId), (firsts) =>
            this.sitePlayOpen(toSiteId, firsts)
        )
    }

    /** The cards the "Discard first" row judges for a play to `toSiteId`, with the Search's carried modifiers. */
    private discardFirstReachFor(playerId: string, toSiteId: string | undefined) {
        const state = this.session.gameState
        return rowReach(
            state,
            discardFirstReach(state, playerId, { toSiteId, carried: searchPlayModifiers(state) })
        )
    }

    // R-11.10 the Great Slum, R-5.1.4.I the People's Favor, Crop Rotation — the denizens discarded before a
    // site play, one per power that gives one, offered wherever the engine accepts them for the site played to.
    private discardFirstRowFor(target: string | undefined): DiscardFirstRow {
        const playerId = this.playerId
        if (!playerId || !this.kept) return { offered: [], picked: [], several: false }
        return discardFirstRow(
            this.discardFirstReachFor(playerId, target),
            this.extras.discardFirsts ?? [],
            (firsts) => this.sitePlayOpen(target, firsts)
        )
    }

    private get discardFirstPicks(): DiscardFirstRow {
        return this.discardFirstRowFor(this.toSite)
    }

    /** The cards the "Discard first" row shows: those picked, and each that can still go with them. */
    get discardFirstOptions(): string[] {
        return this.discardFirstPicks.offered
    }

    /** The cards picked to discard first that can still go together. */
    get discardFirsts(): string[] {
        return this.discardFirstPicks.picked
    }

    /** The first card picked to discard first. */
    get discardFirst(): string | undefined {
        return this.discardFirsts[0]
    }

    // R-5.1.4.I the People's Favor, New Growth — another site to play to, counting a site a
    // discard there would open.
    get otherSites(): string[] {
        const here = this.session.myPlayerState?.siteId
        const state = this.session.gameState
        return state
            .allSiteIds()
            .filter((siteId) => siteId !== here && this.sitePlayCanOpen(siteId))
    }

    get toSite(): string | undefined {
        const siteId = this.extras.toSiteId
        return siteId !== undefined && this.otherSites.includes(siteId) ? siteId : undefined
    }

    keep(cardId: string): void {
        if (this.drawn.includes(cardId)) this.flow.set('kept', cardId)
    }

    setToSite(siteId: string | undefined): void {
        this.setExtras({ ...this.extras, toSiteId: siteId })
    }

    /** One card discarded first in place of the picks, or none. */
    setDiscardFirst(cardId: string | undefined): void {
        this.setExtras({ ...this.extras, discardFirsts: cardId === undefined ? [] : [cardId] })
    }

    /** A tap in the "Discard first" row: added, taken back, or, where one card may go, in place of the pick. */
    tapDiscardFirst(cardId: string): void {
        this.setExtras({
            ...this.extras,
            discardFirsts: tapDiscardFirst(this.discardFirstPicks, cardId)
        })
    }

    setSecondPlay(key: string | undefined): void {
        this.setExtras({ ...this.extras, secondKey: key })
    }

    async choosePlacement(placement: SearchPlacement): Promise<void> {
        if (!this.kept) return
        this.flow.set('placement', placement)
        await this.resolveWhenOrdered()
    }

    async chooseDisplaced(cardId: string): Promise<void> {
        if (!this.displaceable.includes(cardId)) return
        this.flow.set('displaced', toggledDiscard(this.displaced, this.room, cardId))
        await this.resolveWhenOrdered()
    }

    async chooseSecondDisplaced(cardId: string): Promise<void> {
        if (!this.secondDisplaceable.includes(cardId)) return
        this.flow.set(
            'secondDisplaced',
            toggledDiscard(this.secondDisplaced, this.secondRoom, cardId)
        )
        await this.resolveWhenOrdered()
    }

    // A pick whose options follow an earlier one is kept only while the option it named is offered.
    setPicks(picks: PowerChoicePicks): void {
        const shown = this.whenPlayed
        if (shown.length === 0) return
        this.flow.set('whenPlayed', {
            picks: this.whenPlayedOn(picks, shown).picks,
            confirmed: false
        })
    }

    async confirmWhenPlayed(): Promise<void> {
        if (
            !this.needsWhenPlayed ||
            !this.whenPlayedComplete ||
            this.whenPlayedReason !== undefined
        )
            return
        this.flow.set('whenPlayed', { picks: this.picks, confirmed: true })
        await this.resolveWhenOrdered()
    }

    async tapDiscard(cardId: string): Promise<void> {
        if (!this.placed || !this.others.includes(cardId) || this.tapped.includes(cardId)) {
            return
        }
        const next = [...this.tapped, cardId]
        this.flow.set('discardOrder', next)
        if (next.length >= this.others.length - 1) await this.resolve()
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    back(): boolean {
        const tapped = this.flow.value('discardOrder') ?? []
        if (tapped.length > 1) {
            this.flow.set('discardOrder', tapped.slice(0, -1))
            return true
        }
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }

    private setExtras(extras: SearchExtras): void {
        if (this.kept) this.flow.set('extras', extras)
    }

    // With one card or none left over there is no order to tap.
    private async resolveWhenOrdered(): Promise<void> {
        if (this.placed && this.others.length <= 1) await this.resolve()
    }

    private async resolve(): Promise<void> {
        const kept = this.kept
        const placement = this.placement
        if (!kept || !placement || !this.placed || !this.orderComplete) return
        const siteAt = placement.play === SearchPlay.Site
        const second = this.second
        const choices = this.choices
        const displaced = this.displaced
        const secondDisplaced = this.secondDisplaced
        const conspiracy = this.conspiracy
        await this.session.resolveSearch({
            keptCardId: kept,
            discardOrder: discardOrderOf(this.tapped, this.others),
            play: placement.play,
            ...(placement.faceUp === undefined ? {} : { faceUp: placement.faceUp }),
            ...(choices ? { choices } : {}),

            ...(displaced.length > 0 ? { discardedAdviserCardIds: displaced } : {}),
            ...(conspiracy ? { conspiracy } : {}),

            ...(siteAt ? discardFirstFields(this.discardFirsts) : {}),
            ...(siteAt && this.toSite ? { toSiteId: this.toSite } : {}),
            ...(second
                ? {
                      secondPlay: {
                          cardId: second.cardId,
                          play: second.play,
                          ...(second.faceUp === undefined ? {} : { faceUp: second.faceUp }),
                          ...(secondDisplaced.length > 0
                              ? { discardedAdviserCardIds: secondDisplaced }
                              : {})
                      }
                  }
                : {})
        })
    }

    // R-5.1.4.II — at the limit the second card's adviser play is offered when some adviser could make room, as
    // the kept card's is; the kept card's play leaves the advisers as they are, since only one of the two is one.
    private secondPlay(
        playerId: string,
        cardId: string,
        play: SearchPlay,
        mode: string,
        faceUp?: boolean
    ): SecondPlay {
        const room =
            play === SearchPlay.Adviser
                ? adviserRoom(this.session.gameState, playerId, cardId, { faceUp })
                : NO_ROOM
        return {
            cardId,
            play,
            faceUp,
            room,
            mode,
            label: `${cardName(cardId)} — ${mode}`,
            key: `${cardId}|${play}|${faceUp ?? ''}`
        }
    }

    // R-5.1.4.I, R-11.10 — a site play refused at the player's own site is open when another site
    // or a card discarded first opens it, as for a facedown adviser's play (`adviserPlacements`).
    private placementOption(
        playerId: string,
        cardId: string,
        option: SearchPlacement & { label: string }
    ): JudgedPlacement {
        const state = this.session.gameState
        const room =
            option.play === SearchPlay.Adviser
                ? adviserRoom(state, playerId, cardId, { faceUp: option.faceUp })
                : NO_ROOM
        const refused = reasonCannotPlaceCard(state, playerId, cardId, option.play, {
            faceUp: option.faceUp,
            discardedAdviserCardIds: firstDiscard(room)
        })
        const openElsewhere =
            option.play === SearchPlay.Site &&
            refused !== undefined &&
            (this.otherSites.length > 0 || this.sitePlayCanOpen(undefined))
        return { ...option, room, blockedBecause: openElsewhere ? undefined : refused }
    }

    private pairsWithAnOpenPlacement(playerId: string, kept: string, second: SecondPlay) {
        return PLACEMENTS.some(
            (option) =>
                this.placementOption(playerId, kept, option).blockedBecause === undefined &&
                this.reasonSecondCannotFollow(playerId, kept, option, second) === undefined
        )
    }

    private reasonSecondCannotPair(playerId: string, first: SearchPlacement): string | undefined {
        const second = this.second
        const kept = this.kept
        return second && kept
            ? this.reasonSecondCannotFollow(playerId, kept, first, second)
            : undefined
    }

    // Land Warden — the second card as the engine judges it after the kept card's play: its When Played
    // power counts the map that play leaves (Riots), and the kept card's own When Played power when it is
    // played faceup; the room for both at your site is counted on that map too. At the adviser limit it is judged
    // with the first advisers that may go, as a placement is.
    private reasonSecondCannotFollow(
        playerId: string,
        kept: string,
        first: SearchPlacement,
        option: SecondPlay
    ): string | undefined {
        const state = this.session.gameState
        const { room } = option
        const second: SearchSecondPlay = {
            cardId: option.cardId,
            play: option.play,
            faceUp: option.faceUp,
            ...(room.needed > 0 ? { discardedAdviserCardIds: firstDiscard(room) } : {})
        }
        // R-5.1.4.I — the kept card may go to another site, which leaves your site's room to the second card.
        const keptTo = first.play === SearchPlay.Site ? this.toSite : undefined
        // R-5.1.4.I, R-11.10 — each card the kept card discards first at your site leaves its space.
        const keptPlay = {
            keptCardId: kept,
            play: first.play,
            faceUp: first.faceUp,
            ...(first.play === SearchPlay.Site ? discardFirstFields(this.discardFirsts) : {}),
            toSiteId: keptTo
        }
        return (
            reasonCannotPairSecondPlay(state, playerId, keptPlay, second) ??
            reasonCannotPlaySecondCard(state, playerId, kept, second, keptPlay)
        )
    }

    private samePlacement(a: SearchPlacement, b: SearchPlacement): boolean {
        return a.play === b.play && a.faceUp === b.faceUp
    }
}
