import { assert, assertExists } from '@tabletop/common'
import {
    ActionType,
    HydratedAnswerQuestion,
    PowerQuestionKind,
    SearchPlay,
    Suit,
    banksWithFavor,
    currentQuestion,
    heldRelicsToBottom,
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
import { discardOrderOf, isDiscardOrderComplete } from './discardOrder.js'
import {
    advisersToDiscardForVision,
    playVisionAnswer,
    stackOrderAnswer
} from './questionChoices.js'
import { StagedFlow, type PanelDraft, type StagesCover } from './stagedFlow.svelte.js'
import { conspiracyPrizes, conspiracyTargets, type TakePrizeOption } from './conspiracyTake.js'
import type { OathGameSession } from './session.svelte.js'

// Only the stages of the open question's kind are ever set.
type QuestionValueByStage = {
    burn: number
    floorWith: string
    floorTerms: ExchangeTerms
    takeTarget: string
    takePrize: number
    visionDiscard: string
    instead: string
    stackOrder: string[]
}

const QUESTION_STAGE_ORDER = [
    'burn',
    'floorWith',
    'floorTerms',
    'takeTarget',
    'takePrize',
    'visionDiscard',
    'instead',
    'stackOrder'
] as const
const _questionStagesAreCovered: StagesCover<QuestionValueByStage, typeof QUESTION_STAGE_ORDER> =
    true
void _questionStagesAreCovered

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

    get burn() {
        return this.question ? (this.flow.value('burn') ?? 0) : 0
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

    get takeTargets(): string[] {
        const playerId = this.playerId
        if (this.question?.kind !== PowerQuestionKind.PlayOrDiscardConspiracy) return []
        return playerId ? conspiracyTargets(this.session.gameState, playerId) : []
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

    get acceptBlockedBecause(): string | undefined {
        const question = this.mine
        assertExists(question, 'A question is answered only by the seat it is put to')
        switch (question.kind) {
            case PowerQuestionKind.SneakAttack:
                return this.session.validActionTypes.includes(ActionType.Campaign)
                    ? undefined
                    : 'a Campaign is not open to you now'
            case PowerQuestionKind.DiscardInstead:
                return this.instead
                    ? this.reasonCannot(this.answer(question, true))
                    : 'choose a card'
            case PowerQuestionKind.GatheringFloor:
                return this.floorWith
                    ? this.reasonCannot(this.answer(question, true))
                    : 'choose a player'
            default:
                return this.reasonCannot(this.answer(question, true))
        }
    }

    visionBlockedBecause(play: SearchPlay): string | undefined {
        return this.reasonCannot(this.visionAnswer(play))
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
        return shroudedWoodDestinations(
            this.session.gameState,
            question.travelerPlayerId,
            question.fromSiteId
        )
    }

    async sendThrough(siteId: string): Promise<void> {
        if (!this.woodDestinations.includes(siteId)) return
        await this.send({ kind: PowerQuestionKind.ShroudedWoodDestination, siteId })
    }

    async playVision(play: SearchPlay): Promise<void> {
        await this.send(this.visionAnswer(play))
    }

    async stack(): Promise<void> {
        await this.send(stackOrderAnswer(this.stackKind, this.stackCards, this.stackOrder))
    }

    private visionAnswer(play: SearchPlay): QuestionAnswer {
        return playVisionAnswer(play, play === SearchPlay.Adviser ? this.visionDiscard : undefined)
    }

    private answer(question: PowerQuestion, yes: boolean): QuestionAnswer {
        switch (question.kind) {
            case PowerQuestionKind.BurnFavorForSecrets:
                return { kind: question.kind, favor: yes ? this.burn : 0 }
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
            case PowerQuestionKind.PlayOrDiscardConspiracy:
                return yes
                    ? { kind: question.kind, play: true, conspiracy: this.conspiracy }
                    : { kind: question.kind, play: false }
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
            this.flow.set('burn', Math.max(0, favor))
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
