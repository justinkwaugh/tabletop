import { assert, assertExists } from '@tabletop/common'
import {
    MachineState,
    SearchPlay,
    carriedModifiers,
    reasonCannotPlaceCard,
    reasonCannotPlayCard,
    type LegalChoice,
    type PowerChoice,
    type SearchSecondPlay
} from '@tabletop/oath'
import { PLAY_LABELS, teaches } from './adviserPlacements.js'
import { discardOrderOf, isDiscardOrderComplete } from './discardOrder.js'
import { cardName } from './names.js'
import { emptyPicks, powerChoicesFrom, type PowerChoicePicks } from './powerChoices.js'
import { whenPlayedChoices } from './whenPlayed.js'
import { adviserRoom, toggledDiscard, type AdviserRoom } from './adviserDiscards.js'
import {
    NO_CONSPIRACY_PICK,
    conspiracyPlayOf,
    conspiracyPrizes,
    conspiracyTargets,
    type ConspiracyPick,
    type TakePrizeOption
} from './conspiracyTake.js'
import { StagedFlow, type PanelDraft, type StagesCover } from './stagedFlow.svelte.js'
import type { OathGameSession } from './session.svelte.js'

export type SearchPlacement = Omit<SearchSecondPlay, 'cardId'>
export type SearchPlacementOption = SearchPlacement & {
    label: string
    blockedBecause: string | undefined
    /** R-5.1.4.II, R-7.6.4 — at the adviser limit, how many must go and which may. */
    room: AdviserRoom
}
export type SecondPlay = SearchSecondPlay & { label: string; mode: string; key: string }

/** Chosen beside the placement: another site, a Great Slum discard, a Land Warden second play. */
type SearchExtras = { toSiteId?: string; discardFirstCardId?: string; secondKey?: string }

/** R-7.3.3 — the picks stay editable until the player plays the card with them. */
type WhenPlayedPicks = { picks: PowerChoicePicks; confirmed: boolean }

type SearchValueByStage = {
    kept: string
    extras: SearchExtras
    placement: SearchPlacement
    displaced: string[]
    whenPlayed: WhenPlayedPicks
    conspiracy: ConspiracyPick
    discardOrder: string[]
}

const SEARCH_STAGE_ORDER = [
    'kept',
    'extras',
    'placement',
    'displaced',
    'whenPlayed',
    'conspiracy',
    'discardOrder'
] as const
const _searchStagesAreCovered: StagesCover<SearchValueByStage, typeof SEARCH_STAGE_ORDER> = true
void _searchStagesAreCovered

const PLACEMENTS: (SearchPlacement & { label: string })[] = [
    { play: SearchPlay.Site, label: PLAY_LABELS[SearchPlay.Site] },
    { play: SearchPlay.Adviser, label: 'Adviser, faceup', faceUp: true },
    { play: SearchPlay.Adviser, label: 'Adviser, facedown', faceUp: false },
    { play: SearchPlay.RevealedVision, label: PLAY_LABELS[SearchPlay.RevealedVision] },
    { play: SearchPlay.Conspiracy, label: PLAY_LABELS[SearchPlay.Conspiracy] },
    { play: SearchPlay.Discard, label: PLAY_LABELS[SearchPlay.Discard] }
]

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

    get kept(): string | undefined {
        const cardId = this.flow.value('kept')
        return cardId !== undefined && this.drawn.includes(cardId) ? cardId : undefined
    }

    // R-5.1.4.III and R-7.2.1 are card properties, so the placements change with the kept card;
    // refusals that teach are kept and explained.
    // R-7.3.3 — a placement is judged apart from its When Played choices, which are asked after
    // it; at the limit it is open when some adviser could make room (R-5.1.4.II).
    get placements(): SearchPlacementOption[] {
        const cardId = this.kept
        const playerId = this.playerId
        if (!cardId || !playerId) return []
        const state = this.session.gameState
        const options = PLACEMENTS.map((option) => {
            const room =
                option.play === SearchPlay.Adviser
                    ? adviserRoom(state, playerId, cardId, { faceUp: option.faceUp })
                    : { needed: 0, discardable: [] }
            const blockedBecause = reasonCannotPlaceCard(state, playerId, cardId, option.play, {
                faceUp: option.faceUp,
                discardedAdviserCardIds: room.discardable.slice(0, room.needed)
            })
            return { ...option, blockedBecause, room }
        }).filter((option) => option.blockedBecause === undefined || teaches(option.play))
        assert(
            options.some((option) => option.blockedBecause === undefined),
            'R-5.1.4 — a kept card can always be discarded'
        )
        return options
    }

    get placement(): SearchPlacement | undefined {
        return this.chosenOption && this.flow.value('placement')
    }

    private get chosenOption(): SearchPlacementOption | undefined {
        const chosen = this.flow.value('placement')
        if (chosen === undefined) return undefined
        return this.placements.find(
            (o) => o.blockedBecause === undefined && this.samePlacement(o, chosen)
        )
    }

    /** R-5.1.4.II — the advisers the chosen play may discard; empty when there is room. */
    get room(): AdviserRoom {
        return this.chosenOption?.room ?? { needed: 0, discardable: [] }
    }

    get displaceable(): string[] {
        return this.room.discardable
    }

    get displaced(): string[] {
        return (this.flow.value('displaced') ?? []).filter((id) => this.displaceable.includes(id))
    }

    get needsDisplaced(): boolean {
        return this.displaced.length < this.room.needed
    }

    /** R-7.3.3 */
    get whenPlayed(): LegalChoice[] {
        const cardId = this.kept
        const playerId = this.playerId
        const placement = this.placement
        if (!cardId || !playerId || !placement) return []
        return whenPlayedChoices(
            this.session.gameState,
            playerId,
            cardId,
            placement.play,
            placement.faceUp
        )
    }

    get picks(): PowerChoicePicks {
        return this.flow.value('whenPlayed')?.picks ?? emptyPicks()
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

    get needsConspiracy(): boolean {
        return (
            !this.needsDisplaced &&
            !this.needsWhenPlayed &&
            this.conspiracyTargets.length > 0 &&
            !this.conspiracyPick.confirmed
        )
    }

    setConspiracyPick(pick: Omit<ConspiracyPick, 'confirmed'>): void {
        if (this.conspiracyTargets.length > 0) {
            this.flow.set('conspiracy', { ...pick, confirmed: false })
        }
    }

    async confirmConspiracy(): Promise<void> {
        if (!this.needsConspiracy || this.whenPlayedReason !== undefined) return
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
            conspiracy: this.conspiracy
        })
    }

    /** The placement and the picks it asks for are all made; the discard order is next. */
    get placed(): boolean {
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
            carriedModifiers(
                this.session.gameState,
                this.session.gameState.pendingSearchModifiers
            ).some((m) => m.hooks.secondPlay)
        )
    }

    get secondPlays(): SecondPlay[] {
        return this.drawn
            .filter((id) => id !== this.kept)
            .flatMap((cardId) => [
                this.secondPlay(cardId, SearchPlay.Site, 'to your site'),
                this.secondPlay(cardId, SearchPlay.Adviser, 'adviser, faceup', true),
                this.secondPlay(cardId, SearchPlay.Adviser, 'adviser, facedown', false)
            ])
    }

    get second() {
        return this.secondPlays.find((option) => option.key === this.extras.secondKey)
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

    private sitePlayOpen(toSiteId: string | undefined, discardFirstCardId?: string): boolean {
        const cardId = this.kept
        const playerId = this.playerId
        if (!cardId || !playerId) return false
        return (
            reasonCannotPlaceCard(this.session.gameState, playerId, cardId, SearchPlay.Site, {
                toSiteId,
                discardFirstCardId
            }) === undefined
        )
    }

    // R-11.10 the Great Slum, R-5.1.4.I the People's Favor, Crop Rotation — a denizen discarded before a
    // site play, offered wherever the engine accepts it for the site being played to.
    get discardFirstOptions(): string[] {
        const state = this.session.gameState
        const target = this.toSite
        return state
            .allSiteIds()
            .flatMap((siteId) => state.denizensAt(siteId))
            .filter((first) => this.sitePlayOpen(target, first))
    }

    get discardFirst(): string | undefined {
        const cardId = this.extras.discardFirstCardId
        return cardId !== undefined && this.discardFirstOptions.includes(cardId)
            ? cardId
            : undefined
    }

    // R-5.1.4.I the People's Favor, New Growth — another site to play to, counting a site a
    // discard there would open.
    get otherSites(): string[] {
        const here = this.session.myPlayerState?.siteId
        const state = this.session.gameState
        return state
            .allSiteIds()
            .filter(
                (siteId) =>
                    siteId !== here &&
                    [undefined, ...state.denizensAt(siteId)].some((first) =>
                        this.sitePlayOpen(siteId, first)
                    )
            )
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

    setDiscardFirst(cardId: string | undefined): void {
        this.setExtras({ ...this.extras, discardFirstCardId: cardId })
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

    setPicks(picks: PowerChoicePicks): void {
        if (this.whenPlayed.length > 0) this.flow.set('whenPlayed', { picks, confirmed: false })
    }

    async confirmWhenPlayed(): Promise<void> {
        if (!this.needsWhenPlayed || this.whenPlayedReason !== undefined) return
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
        const conspiracy = this.conspiracy
        await this.session.resolveSearch({
            keptCardId: kept,
            discardOrder: discardOrderOf(this.tapped, this.others),
            play: placement.play,
            ...(placement.faceUp === undefined ? {} : { faceUp: placement.faceUp }),
            ...(choices ? { choices } : {}),

            ...(displaced.length > 0 ? { discardedAdviserCardIds: displaced } : {}),
            ...(conspiracy ? { conspiracy } : {}),

            ...(siteAt && this.discardFirst ? { discardFirstCardId: this.discardFirst } : {}),
            ...(siteAt && this.toSite ? { toSiteId: this.toSite } : {}),
            ...(second
                ? {
                      secondPlay: {
                          cardId: second.cardId,
                          play: second.play,
                          ...(second.faceUp === undefined ? {} : { faceUp: second.faceUp })
                      }
                  }
                : {})
        })
    }

    private secondPlay(
        cardId: string,
        play: SearchPlay,
        mode: string,
        faceUp?: boolean
    ): SecondPlay {
        return {
            cardId,
            play,
            faceUp,
            mode,
            label: `${cardName(cardId)} — ${mode}`,
            key: `${cardId}|${play}|${faceUp ?? ''}`
        }
    }

    private samePlacement(a: SearchPlacement, b: SearchPlacement): boolean {
        return a.play === b.play && a.faceUp === b.faceUp
    }
}
