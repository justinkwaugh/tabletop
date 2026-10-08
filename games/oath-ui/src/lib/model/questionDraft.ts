import { assert, assertExists } from '@tabletop/common'
import {
    ActionType,
    HydratedAnswerQuestion,
    PowerQuestionKind,
    SearchPlay,
    Suit,
    banksWithFavor,
    cardPower,
    currentQuestion,
    heldRelicsToBottom,
    payableWoodPicks,
    playersAt,
    shroudedWoodDestinations,
    usableFavor,
    type ConspiracyPlay,
    type ExchangeTerms,
    PowerQuestionValidator,
    type PowerQuestion,
    type ProjectedPowerQuestion,
    type QuestionAnswer
} from '@tabletop/oath'
import { answerCostText } from './actionCards.js'
import { discardOrderOf, isDiscardOrderComplete } from './discardOrder.js'
import { namesAnything } from './exchangeTerms.js'
import {
    advisersToDiscardForConspiracy,
    advisersToDiscardForVision,
    conspiracyFacedownAnswer,
    playVisionAnswer,
    stackOrderAnswer
} from './questionChoices.js'
import { StagedFlow, type PanelDraft, type StagesCover } from './stagedFlow.svelte.js'
import { conspiracyPrizes, conspiracyTargets, type TakePrizeOption } from './conspiracyTake.js'
import { woodRegions, type WoodRegion } from './woodTravel.js'
import type { OathGameSession } from './session.svelte.js'

// Only the stages of the open question's kind are ever set.
type QuestionValueByStage = {
    burn: number
    floorWith: string
    floorTerms: ExchangeTerms
    conspiracyPlay: ConspiracyStepPlay
    takeTarget: string
    takePrize: number
    conspiracyDiscard: string
    visionDiscard: string
    instead: string
    stackOrder: string[]
}

const QUESTION_STAGE_ORDER = [
    'burn',
    'floorWith',
    'floorTerms',
    'conspiracyPlay',
    'takeTarget',
    'takePrize',
    'conspiracyDiscard',
    'visionDiscard',
    'instead',
    'stackOrder'
] as const
const _questionStagesAreCovered: StagesCover<QuestionValueByStage, typeof QUESTION_STAGE_ORDER> =
    true
void _questionStagesAreCovered

// R-5.1.4 — False Prophet's plays, in the order the Search offers them.
const VISION_PLAYS = [SearchPlay.RevealedVision, SearchPlay.Adviser, SearchPlay.Discard] as const

// R-5.1.4-H1 — Inquisitor's plays of the Conspiracy, in the order the Search offers them for it:
// facedown as an adviser, faceup ("Play it", with the take), or discarded.
const CONSPIRACY_PLAYS = [SearchPlay.Adviser, SearchPlay.Conspiracy, SearchPlay.Discard] as const
type ConspiracyStepPlay = SearchPlay.Adviser | SearchPlay.Conspiracy

/** R-X.1 — the asked player's picks for the open question, before the answer is sent. */
export class QuestionDraft implements PanelDraft {
    private flow = new StagedFlow<QuestionValueByStage>(QUESTION_STAGE_ORDER)

    constructor(private readonly session: OathGameSession) {}

    private get playerId(): string | undefined {
        const playerId = this.session.liveSeatId
        const question = currentQuestion(this.session.gameState)
        return playerId !== undefined && question?.askedPlayerId === playerId ? playerId : undefined
    }

    /** The open question, while it is put to this seat, which sees every field of it. */
    get question(): PowerQuestion | undefined {
        const question = this.playerId ? currentQuestion(this.session.gameState) : undefined
        return question && PowerQuestionValidator.Check(question) ? question : undefined
    }

    /** The open question, whoever it is put to; fields protected from this seat are absent. */
    get open(): ProjectedPowerQuestion | undefined {
        return currentQuestion(this.session.gameState)
    }

    /** The open question when it is put to this seat, which sees every field of it. */
    get mine(): PowerQuestion | undefined {
        const question = this.isMine ? this.open : undefined
        return question && PowerQuestionValidator.Check(question) ? question : undefined
    }

    get isMine(): boolean {
        const myId = this.session.myPlayer?.id
        return myId !== undefined && this.open?.askedPlayerId === myId
    }

    get myFavor(): number {
        const myId = this.session.myPlayer?.id
        return myId ? usableFavor(this.session.gameState, myId) : 0
    }

    get favorBanks(): Suit[] {
        return banksWithFavor(this.session.gameState)
    }

    /** Revelation's count, from 1; none until the player picks one ("None" sends 0). */
    get burn(): number | undefined {
        return this.question ? this.flow.value('burn') : undefined
    }

    get floorCandidates(): string[] {
        const question = this.question
        const playerId = this.playerId
        if (question?.kind !== PowerQuestionKind.GatheringFloor || !playerId) return []
        return playersAt(this.session.gameState, question.siteId).filter((id) => id !== playerId)
    }

    get floorWith(): string | undefined {
        const playerId = this.flow.value('floorWith')
        return playerId !== undefined && this.floorCandidates.includes(playerId)
            ? playerId
            : undefined
    }

    get floorTerms() {
        return this.floorWith ? (this.flow.value('floorTerms') ?? {}) : {}
    }

    /** The Gathering — a proposal is a player and some terms. */
    get floorProposed(): boolean {
        return this.floorWith !== undefined && namesAnything(this.floorTerms)
    }

    /** The players here the take could match who hold a relic or banner it may take. */
    get takeTargets(): string[] {
        const playerId = this.playerId
        if (this.question?.kind !== PowerQuestionKind.PlayOrDiscardConspiracy || !playerId)
            return []
        const state = this.session.gameState
        return conspiracyTargets(state, playerId).filter(
            (target) => conspiracyPrizes(state, playerId, target).length > 0
        )
    }

    get takeTarget(): string | undefined {
        const playerId = this.flow.value('takeTarget')
        return playerId !== undefined && this.takeTargets.includes(playerId) ? playerId : undefined
    }

    get takePrizes(): TakePrizeOption[] {
        const target = this.takeTarget
        const playerId = this.playerId
        return target && playerId ? conspiracyPrizes(this.session.gameState, playerId, target) : []
    }

    get takePrizeIndex(): number | undefined {
        const index = this.flow.value('takePrize')
        return index !== undefined && index < this.takePrizes.length ? index : undefined
    }

    get takePrize() {
        return this.takePrizeIndex === undefined
            ? undefined
            : this.takePrizes[this.takePrizeIndex].prize
    }

    get conspiracy(): ConspiracyPlay | undefined {
        const target = this.takeTarget
        const take = this.takePrize
        return target && take ? { targetPlayerId: target, take } : undefined
    }

    /** The take is picked whole: nobody (no take, R-5.1.4.IV's "may"), or a player and a prize. */
    get conspiracyComplete(): boolean {
        return this.takeTarget === undefined || this.conspiracy !== undefined
    }

    /** Inquisitor — the plays the engine accepts with some pick; a refused one is not offered. */
    get conspiracyPlays(): SearchPlay[] {
        return CONSPIRACY_PLAYS.filter((play) => {
            if (play === SearchPlay.Adviser)
                return (
                    this.reasonCannot(conspiracyFacedownAnswer()) === undefined ||
                    this.conspiracyDiscards.length > 0
                )
            return this.reasonCannot(this.conspiracyAnswer(play)) === undefined
        })
    }

    /** The play chosen whose picks come after it: the take, or the adviser to discard. */
    get conspiracyStep(): ConspiracyStepPlay | undefined {
        return this.question?.kind === PowerQuestionKind.PlayOrDiscardConspiracy
            ? this.flow.value('conspiracyPlay')
            : undefined
    }

    // R-5.1.4.II — at the adviser limit the Conspiracy goes facedown only over a discarded adviser.
    get conspiracyDiscards(): string[] {
        const playerId = this.playerId
        return this.question?.kind === PowerQuestionKind.PlayOrDiscardConspiracy && playerId
            ? advisersToDiscardForConspiracy(this.session.gameState, playerId)
            : []
    }

    get conspiracyDiscard(): string | undefined {
        const cardId = this.flow.value('conspiracyDiscard')
        return cardId !== undefined && this.conspiracyDiscards.includes(cardId) ? cardId : undefined
    }

    /** The step's picks are made: the take whole, or the adviser to discard picked. */
    get conspiracyStepComplete(): boolean {
        const step = this.conspiracyStep
        if (step === SearchPlay.Conspiracy) return this.conspiracyComplete
        return step === SearchPlay.Adviser && this.conspiracyDiscard !== undefined
    }

    /** Why the engine refuses the step's play as picked, read only once it is complete. */
    get conspiracyRefusedBecause(): string | undefined {
        const step = this.conspiracyStep
        if (step === undefined || !this.conspiracyStepComplete) return undefined
        return this.reasonCannot(this.conspiracyAnswer(step))
    }

    // R-5.1.4.II — at the adviser limit a Vision goes facedown only over a discarded adviser.
    get visionDiscards(): string[] {
        const playerId = this.playerId
        return this.question?.kind === PowerQuestionKind.PlayOrDiscardVision && playerId
            ? advisersToDiscardForVision(this.session.gameState, playerId)
            : []
    }

    get visionDiscard(): string | undefined {
        const cardId = this.flow.value('visionDiscard')
        return cardId !== undefined && this.visionDiscards.includes(cardId) ? cardId : undefined
    }

    get instead(): string | undefined {
        const question = this.question
        const cardId = this.flow.value('instead')
        return question?.kind === PowerQuestionKind.DiscardInstead &&
            cardId !== undefined &&
            question.insteadCardIds.includes(cardId)
            ? cardId
            : undefined
    }

    /** Pilgrimage's drawn cards, which another seat's projection does not name; or cards leaving play for one pile. */
    get stackCards(): string[] {
        const question = this.question
        if (question?.kind === PowerQuestionKind.OrderDrawnCards) return question.cardIds ?? []
        if (question?.kind === PowerQuestionKind.OrderDiscards) return question.cardIds
        return []
    }

    private get stackKind(): PowerQuestionKind.OrderDrawnCards | PowerQuestionKind.OrderDiscards {
        return this.question?.kind === PowerQuestionKind.OrderDiscards
            ? PowerQuestionKind.OrderDiscards
            : PowerQuestionKind.OrderDrawnCards
    }

    get stackTapped() {
        return (this.flow.value('stackOrder') ?? []).filter((id) => this.stackCards.includes(id))
    }

    get stackOrder(): string[] {
        return discardOrderOf(this.stackTapped, this.stackCards)
    }

    get stackComplete(): boolean {
        return isDiscardOrderComplete(this.stackTapped, this.stackCards)
    }

    get stackBlockedBecause(): string | undefined {
        return this.stackComplete
            ? this.reasonCannot(stackOrderAnswer(this.stackKind, this.stackCards, this.stackOrder))
            : undefined
    }

    /** The yes answer has every pick it needs; until then it is not offered. */
    get acceptComplete(): boolean {
        const question = this.mine
        assertExists(question, 'A question is answered only by the seat it is put to')
        switch (question.kind) {
            case PowerQuestionKind.BurnFavorForSecrets:
                return this.burn !== undefined
            case PowerQuestionKind.DiscardInstead:
                return this.instead !== undefined
            case PowerQuestionKind.GatheringFloor:
                return this.floorProposed
            default:
                return true
        }
    }

    /** Why the engine refuses the yes answer as picked, read only once it is complete. */
    get acceptRefusedBecause(): string | undefined {
        const question = this.mine
        assertExists(question, 'A question is answered only by the seat it is put to')
        if (!this.acceptComplete) return undefined
        if (question.kind === PowerQuestionKind.SneakAttack) {
            return this.session.validActionTypes.includes(ActionType.Campaign)
                ? undefined
                : 'a Campaign is not open to you now'
        }
        return this.reasonCannot(this.answer(question, true))
    }

    /** Jinx, Relic Thief — the card's printed cost, paid by the yes answer whatever the roll. */
    get acceptCost(): string | undefined {
        const question = this.mine
        if (
            question?.kind !== PowerQuestionKind.RerollDice &&
            question?.kind !== PowerQuestionKind.RelicThiefRoll
        )
            return undefined
        const power = cardPower(question.cardId, question.powerIndex)
        assertExists(power, `${question.cardId} prints no power ${question.powerIndex}`)
        return answerCostText(power.cost)
    }

    visionBlockedBecause(play: SearchPlay): string | undefined {
        return this.reasonCannot(this.visionAnswer(play))
    }

    /** False Prophet — the plays the engine accepts as picked; a refused one is not offered. */
    get visionPlays(): SearchPlay[] {
        return VISION_PLAYS.filter((play) => this.visionBlockedBecause(play) === undefined)
    }

    async accept(): Promise<void> {
        const question = this.mine
        assertExists(question, 'A question is answered only by the seat it is put to')
        if (question.kind === PowerQuestionKind.SneakAttack) this.session.startSneakAttack()
        else await this.send(this.answer(question, true))
    }

    async decline(): Promise<void> {
        const question = this.mine
        assertExists(question, 'A question is answered only by the seat it is put to')
        await this.send(this.answer(question, false))
    }

    async takeFavorFrom(suit: Suit): Promise<void> {
        await this.send({ kind: PowerQuestionKind.PickFavorBank, suit })
    }

    /** Fae Merchant — the relics held before the draw that may go down; the Grand Scepter never does. */
    get heldRelicsToBottom(): string[] {
        const question = this.question
        if (question?.kind !== PowerQuestionKind.BottomRelic) return []
        return heldRelicsToBottom(this.session.gameState, question.askedPlayerId)
    }

    /** Absent, the drawn relic goes down. */
    async putOnBottom(heldRelicCardId?: string): Promise<void> {
        await this.send({ kind: PowerQuestionKind.BottomRelic, heldRelicCardId })
    }

    async travelTo(siteId: string): Promise<void> {
        await this.send({ kind: PowerQuestionKind.TravelFreeTo, siteId })
    }

    /** R-11.7 — the sites the Shrouded Wood's ruler may send the traveler to. */
    get woodDestinations(): string[] {
        const question = this.question
        if (question?.kind !== PowerQuestionKind.ShroudedWoodDestination) return []
        if (question.travel) return this.woodRegions.flatMap((row) => row.siteIds)
        return shroudedWoodDestinations(
            this.session.gameState,
            question.travelerPlayerId,
            question.fromSiteId
        )
    }

    /** R-11.7 — the traveller's own Travel: the sites they can pay for, by region and price. */
    get woodRegions(): WoodRegion[] {
        const question = this.question
        if (question?.kind !== PowerQuestionKind.ShroudedWoodDestination || !question.travel) {
            return []
        }
        const state = this.session.gameState
        const picks = payableWoodPicks(state, question.travelerPlayerId, question.travel.free)
        return woodRegions(state, picks)
    }

    async sendThrough(siteId: string): Promise<void> {
        if (!this.woodDestinations.includes(siteId)) return
        await this.send({ kind: PowerQuestionKind.ShroudedWoodDestination, siteId })
    }

    async playVision(play: SearchPlay): Promise<void> {
        await this.send(this.visionAnswer(play))
    }

    /** Inquisitor — a play with nothing to pick is sent at once; the take and the room come after. */
    async chooseConspiracyPlay(play: SearchPlay): Promise<void> {
        if (this.question?.kind !== PowerQuestionKind.PlayOrDiscardConspiracy) return
        if (play === SearchPlay.Conspiracy && this.takeTargets.length > 0)
            this.flow.set('conspiracyPlay', play)
        else if (play === SearchPlay.Adviser && this.conspiracyDiscards.length > 0)
            this.flow.set('conspiracyPlay', play)
        else await this.send(this.conspiracyAnswer(play))
    }

    async playConspiracy(): Promise<void> {
        const step = this.conspiracyStep
        if (step === undefined || !this.conspiracyStepComplete) return
        await this.send(this.conspiracyAnswer(step))
    }

    async stack(): Promise<void> {
        await this.send(stackOrderAnswer(this.stackKind, this.stackCards, this.stackOrder))
    }

    private conspiracyAnswer(play: SearchPlay): QuestionAnswer {
        if (play === SearchPlay.Adviser) return conspiracyFacedownAnswer(this.conspiracyDiscard)
        if (play === SearchPlay.Discard)
            return { kind: PowerQuestionKind.PlayOrDiscardConspiracy, play: false }
        const conspiracy = this.conspiracy
        return {
            kind: PowerQuestionKind.PlayOrDiscardConspiracy,
            play: true,
            ...(conspiracy ? { conspiracy } : {})
        }
    }

    private visionAnswer(play: SearchPlay): QuestionAnswer {
        return playVisionAnswer(play, play === SearchPlay.Adviser ? this.visionDiscard : undefined)
    }

    private answer(question: PowerQuestion, yes: boolean): QuestionAnswer {
        switch (question.kind) {
            case PowerQuestionKind.BurnFavorForSecrets: {
                if (!yes) return { kind: question.kind, favor: 0 }
                const favor = this.burn
                assertExists(favor, 'Burning needs the count picked')
                return { kind: question.kind, favor }
            }
            case PowerQuestionKind.PayOrLoseRelic:
                return { kind: question.kind, pay: yes }
            case PowerQuestionKind.Exchange:
                return { kind: question.kind, accept: yes }
            case PowerQuestionKind.JoinSite:
                return { kind: question.kind, join: yes }
            case PowerQuestionKind.KeepOrBottomRelic:
                return { kind: question.kind, keep: yes }
            case PowerQuestionKind.RerollDice:
                return { kind: question.kind, reroll: yes }
            case PowerQuestionKind.TakeOrLeaveRelic:
                return { kind: question.kind, take: yes }
            case PowerQuestionKind.RelicThiefRoll:
                return { kind: question.kind, roll: yes }
            case PowerQuestionKind.DiscardInstead: {
                if (!yes) return { kind: question.kind }
                const insteadCardId = this.instead
                assertExists(insteadCardId, 'Discarding instead needs the card chosen')
                return { kind: question.kind, insteadCardId }
            }
            case PowerQuestionKind.GatheringFloor: {
                if (!yes) return { kind: question.kind }
                const withPlayerId = this.floorWith
                assertExists(withPlayerId, 'A proposal needs the player chosen')
                return { kind: question.kind, proposal: { withPlayerId, terms: this.floorTerms } }
            }
            case PowerQuestionKind.SneakAttack:
                assert(!yes, 'A Sneak Attack is taken by campaigning, not by an answer')
                return { kind: question.kind, campaign: false }
            default:
                throw Error(`A ${question.kind} question is not answered yes or no`)
        }
    }

    private reasonCannot(answer: QuestionAnswer): string | undefined {
        const playerId = this.session.myPlayer?.id
        assertExists(playerId, 'A question is answered from a seat')
        return HydratedAnswerQuestion.reasonCannotAnswer(this.session.gameState, playerId, answer)
    }

    private async send(answer: QuestionAnswer): Promise<void> {
        if (!this.playerId) return
        await this.session.answerQuestion(answer)
    }

    setBurn(favor: number): void {
        if (this.question?.kind === PowerQuestionKind.BurnFavorForSecrets) {
            this.flow.set('burn', Math.max(1, favor))
        }
    }

    chooseFloorWith(playerId: string | undefined): void {
        if (playerId === undefined) this.flow.clearFrom('floorWith')
        else if (this.floorCandidates.includes(playerId)) this.flow.set('floorWith', playerId)
    }

    setFloorTerms(terms: ExchangeTerms): void {
        if (this.floorWith) this.flow.set('floorTerms', terms)
    }

    chooseTakeTarget(playerId: string | undefined): void {
        if (playerId === undefined) this.flow.clearFrom('takeTarget')
        else if (this.takeTargets.includes(playerId)) this.flow.set('takeTarget', playerId)
    }

    chooseTakePrize(index: number | undefined): void {
        if (index === undefined) this.flow.clearFrom('takePrize')
        else if (index < this.takePrizes.length) this.flow.set('takePrize', index)
    }

    chooseConspiracyDiscard(cardId: string | undefined): void {
        if (cardId === undefined) this.flow.clearFrom('conspiracyDiscard')
        else if (this.conspiracyDiscards.includes(cardId))
            this.flow.set('conspiracyDiscard', cardId)
    }

    chooseVisionDiscard(cardId: string | undefined): void {
        if (cardId === undefined) this.flow.clearFrom('visionDiscard')
        else if (this.visionDiscards.includes(cardId)) this.flow.set('visionDiscard', cardId)
    }

    chooseInstead(cardId: string | undefined): void {
        if (cardId === undefined) this.flow.clearFrom('instead')
        else this.flow.set('instead', cardId)
    }

    tapStack(cardId: string): void {
        if (!this.stackCards.includes(cardId) || this.stackTapped.includes(cardId)) return
        this.flow.set('stackOrder', [...this.stackTapped, cardId])
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    back(): boolean {
        const tapped = this.flow.value('stackOrder') ?? []
        if (tapped.length > 1) {
            this.flow.set('stackOrder', tapped.slice(0, -1))
            return true
        }
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }
}
