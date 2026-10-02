import { GameSession } from '@tabletop/frontend-components'
import { assert, assertExists, type Color, type GameAction } from '@tabletop/common'
import {
    ActionType,
    AnswerConsent,
    AnswerQuestion,
    Campaign,
    CampaignDefeatKills,
    CampaignAttackPlans,
    CampaignDefend,
    CampaignResolveVictory,
    CampaignSacrifice,
    CompleteRest,
    ConsentRequestKind,
    EndActPhase,
    ForgoFreeAction,
    ExileCitizen,
    HydratedAnswerConsent,
    HydratedCampaign,
    HydratedResolveOathkeeper,
    HydratedResolveWake,
    HydratedExileCitizen,
    HydratedMuster,
    HydratedPlayFacedownAdviser,
    HydratedTrade,
    HydratedTravel,
    MachineState,
    MoveWarbands,
    WarbandMoveKind,
    Muster,
    OfferCitizenship,
    Peek,
    PeekTargetKind,
    HydratedLetPeek,
    LetPeek,
    PlayFacedownAdviser,
    Recover,
    RecoverTargetKind,
    ResolveCitizenshipOffer,
    ResolveOathkeeper,
    ResolveWake,
    Search,
    SearchPlay,
    shroudedWoodChooser,
    SearchResolve,
    SelfExile,
    SetupChoice,
    Suit,
    Trade,
    TradeOption,
    Travel,
    UseActionPower,
    UseRestPower,
    Banner,
    defaultTolls,
    sneakAttackOfferedTo,
    type BattlePlanUse,
    type CampaignPlacement,
    type CitizenshipTerms,
    type HydratedOathGameState,
    type OathProjectedState,
    type PendingConsent,
    type OpportunityTake,
    type PeekTarget,
    type LetPeekSubject,
    type ConspiracyPlay,
    type LegalChoice,
    type PowerChoice,
    type QuestionAnswer,
    type SearchResolveChoice,
    type SearchSource,
    type TravelTerms,
    type WakeFavorStep,
    type WarbandGroup,
    type WarbandMoveOption,
    type WarbandOwner,
    IMPERIAL_WARBANDS,
    ownWarbandOwner
} from '@tabletop/oath'
import { warbandOwnerName } from './names.js'
import { OathSelection } from './oathSelection.svelte.js'
import { SearchDraft } from './searchDraft.js'
import { QuestionDraft } from './questionDraft.js'
import {
    AttackPlansDraft,
    AttackerLossesDraft,
    DefeatDraft,
    DefenceDraft,
    VictoryDraft
} from './battleDrafts.js'
import {
    ActionPowersDraft,
    CitizenshipDraft,
    ConsentDraft,
    RestDraft,
    WakeDraft
} from './phaseDrafts.js'
import type { PanelDraft } from './stagedFlow.svelte.js'
import { SeatDetail } from './seatDetail.svelte.js'
import { GoalsView } from './goalsView.svelte.js'
import { siteName } from './names.js'
import { rowWarbandOwner, type HistoryNames } from './actionDescription.js'
import {
    endingRule,
    gameEndEvent,
    historyRows,
    type HistoryRow,
    type MajorEvent,
    type MajorEventContext
} from './majorEvents.js'
import { peekedRelicAt, unseenPeekSlots } from './relicKnowledge.js'
import {
    adviserDiscardFirstOptions,
    adviserOtherSites,
    adviserPlacements,
    type AdviserPlacement
} from './adviserPlacements.js'
import { CampaignDraft, type CampaignDeclaration } from './campaignDraft.js'
import {
    reasonCannotRecoverBanner,
    recoverableBanners,
    recoverableRelicSlots,
    travelCost,
    travelWays,
    type TravelWay,
    type SiteFavor,
    type BannerBid,
    type SiteOffer
} from './actionOffers.js'
import { tollLabel } from './offerText.js'
import { musterRows, type MusterRow } from './musterRows.js'
import { recoverRows, type RecoverRelicRow } from './recoverRows.js'
import { searchRows, type SearchRow } from './searchRows.js'
import { tradeRows, type TradeRow } from './tradeRows.js'
import { travelRows, type TravelRow } from './travelRows.js'
import { SetupDraft } from './setupDraft.js'
import { actionCards, type ActionCard } from './actionCards.js'
import { powerUseKey } from './powerUse.js'
import { ModifierDeclarations } from './modifierDeclarations.js'
import { WarbandMoveDraft } from './warbandMoveDraft.js'
import { emptyPicks, powerChoicesFrom, type PowerChoicePicks } from './powerChoices.js'
import { whenPlayedChoices } from './whenPlayed.js'
import { toggledDiscard, type AdviserRoom } from './adviserDiscards.js'
import {
    NO_CONSPIRACY_PICK,
    conspiracyPlayOf,
    conspiracyPrizes,
    conspiracyTargets,
    type ConspiracyPick,
    type TakePrizeOption
} from './conspiracyTake.js'

export class OathGameSession extends GameSession<OathProjectedState, HydratedOathGameState> {
    selection = new OathSelection()
    readonly search = new SearchDraft(this)
    readonly question = new QuestionDraft(this)
    readonly victory = new VictoryDraft(this)
    readonly defence = new DefenceDraft(this)
    readonly attackPlans = new AttackPlansDraft(this)
    readonly defeat = new DefeatDraft(this)
    readonly attackerLosses = new AttackerLossesDraft(this)
    readonly wake = new WakeDraft(this)
    readonly rest = new RestDraft(this)
    readonly actionPowers = new ActionPowersDraft(this)
    readonly citizenship = new CitizenshipDraft(this)
    readonly consent = new ConsentDraft(this)
    readonly seatDetail = new SeatDetail(this)
    readonly goalsView = new GoalsView()

    readonly campaign = new CampaignDraft(this)
    readonly setup = new SetupDraft(this)
    readonly modifiers = new ModifierDeclarations(this)
    readonly warbandMoves = new WarbandMoveDraft(this)

    // docs/ui-interaction-visual-contract.md — every draft reads as empty while a send or a new state is under way.
    get liveSeatId(): string | undefined {
        const settled = !this.processingActions && !this.updatingVisibleState
        return this.isPlayable && !this.isViewingHistory && settled ? this.myPlayer?.id : undefined
    }

    get liveTurnSeatId(): string | undefined {
        return this.isMyTurn ? this.liveSeatId : undefined
    }

    // At most one panel is on screen, so at most one of these holds picks.
    private get panelDrafts(): PanelDraft[] {
        return [
            this.search,
            this.question,
            this.victory,
            this.attackerLosses,
            this.attackPlans,
            this.defence,
            this.defeat,
            this.wake,
            this.rest,
            this.actionPowers,
            this.citizenship,
            this.consent,
            this.campaign
        ]
    }

    get hasManualDraft(): boolean {
        return (
            this.selection.hasManualSelection() ||
            this.panelDrafts.some((draft) => draft.hasManualSelection())
        )
    }

    resetAction(): void {
        this.seatCardLetPeekOpen = false
        this.selection.reset()
        this.clearActionDrafts()
        for (const draft of this.panelDrafts) draft.reset()
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    // Back unwinds manual picks only: an auto pick stays when nothing manual is left.
    back(): void {
        if (this.busy) return
        if (this.panelDrafts.some((draft) => draft.back())) return
        const action = this.selection.action
        if (this.selection.back() === undefined) return
        if (this.selection.action !== action) this.clearActionDrafts()
    }

    override async undo(): Promise<void> {
        if (this.busy) return
        if (this.hasManualDraft) {
            this.back()
            return
        }
        await super.undo()
    }

    private clearActionDrafts(): void {
        this.actionPowers.reset()
        this.citizenship.reset()
        this.campaign.reset()
    }

    async resolveSetup(
        siteId: string,
        adviserCardId: string,
        discardOrder: string[],
        siteFavor?: SiteFavor[]
    ): Promise<void> {
        await this.commit(
            this.createPlayerAction(SetupChoice, {
                type: ActionType.SetupChoice,
                siteId,
                adviserCardId,
                discardOrder,
                ...(siteFavor ? { siteFavor } : {})
            })
        )
    }

    async resolveWake(favorSteps: WakeFavorStep[], sitePowerTake?: OpportunityTake): Promise<void> {
        await this.commit(
            this.createPlayerAction(ResolveWake, {
                type: ActionType.ResolveWake,
                favorSteps,
                ...(sitePowerTake ? { sitePowerTake } : {})
            })
        )
    }

    async endActPhase(): Promise<void> {
        await this.commit(this.createPlayerAction(EndActPhase, { type: ActionType.EndActPhase }))
    }

    get historyNames(): HistoryNames {
        return {
            player: (playerId) => this.getPlayerName(playerId),
            site: (slotId) => siteName(this.gameState, slotId)
        }
    }

    async forgoFreeAction(): Promise<void> {
        await this.commit(
            this.createPlayerAction(ForgoFreeAction, { type: ActionType.ForgoFreeAction })
        )
    }

    async completeRest(): Promise<void> {
        await this.commit(this.createPlayerAction(CompleteRest, { type: ActionType.CompleteRest }))
    }

    async useRestPower(cardId: string, powerIndex: number, choices: PowerChoice[]): Promise<void> {
        await this.commit(
            this.createPlayerAction(UseRestPower, {
                type: ActionType.UseRestPower,
                cardId,
                powerIndex,
                choices
            })
        )
    }

    // R-X.1 — a Wake with nothing to decide is resolved by the engine.
    get wakeNeedsDecision(): boolean {
        const playerId = this.myPlayer?.id
        return (
            this.gameState.machineState === MachineState.WakePhase &&
            playerId !== undefined &&
            !HydratedResolveWake.nothingToDecide(this.gameState, playerId)
        )
    }

    reasonCannotChooseOathkeeper(candidateId: string): string | undefined {
        const playerId = this.myPlayer?.id
        assertExists(playerId, 'The Oathkeeper title is passed on from a seat')
        return HydratedResolveOathkeeper.reasonCannotResolveOathkeeper(
            this.gameState,
            playerId,
            candidateId
        )
    }

    async resolveOathkeeper(chosenPlayerId: string): Promise<void> {
        await this.commit(
            this.createPlayerAction(ResolveOathkeeper, {
                type: ActionType.ResolveOathkeeper,
                chosenPlayerId
            })
        )
    }

    async answerCitizenshipOffer(
        granted: boolean,
        replacementChoice?: WarbandGroup[]
    ): Promise<void> {
        await this.commit(
            this.createPlayerAction(ResolveCitizenshipOffer, {
                type: ActionType.ResolveCitizenshipOffer,
                granted,
                ...(replacementChoice ? { replacementChoice } : {})
            })
        )
    }

    /** R-6.5.a, R-6.5.b, R-5.5.2.a — the request this seat is asked to answer, if any. */
    get consentAsked(): PendingConsent | undefined {
        const pending = this.gameState.pendingConsent
        return pending !== undefined &&
            pending.request.kind !== ConsentRequestKind.CitizenshipOffer &&
            pending.askedPlayerId === this.liveSeatId
            ? pending
            : undefined
    }

    get consentGrantBlockedBecause(): string | undefined {
        const playerId = this.liveSeatId
        if (!playerId || !this.consentAsked) return undefined
        return HydratedAnswerConsent.reasonCannotAnswer(this.gameState, playerId, true)
    }

    async answerConsent(granted: boolean): Promise<void> {
        await this.commit(
            this.createPlayerAction(AnswerConsent, { type: ActionType.AnswerConsent, granted })
        )
    }

    async answerQuestion(answer: QuestionAnswer): Promise<void> {
        await this.commit(
            this.createPlayerAction(AnswerQuestion, { type: ActionType.AnswerQuestion, answer })
        )
    }

    // Sneak Attack — the defender is the one the card names.
    get sneakAttackDefenderId(): string | undefined {
        const playerId = this.liveSeatId
        if (!playerId) return undefined
        return sneakAttackOfferedTo(this.gameState, playerId)?.defenderPlayerId
    }

    startSneakAttack(): void {
        if (this.sneakAttackDefenderId === undefined) return
        this.chooseAction(ActionType.Campaign)
    }

    // R-5.5.1 — nothing right after Knights Errant or Hunting Party, or as a Sneak Attack.
    get campaignSupplyCost(): number | undefined {
        const playerId = this.myPlayer?.id
        return playerId ? HydratedCampaign.supplyCostFor(this.gameState, playerId) : undefined
    }

    async declareCampaign(declaration: CampaignDeclaration): Promise<void> {
        const { defender, targets, attackDice, plans, flipSecret, skullLossOrder } = declaration
        await this.commit(
            this.createPlayerAction(Campaign, {
                type: ActionType.Campaign,
                defender,
                targets,
                attackDice,
                ...(plans.length > 0 ? { plans } : {}),
                ...(flipSecret ? { flipSecret: true } : {}),
                ...(skullLossOrder ? { skullLossOrder } : {})
            })
        )
    }

    async declareAttackPlans(plans: BattlePlanUse[]): Promise<void> {
        await this.commit(
            this.createPlayerAction(CampaignAttackPlans, {
                type: ActionType.CampaignAttackPlans,
                plans
            })
        )
    }

    async defendCampaign(plans: BattlePlanUse[]): Promise<void> {
        await this.commit(
            this.createPlayerAction(CampaignDefend, { type: ActionType.CampaignDefend, plans })
        )
    }

    // R-5.5.5, R-5.5.6 — the attacker's own losses; the defending side picks its own.
    async resolveCampaignSacrifice(
        sacrifice: number,
        sacrificeKills: WarbandGroup[] | undefined,
        defeatKills: WarbandGroup[]
    ): Promise<void> {
        await this.commit(
            this.createPlayerAction(CampaignSacrifice, {
                type: ActionType.CampaignSacrifice,
                sacrifice,
                ...(sacrificeKills ? { sacrificeKills } : {}),
                defeatKills
            })
        )
    }

    async chooseDefeatKills(kills: WarbandGroup[]): Promise<void> {
        await this.commit(
            this.createPlayerAction(CampaignDefeatKills, {
                type: ActionType.CampaignDefeatKills,
                kills
            })
        )
    }

    async resolveCampaignVictory(
        placements: CampaignPlacement[],
        burnFavor: boolean,
        bottomRelicSlotIds: string[],
        banishToSiteId?: string,
        banish?: boolean
    ): Promise<void> {
        await this.commit(
            this.createPlayerAction(CampaignResolveVictory, {
                type: ActionType.CampaignResolveVictory,
                placements,
                burnFavor,
                ...(banishToSiteId ? { banishToSiteId } : {}),
                ...(banish ? { banish } : {}),
                ...(bottomRelicSlotIds.length > 0 ? { bottomRelicSlotIds } : {})
            })
        )
    }

    private get legalAdvisers(): string[] {
        const playerId = this.liveTurnSeatId
        if (!playerId) return []
        if (this.selection.action !== ActionType.PlayFacedownAdviser) return []
        return HydratedPlayFacedownAdviser.legalCards(this.gameState, playerId)
    }

    // R-6.1 — the adviser tapped on the seat card, or the only legal one.
    get adviserCardId(): string | undefined {
        const legal = this.legalAdvisers
        const manual =
            this.selection.action === ActionType.PlayFacedownAdviser
                ? this.selection.value('card')
                : undefined
        if (manual !== undefined && legal.includes(manual)) return manual
        return legal.length === 1 ? legal[0] : undefined
    }

    get selectableAdvisers(): string[] {
        return this.adviserCardId === undefined ? this.legalAdvisers : []
    }

    get facedownAdviserOptions(): { cardId: string; placements: AdviserPlacement[] }[] {
        const playerId = this.liveTurnSeatId
        if (!playerId) return []
        return this.legalAdvisers.map((cardId) => ({
            cardId,
            placements: adviserPlacements(this.gameState, playerId, cardId)
        }))
    }

    // R-6.3 — the relics a Peek can show that this player has not already seen.
    get peekSlots(): string[] {
        const playerId = this.liveTurnSeatId
        if (!playerId || this.selection.action !== ActionType.Peek) return []
        return unseenPeekSlots(this.gameState, playerId)
    }

    // R-9.4 — at any time, from the seat card or the Act Phase grid.
    private seatCardLetPeekOpen = $state(false)

    // Visual contract, "Coexistence": one let-peek picker; in this seat's Act Phase it is the staged action.
    get letPeekIsStaged(): boolean {
        return (
            this.liveTurnSeatId !== undefined &&
            this.gameState.machineState === MachineState.ActPhase
        )
    }

    get letPeekOpen(): boolean {
        return this.letPeekIsStaged
            ? this.selection.action === ActionType.LetPeek
            : this.seatCardLetPeekOpen
    }

    get canLetPeek(): boolean {
        return this.liveSeatId !== undefined && this.validActionTypes.includes(ActionType.LetPeek)
    }

    get letPeekShows(): { subject: LetPeekSubject; toPlayerIds: string[] }[] {
        const playerId = this.liveSeatId
        if (!playerId || !this.canLetPeek) return []
        return HydratedLetPeek.legalShows(this.gameState, playerId)
    }

    toggleLetPeek(): void {
        if (!this.canLetPeek) return
        if (!this.letPeekIsStaged) {
            this.seatCardLetPeekOpen = !this.seatCardLetPeekOpen
        } else if (this.letPeekOpen) {
            this.resetAction()
        } else {
            this.chooseAction(ActionType.LetPeek)
        }
    }

    get exileTargets(): string[] {
        const playerId = this.liveTurnSeatId
        if (!playerId || this.selection.action !== ActionType.ExileCitizen) return []
        return HydratedExileCitizen.legalTargets(this.gameState, playerId)
    }

    chooseAdviser(cardId: string): void {
        if (this.selectableAdvisers.includes(cardId)) this.selection.set('card', cardId)
    }

    // R-6.1, R-7.3.3 — a play whose When Played text asks for choices waits for them.
    async chooseAdviserPlay(cardId: string, play: SearchPlay): Promise<void> {
        const playerId = this.liveTurnSeatId
        if (!playerId || this.adviserCardId !== cardId) return
        const placement = this.facedownAdviserOptions
            .find((adviser) => adviser.cardId === cardId)
            ?.placements.find((p) => p.play === play)
        const asks =
            (placement?.room.needed ?? 0) > 0 ||
            (play === SearchPlay.Site &&
                (adviserOtherSites(this.gameState, playerId, cardId).length > 0 ||
                    adviserDiscardFirstOptions(this.gameState, playerId, cardId, undefined).length >
                        0)) ||
            whenPlayedChoices(this.gameState, playerId, cardId, play, true).length > 0 ||
            (play === SearchPlay.Conspiracy &&
                conspiracyTargets(this.gameState, playerId).length > 0)
        if (!asks) {
            await this.playFacedownAdviser(cardId, play)
            return
        }
        this.selection.set('option', play)
    }

    /** R-5.1.4.IV — the players an R-6.1 Conspiracy play may take from. */
    get adviserConspiracyTargets(): string[] {
        const playerId = this.liveTurnSeatId
        return playerId && this.adviserPlay === SearchPlay.Conspiracy
            ? conspiracyTargets(this.gameState, playerId)
            : []
    }

    adviserConspiracyPrizesOf(targetPlayerId: string): TakePrizeOption[] {
        const playerId = this.liveTurnSeatId
        return playerId ? conspiracyPrizes(this.gameState, playerId, targetPlayerId) : []
    }

    get adviserConspiracyPick(): ConspiracyPick {
        return this.selection.value('conspiracy') ?? NO_CONSPIRACY_PICK
    }

    setAdviserConspiracyPick(pick: Omit<ConspiracyPick, 'confirmed'>): void {
        if (this.adviserConspiracyTargets.length > 0) {
            this.selection.set('conspiracy', { ...pick, confirmed: false })
        }
    }

    private get adviserConspiracy() {
        const playerId = this.liveTurnSeatId
        return playerId && this.adviserConspiracyTargets.length > 0
            ? conspiracyPlayOf(this.gameState, playerId, this.adviserConspiracyPick)
            : undefined
    }

    private get stagedAdviserPlacement(): AdviserPlacement | undefined {
        const option = this.selection.value('option')
        return this.facedownAdviserOptions
            .find((adviser) => adviser.cardId === this.adviserCardId)
            ?.placements.find((p) => p.play === option && p.blockedBecause === undefined)
    }

    /** The placement waiting on its picks: discards over the limit, When Played choices, a take. */
    get adviserPlay(): SearchPlay | undefined {
        return this.stagedAdviserPlacement?.play
    }

    /** R-6.1, R-7.6.4 — the advisers a limiter turned faceup must discard. */
    get adviserPlayRoom(): AdviserRoom {
        return this.stagedAdviserPlacement?.room ?? { needed: 0, discardable: [] }
    }

    get adviserPlayDiscards(): string[] {
        const room = this.adviserPlayRoom
        return (this.selection.value('adviserDiscards') ?? []).filter((id) =>
            room.discardable.includes(id)
        )
    }

    toggleAdviserPlayDiscard(cardId: string): void {
        const room = this.adviserPlayRoom
        if (room.needed === 0) return
        this.selection.set(
            'adviserDiscards',
            toggledDiscard(this.adviserPlayDiscards, room, cardId)
        )
    }

    /** R-5.1.4.I the People's Favor — the other sites a staged site play may go to. */
    get adviserOtherSites(): string[] {
        const playerId = this.liveTurnSeatId
        const cardId = this.adviserCardId
        if (!playerId || !cardId || this.adviserPlay !== SearchPlay.Site) return []
        return adviserOtherSites(this.gameState, playerId, cardId)
    }

    get adviserToSite(): string | undefined {
        const siteId = this.selection.value('toSite')
        return siteId !== undefined && this.adviserOtherSites.includes(siteId) ? siteId : undefined
    }

    setAdviserToSite(siteId: string | undefined): void {
        if (siteId === undefined) this.selection.clearFrom('toSite')
        else if (this.adviserOtherSites.includes(siteId)) this.selection.set('toSite', siteId)
    }

    /** R-11.10 the Great Slum, R-5.1.4.I the People's Favor — a denizen discarded before the site play. */
    get adviserDiscardFirstOptions(): string[] {
        const playerId = this.liveTurnSeatId
        const cardId = this.adviserCardId
        if (!playerId || !cardId || this.adviserPlay !== SearchPlay.Site) return []
        return adviserDiscardFirstOptions(this.gameState, playerId, cardId, this.adviserToSite)
    }

    get adviserDiscardFirst(): string | undefined {
        const cardId = this.selection.value('discardFirst')
        return cardId !== undefined && this.adviserDiscardFirstOptions.includes(cardId)
            ? cardId
            : undefined
    }

    setAdviserDiscardFirst(cardId: string | undefined): void {
        if (cardId === undefined) this.selection.clearFrom('discardFirst')
        else if (this.adviserDiscardFirstOptions.includes(cardId))
            this.selection.set('discardFirst', cardId)
    }

    get adviserPlayChoices(): LegalChoice[] {
        const playerId = this.liveTurnSeatId
        const cardId = this.adviserCardId
        const play = this.adviserPlay
        if (!playerId || !cardId || play === undefined) return []
        return whenPlayedChoices(this.gameState, playerId, cardId, play, true)
    }

    get adviserPlayPicks(): PowerChoicePicks {
        return this.selection.value('whenPlayed') ?? emptyPicks()
    }

    setAdviserPlayPicks(picks: PowerChoicePicks): void {
        if (this.adviserPlayChoices.length > 0) this.selection.set('whenPlayed', picks)
    }

    private get adviserPlayPicked(): PowerChoice[] {
        return powerChoicesFrom(this.adviserPlayChoices, this.adviserPlayPicks)
    }

    get adviserPlayReason(): string | undefined {
        const playerId = this.liveTurnSeatId
        const cardId = this.adviserCardId
        const play = this.adviserPlay
        if (!playerId || !cardId || play === undefined) return undefined
        return HydratedPlayFacedownAdviser.reasonCannotPlay(this.gameState, playerId, {
            cardId,
            play,
            choices: this.adviserPlayPicked,
            conspiracy: this.adviserConspiracy,
            discardedAdviserCardIds: this.adviserPlayDiscards,
            toSiteId: this.adviserToSite,
            discardFirstCardId: this.adviserDiscardFirst
        })
    }

    async confirmAdviserPlay(): Promise<void> {
        const cardId = this.adviserCardId
        const play = this.adviserPlay
        if (!cardId || play === undefined || this.adviserPlayReason !== undefined) return
        await this.playFacedownAdviser(
            cardId,
            play,
            this.adviserPlayPicked,
            this.adviserConspiracy,
            this.adviserPlayDiscards,
            this.adviserToSite,
            this.adviserDiscardFirst
        )
    }

    private async playFacedownAdviser(
        cardId: string,
        play: SearchPlay,
        choices?: PowerChoice[],
        conspiracy?: ConspiracyPlay,
        discardedAdviserCardIds: string[] = [],
        toSiteId?: string,
        discardFirstCardId?: string
    ): Promise<void> {
        await this.commit(
            this.createPlayerAction(PlayFacedownAdviser, {
                type: ActionType.PlayFacedownAdviser,
                cardId,
                play,
                ...(choices && choices.length > 0 ? { choices } : {}),
                ...(conspiracy ? { conspiracy } : {}),
                ...(discardedAdviserCardIds.length > 0 ? { discardedAdviserCardIds } : {}),
                ...(toSiteId ? { toSiteId } : {}),
                ...(discardFirstCardId ? { discardFirstCardId } : {})
            })
        )
    }

    async useActionPower(
        cardId: string,
        powerIndex: number,
        choices: PowerChoice[]
    ): Promise<void> {
        await this.commit(
            this.createPlayerAction(UseActionPower, {
                type: ActionType.UseActionPower,
                cardId,
                powerIndex,
                choices
            })
        )
    }

    // R-6.1, R-9.4, R-6.6.1
    async letPeek(subject: LetPeekSubject, toPlayerId: string): Promise<void> {
        if (!this.canLetPeek) return
        await this.commit(
            this.createPlayerAction(LetPeek, {
                type: ActionType.LetPeek,
                outOfTurn: true,
                sequenced: true,
                toPlayerId,
                subject
            })
        )
    }

    async exileCitizen(citizenPlayerId: string): Promise<void> {
        await this.commit(
            this.createPlayerAction(ExileCitizen, {
                type: ActionType.ExileCitizen,
                citizenPlayerId
            })
        )
    }

    async selfExile(): Promise<void> {
        await this.commit(this.createPlayerAction(SelfExile, { type: ActionType.SelfExile }))
    }

    async offerCitizenship(
        exilePlayerId: string,
        reliquarySlotId: string,
        terms: CitizenshipTerms | undefined
    ): Promise<void> {
        await this.commit(
            this.createPlayerAction(OfferCitizenship, {
                type: ActionType.OfferCitizenship,
                exilePlayerId,
                reliquarySlotId,
                ...(terms ? { terms } : {})
            })
        )
    }

    async moveWarbands(option: WarbandMoveOption, count: number): Promise<void> {
        await this.commit(
            this.createPlayerAction(MoveWarbands, {
                type: ActionType.MoveWarbands,
                move: option.move,
                owner: option.owner,
                count
            })
        )
    }

    // R-6.3 — a Peek, by tapping the relic where it sits.
    async choosePeek(target: PeekTarget): Promise<void> {
        if (this.selection.action !== ActionType.Peek) return
        await this.commit(this.createPlayerAction(Peek, { type: ActionType.Peek, target }))
    }

    get selectableSites(): string[] {
        const playerId = this.liveTurnSeatId
        if (!playerId) return []
        const pick = this.setup.boardPick
        if (pick) return pick.sites
        if (this.selection.action === ActionType.Campaign) return this.campaign.targetableSites
        if (this.selection.action === ActionType.MoveWarbands) {
            const siteId = this.gameState.getPlayerState(playerId).siteId
            const ontoSite = this.warbandMoves.options.some(
                (option) => option.move.kind === WarbandMoveKind.BoardToSite
            )
            return ontoSite && siteId ? [siteId] : []
        }
        if (this.selection.action !== ActionType.Travel) return []
        if (this.selection.value('site') !== undefined) return []
        return HydratedTravel.legalDestinations(this.gameState, playerId, this.modifiers.declared)
    }

    get siteOffers(): SiteOffer[] {
        const playerId = this.liveTurnSeatId
        if (!playerId) return []
        const sites = this.selectableSites
        const pick = this.setup.boardPick
        if (pick) return sites.map((slotId) => ({ slotId, intent: 'start', label: pick.label }))
        switch (this.selection.action) {
            case ActionType.Campaign:
                return sites.map((slotId) => ({
                    slotId,
                    intent: 'target',
                    targeted: this.campaign.isTargetedSite(slotId)
                }))
            case ActionType.MoveWarbands:
                return sites.map((slotId) => ({ slotId, intent: 'moveWarbands' }))
            case ActionType.Travel:
                return sites.map((slotId) => {
                    const ways = this.travelWaysTo(slotId)
                    return {
                        slotId,
                        intent: 'travel',
                        cost: travelCost(ways),
                        toll: tollLabel(
                            this.gameState,
                            playerId,
                            { kind: 'travel', toSiteId: slotId },
                            (id) => this.getPlayerName(id),
                            ways
                        )
                    }
                })
            default:
                return []
        }
    }

    get mapDimmed(): boolean {
        return this.siteOffers.some((offer) => offer.intent !== 'moveWarbands')
    }

    // R-5.3.2 — Trade's legality is per option, so a card is offered if either is legal;
    // a tap only marks its row in the Trade menu, so every card stays offered.
    get selectableCards(): string[] {
        const playerId = this.liveTurnSeatId
        if (!playerId) return []
        if (this.selection.action === ActionType.Trade) {
            return HydratedTrade.legalCards(this.gameState, playerId, this.modifiers.declared)
        }
        if (this.selection.value('card') !== undefined) return []
        if (this.selection.action === ActionType.Muster) {
            return HydratedMuster.legalCards(this.gameState, playerId, this.modifiers.declared)
        }
        return []
    }

    // R-5.3.2, R-7.4 — every trade at the site, priced with the declared modifiers.
    get tradeRows(): TradeRow[] {
        const playerId = this.liveTurnSeatId
        if (!playerId || this.selection.action !== ActionType.Trade) return []
        return tradeRows(this.gameState, playerId, this.modifiers.declared)
    }

    // R-5.2, R-7.4 — every Muster at the site, with the declared modifiers.
    get musterRows(): MusterRow[] {
        const playerId = this.liveTurnSeatId
        if (!playerId || this.selection.action !== ActionType.Muster) return []
        return musterRows(this.gameState, playerId, this.modifiers.declared)
    }

    /** R-5.2.2 — a Citizen musters the Empire's warbands. */
    get musterWarbandOwner(): WarbandOwner | undefined {
        const playerId = this.liveTurnSeatId
        return playerId ? HydratedMuster.warbandOwnerFor(this.gameState, playerId) : undefined
    }

    // R-5.4, R-6.3 — relic slots, never card ids: a facedown relic's identity
    // is in the vault.
    get selectableRelicSlots(): string[] {
        const playerId = this.liveTurnSeatId
        if (!playerId) return []
        if (this.selection.value('relicSlot') !== undefined) return []
        if (this.selection.action === ActionType.Peek) return this.peekSlots
        if (this.selection.action !== ActionType.Recover) return []
        return recoverableRelicSlots(this.gameState, playerId, this.modifiers.declared)
    }

    get recoverableBanners(): BannerBid[] {
        const playerId = this.liveTurnSeatId
        if (!playerId || this.selection.action !== ActionType.Recover) return []
        return recoverableBanners(this.gameState, playerId, this.modifiers.declared)
    }

    // R-5.4 — every relic and banner to recover, until a banner is picked and its price asked.
    get recoverRows(): { relics: RecoverRelicRow[]; banners: BannerBid[] } {
        const playerId = this.liveTurnSeatId
        if (!playerId || this.selection.action !== ActionType.Recover || this.stagedBanner) {
            return { relics: [], banners: [] }
        }
        return recoverRows(this.gameState, playerId, this.modifiers.declared)
    }

    /** The lowest bid a Recover may pay for this banner, while it is one the seat may take. */
    bannerBid(banner: Banner): number | undefined {
        return this.bidsFor(banner)[0]
    }

    private bidsFor(banner: Banner | undefined): number[] {
        return this.recoverableBanners.find((bid) => bid.banner === banner)?.amounts ?? []
    }

    // R-5.4.2 — tapping a lit banner stages it; the bid and, for the People's Favor, the start bank follow.
    pickBanner(banner: Banner): void {
        if (this.bannerBid(banner) !== undefined) this.selection.set('banner', banner)
    }

    get stagedBanner(): Banner | undefined {
        const banner = this.selection.value('banner')
        return this.bidsFor(banner).length > 0 ? banner : undefined
    }

    get bannerAmounts(): number[] {
        return this.bidsFor(this.stagedBanner)
    }

    // The lowest bid is shown until the player changes it.
    get bannerAmount(): number | undefined {
        const amounts = this.bannerAmounts
        const picked = this.selection.value('amount')
        return picked !== undefined && amounts.includes(picked) ? picked : amounts[0]
    }

    setBannerAmount(amount: number): void {
        if (this.bannerAmounts.includes(amount)) this.selection.set('amount', amount)
    }

    /** R-5.4.4 — asked only for the People's Favor, whose old favor returns to the banks. */
    get needsFavorStart(): boolean {
        return this.stagedBanner === Banner.PeoplesFavor
    }

    get favorStart(): Suit | undefined {
        return this.needsFavorStart ? this.selection.value('favorStart') : undefined
    }

    setFavorStart(suit: Suit): void {
        if (this.needsFavorStart) this.selection.set('favorStart', suit)
    }

    get bannerRecoverReason(): string | undefined {
        const playerId = this.liveTurnSeatId
        const banner = this.stagedBanner
        const amount = this.bannerAmount
        if (!playerId || !banner || amount === undefined) return 'choose a banner'
        return reasonCannotRecoverBanner(
            this.gameState,
            playerId,
            this.modifiers.declared,
            banner,
            amount,
            this.favorStart
        )
    }

    // R-5.1.1, R-7.4 — every source with its price, each pile a declared modifier may name.
    get searchRows(): SearchRow[] {
        const playerId = this.liveTurnSeatId
        if (!playerId || this.selection.action !== ActionType.Search) return []
        return searchRows(
            this.gameState,
            playerId,
            this.modifiers.declared,
            this.modifiers.regionVariants
        )
    }

    async searchFrom(row: SearchRow): Promise<void> {
        if (row.variant !== undefined) {
            const variant = this.modifiers.regionVariants[row.variant]
            assertExists(variant, 'A Search row names a pile its modifier offers')
            this.modifiers.setPicks(variant.use, variant.picks)
        }
        await this.chooseSearchSource(row.source)
    }

    knownRelicAt(slotId: string | undefined): string | undefined {
        return peekedRelicAt(this.gameState, this.myPlayer?.id, slotId)
    }

    /** R-10.13 — warbands show their owner's seat colour; the Empire's show the Chancellor's. */
    warbandColor(owner: WarbandOwner): Color {
        return this.colors.getPlayerColor(this.gameState.warbandBankHolderOf(owner))
    }

    get historyRows(): HistoryRow[] {
        return historyRows(this.actions, this.majorEventContext)
    }

    /** R-3 — the finished game's top row: its winner, its ending, its title or Vision. */
    get gameEndRow(): (MajorEvent & { sentence: string }) | undefined {
        const state = this.gameState
        const [winnerId] = state.winningPlayerIds
        const rule = endingRule(this.actions)
        if (winnerId === undefined || rule === undefined) return undefined
        return gameEndEvent(
            winnerId,
            rule,
            state.round,
            state.getPlayerState(winnerId).revealedVisionId,
            this.majorEventContext
        )
    }

    private get majorEventContext(): Omit<MajorEventContext, 'campaign'> {
        return {
            viewerId: this.myPlayer?.id,
            nameOf: (playerId) => this.getPlayerName(playerId),
            oathType: this.gameState.oathType
        }
    }

    /** R-10.13 — a History row's warbands in their owner's colour, the Empire's in the Chancellor's. */
    historyWarbandColors(action: GameAction): { own: Color; imperial: Color } {
        const imperial = this.warbandColor(IMPERIAL_WARBANDS)
        const owner = rowWarbandOwner(action, (playerId) =>
            ownWarbandOwner(this.gameState, playerId)
        )
        return { own: owner === undefined ? imperial : this.warbandColor(owner), imperial }
    }

    warbandOwnerName(owner: WarbandOwner): string {
        return warbandOwnerName(owner, (playerId) => this.getPlayerName(playerId))
    }

    chooseAction(type: ActionType): void {
        if (this.selection.action !== type) this.clearActionDrafts()
        this.selection.set('action', type)
        if (type === ActionType.Campaign) this.campaign.begin()
    }

    /** R-7.4 — the cards behind "Use a power" that change an action's menu, or make it possible. */
    get actionCards(): ActionCard[] {
        const playerId = this.liveTurnSeatId
        return playerId ? actionCards(this.gameState, playerId) : []
    }

    /** Opens the card's action with the card in use; nothing is sent. */
    openActionWithCard(card: ActionCard): void {
        this.chooseAction(card.action)
        this.modifiers.open(powerUseKey(card))
    }

    async chooseCard(cardId: string): Promise<void> {
        this.selection.set('card', cardId)
        if (this.selection.action === ActionType.Muster) {
            await this.muster(cardId)
            return
        }
    }

    async chooseRelicSlot(slotId: string): Promise<void> {
        if (this.selection.action === ActionType.Peek) {
            await this.choosePeek({ kind: PeekTargetKind.SiteRelic, slotId })
            return
        }
        this.selection.set('relicSlot', slotId)
        await this.commit(
            this.createPlayerAction(Recover, {
                type: ActionType.Recover,
                target: { kind: RecoverTargetKind.Relic, slotId },
                modifiers: this.modifiers.declared
            })
        )
    }

    async recoverBanner(): Promise<void> {
        const banner = this.stagedBanner
        const amount = this.bannerAmount
        if (!banner || amount === undefined || this.bannerRecoverReason !== undefined) return
        await this.commit(
            this.createPlayerAction(Recover, {
                type: ActionType.Recover,
                target: { kind: RecoverTargetKind.Banner, banner },
                amountPaid: amount,
                ...(this.favorStart ? { redistributeFrom: this.favorStart } : {}),
                modifiers: this.modifiers.declared
            })
        )
    }

    async chooseSearchSource(source: SearchSource): Promise<void> {
        const playerId = this.liveTurnSeatId
        assertExists(playerId, 'A Search source is offered only to the live seat')
        this.selection.set('option', source)
        const tolls = defaultTolls(this.gameState, playerId, { kind: 'search' })
        await this.commit(
            this.createPlayerAction(Search, {
                type: ActionType.Search,
                drawFrom: source,
                revealsInfo: true,
                modifiers: this.modifiers.declared,
                ...(tolls.length > 0 ? { tolls } : {})
            })
        )
    }

    async chooseTrade(cardId: string, option: TradeOption): Promise<void> {
        this.selection.set('card', cardId)
        this.selection.set('option', option)
        await this.trade(cardId, option)
    }

    async resolveSearch(resolution: SearchResolveChoice): Promise<void> {
        await this.commit(
            this.createPlayerAction(SearchResolve, {
                type: ActionType.SearchResolve,
                ...resolution
            })
        )
    }

    private travelWaysTo(siteId: string): TravelWay[] {
        const playerId = this.liveTurnSeatId
        if (!playerId) return []
        return travelWays(this.gameState, playerId, siteId, this.modifiers.declared)
    }

    /** R-11.7 — who chooses where this seat's Travel goes, when an enemy rules its Shrouded Wood. */
    get shroudedWoodChooser(): string | undefined {
        const playerId = this.liveTurnSeatId
        if (!playerId || this.selection.action !== ActionType.Travel) return undefined
        return shroudedWoodChooser(this.gameState, playerId)
    }

    get woodTravelReason(): string | undefined {
        const playerId = this.liveTurnSeatId
        if (!playerId) return undefined
        return HydratedTravel.reasonCannotLeaveShroudedWood(this.gameState, playerId, {})
    }

    async travelFromShroudedWood(): Promise<void> {
        if (!this.shroudedWoodChooser || this.woodTravelReason !== undefined) return
        await this.commit(
            this.createPlayerAction(Travel, { type: ActionType.Travel, modifiers: [] })
        )
    }

    // R-5.6, R-7.1.4 — every destination with its ways to pay, unless one is already staged.
    get travelRows(): TravelRow[] {
        const playerId = this.liveTurnSeatId
        if (!playerId || this.selection.action !== ActionType.Travel) return []
        if (this.selection.value('site') !== undefined || this.shroudedWoodChooser) return []
        return travelRows(this.gameState, playerId, this.modifiers.declared)
    }

    async travelTo(siteId: string, way: TravelTerms): Promise<void> {
        if (this.selection.action !== ActionType.Travel) return
        const legal = this.travelWaysTo(siteId).some(
            (w) =>
                w.flipSecret === way.flipSecret &&
                w.tolls.length === way.tolls.length &&
                w.tolls.every((t) => way.tolls.includes(t))
        )
        if (!legal) return
        this.selection.set('site', siteId)
        await this.travelBy(siteId, way)
    }

    private async travelBy(siteId: string, { tolls, flipSecret }: TravelTerms): Promise<void> {
        await this.commit(
            this.createPlayerAction(Travel, {
                type: ActionType.Travel,
                siteId,
                modifiers: this.modifiers.declared,
                ...(tolls.length > 0 ? { tolls } : {}),
                ...(flipSecret ? { flipSecret } : {})
            })
        )
    }

    private async muster(cardId: string): Promise<void> {
        await this.commit(
            this.createPlayerAction(Muster, {
                type: ActionType.Muster,
                cardId,
                modifiers: this.modifiers.declared
            })
        )
    }

    private async trade(cardId: string, option: TradeOption): Promise<void> {
        const playerId = this.liveTurnSeatId
        assertExists(playerId, 'A Trade is offered only to the live seat')
        const tolls = defaultTolls(this.gameState, playerId, { kind: 'trade', cardId })
        await this.commit(
            this.createPlayerAction(Trade, {
                type: ActionType.Trade,
                cardId,
                option,
                modifiers: this.modifiers.declared,
                ...(tolls.length > 0 ? { tolls } : {})
            })
        )
    }

    // Sending ends the flow whatever the outcome: a rejected action must leave
    // the player where they were, not mid-flow against a moved board.
    private async commit(action: GameAction): Promise<void> {
        assert(!this.isViewingHistory, 'An action is sent from the live game, never from history')
        try {
            await this.applyAction(action)
        } finally {
            this.resetAction()
        }
    }
}
