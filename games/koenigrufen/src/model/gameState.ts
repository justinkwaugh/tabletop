import {
    assert,
    assertExists,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedRoundManager,
    HydratedTurnManager,
    PrngState,
    RoundManager,
    shuffle,
    Visibility,
    type RandomFunction
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { cardPoints, CardIdSchema, Deck } from '../components/cards.js'
import { callableKings, CalledKingSchema, isCalledKing, type CalledKing } from './kingCall.js'
import {
    Announcements,
    announceableBonuses,
    applyAnnouncement,
    Birds,
    Bonuses,
    doubleTargets,
    doublesOn,
    gameDoubles,
    GameDoubles,
    isAnnouncingOver,
    newAnnouncements,
    Side,
    validateAnnouncement,
    type AnnouncingContext,
    type Bonus,
    type DoubleTarget
} from './announcements.js'
import { BonusResult, scoreBonuses } from './bonusScoring.js'
import {
    Contract,
    contractDefinition,
    ContractSchema,
    Partnership,
    type ContractDefinition
} from '../components/contracts.js'
import {
    Auction,
    BidChoice,
    bidChoice,
    biddableChoices,
    isAuctionOver,
    isAuctionUnopened,
    nameableChoices,
    newAuction,
    remainingBidders,
    sameBid
} from './auction.js'
import {
    scoreGivenUp,
    scorePointGame,
    scoreTrickGame,
    scoreTrischaken,
    ScoreChanges
} from './handScoring.js'
import { HydratedKoenigrufenPlayerState, KoenigrufenPlayerState } from './playerState.js'
import { canLayAway, shownDiscards, talonHalves, untouchedTalonHalfForDeclarer } from './talon.js'
import {
    CompletedTrick,
    legalPlays,
    playRules,
    Trick,
    trickWinner,
    TricksPerHand
} from './tricks.js'

const PacketSize = 6

export type DeclaredContract = Type.Static<typeof DeclaredContract>
export const DeclaredContract = Type.Object({
    ...BidChoice.properties,
    declarerId: Type.String(),
    calledKing: Type.Optional(CalledKingSchema),
    // Declarer conceded when the called King turned up in the talon.
    givenUp: Type.Optional(Type.Boolean())
})

export type HandResult = Type.Static<typeof HandResult>
export const HandResult = Type.Object({
    contract: ContractSchema,
    declarerId: Type.String(),
    partnerId: Type.Optional(Type.String()),
    declarerPoints: Type.Integer(),
    // Negative games score the declarer's tricks instead of card points.
    declarerTricks: Type.Optional(Type.Integer({ minimum: 0 })),
    // Trischaken, each for themselves: everyone's card points and tricks.
    playerPoints: Type.Optional(Type.Record(Type.String(), Type.Integer())),
    playerTricks: Type.Optional(Type.Record(Type.String(), Type.Integer({ minimum: 0 }))),
    made: Type.Boolean(),
    // Kontras on the game, and every bonus scored. A Valat replaces the game.
    gameDoubles: Type.Optional(Type.Array(GameDoubles)),
    bonuses: Type.Optional(Type.Array(BonusResult)),
    valat: Type.Optional(Type.Boolean()),
    givenUp: Type.Optional(Type.Boolean()),
    scoreChanges: ScoreChanges,
    talon: Type.Array(CardIdSchema),
    discards: Type.Array(CardIdSchema)
})

export type KoenigrufenGameState = Type.Static<typeof KoenigrufenGameState>
export const KoenigrufenGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(KoenigrufenPlayerState),
    machineState: Type.Enum(MachineState),
    roundManager: RoundManager,
    totalDeals: Type.Integer({ minimum: 1 }),
    dealerId: Type.String(),
    // Face down until exposed, or until the hand ends when the contract leaves it untouched.
    talon: Visibility.protect(Type.Array(CardIdSchema), { policy: Visibility.Policy.HostOnly }),
    talonHalves: Type.Optional(Type.Array(Type.Array(CardIdSchema))),
    // The exposed half the declarer did not take.
    rejectedTalonHalf: Type.Optional(Type.Array(CardIdSchema)),
    auction: Auction,
    contract: Type.Optional(DeclaredContract),
    calledKingPlayedBy: Type.Optional(Type.String()),
    announcements: Type.Optional(Announcements),
    trick: Type.Optional(Trick),
    tricks: Type.Array(CompletedTrick),
    // An ouvert game has laid every hand open.
    handsShown: Type.Optional(Type.Boolean())
})

export const KoenigrufenGameStateValidator = Compile(KoenigrufenGameState)
export const KoenigrufenProjectedState = Visibility.createProjectionSchema(KoenigrufenGameState)
export type KoenigrufenProjectedState = Type.Static<typeof KoenigrufenProjectedState>
const KoenigrufenProjectedStateValidator = Compile(KoenigrufenProjectedState)

export class HydratedKoenigrufenGameState
    extends HydratableGameState<typeof KoenigrufenProjectedState, HydratedKoenigrufenPlayerState>
    implements KoenigrufenProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedKoenigrufenPlayerState[]
    declare turnManager: HydratedTurnManager
    declare roundManager: HydratedRoundManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare totalDeals: number
    declare dealerId: string
    declare talon?: string[]
    declare talonHalves?: string[][]
    declare rejectedTalonHalf?: string[]
    declare auction: Auction
    declare contract?: DeclaredContract
    declare calledKingPlayedBy?: string
    declare announcements?: Announcements
    declare trick?: Trick
    declare tricks: CompletedTrick[]
    declare handsShown?: boolean

    constructor(data: KoenigrufenProjectedState) {
        super(data, KoenigrufenProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedKoenigrufenPlayerState(player))
        this.roundManager = new HydratedRoundManager(data.roundManager)
    }

    player(playerId: string): HydratedKoenigrufenPlayerState {
        return this.getPlayerState(playerId)
    }

    // The player on dealer's right; play goes in turn order.
    forehandId(): string {
        return this.turnManager.nextPlayer(this.dealerId)
    }

    // Everyone in turn order from Forehand, which is also bidding priority.
    seats(): string[] {
        const order = this.turnManager.turnOrder
        const start = order.indexOf(this.forehandId())
        return [...order.slice(start), ...order.slice(0, start)]
    }

    beginTurn(playerId: string) {
        this.turnManager.startTurn(playerId, this.actionCount)
        this.activePlayerIds = [playerId]
    }

    finishTurn() {
        this.turnManager.endTurn(this.actionCount)
        this.activePlayerIds = []
    }

    // Packets of six from Forehand round the table, one to the talon, then six more each.
    dealHand(random: RandomFunction) {
        const deck = Deck.map((card) => card.id)
        shuffle(deck, random)
        const seats = this.seats()
        for (const player of this.players) {
            player.clearCards()
        }
        const packets = Array.from({ length: deck.length / PacketSize }, (_, index) =>
            deck.slice(index * PacketSize, (index + 1) * PacketSize)
        )
        const talonPacket = seats.length
        packets.forEach((packet, index) => {
            if (index === talonPacket) {
                this.talon = packet
                return
            }
            const seat = index < talonPacket ? index : index - talonPacket - 1
            this.player(seats[seat]).takeIntoHand(packet)
        })
        this.talonHalves = undefined
        this.rejectedTalonHalf = undefined
        this.auction = newAuction()
        this.contract = undefined
        this.calledKingPlayedBy = undefined
        this.announcements = undefined
        this.trick = undefined
        this.tricks = []
        this.handsShown = undefined
        this.roundManager.startRound(this.actionCount)
    }

    nextDealer() {
        this.dealerId = this.forehandId()
    }

    dealNumber(): number {
        return this.roundManager.series.length
    }

    isLastDeal(): boolean {
        return this.roundManager.series.length >= this.totalDeals
    }

    // Auction

    nextBidder(): string {
        if (isAuctionUnopened(this.auction)) {
            return this.forehandId()
        }
        const last = this.turnManager.lastPlayer()
        assertExists(last, 'Someone has spoken in the auction')
        return this.turnManager.nextPlayer(
            last,
            (playerId) => !this.auction.passed.includes(playerId)
        )
    }

    // Forehand opens with "Mein Spiel", Sechserdreier or a bid, and may not pass.
    isOpeningCall(playerId: string): boolean {
        return playerId === this.forehandId() && isAuctionUnopened(this.auction)
    }

    canSayMeinSpiel(playerId: string): boolean {
        return this.isOpeningCall(playerId)
    }

    canPass(playerId: string): boolean {
        return !this.isOpeningCall(playerId)
    }

    biddableChoices(playerId: string): BidChoice[] {
        return biddableChoices(this.auction, this.seats(), playerId).filter((choice) =>
            this.mayDeclare(playerId, choice.contract)
        )
    }

    // A player holding all four Kings has none to call, so may not declare a king-calling contract.
    private mayDeclare(playerId: string, contract: Contract): boolean {
        return (
            contractDefinition(contract).partnership !== Partnership.CallKing ||
            callableKings(this.player(playerId).knownHand()).length > 0
        )
    }

    sayMeinSpiel(playerId: string) {
        assert(this.canSayMeinSpiel(playerId), `${playerId} cannot say Mein Spiel`)
        this.auction.meinSpiel = true
    }

    bid(playerId: string, choice: BidChoice) {
        assert(
            this.biddableChoices(playerId).some((candidate) => sameBid(candidate, choice)),
            `${playerId} cannot bid ${choice.contract} ${choice.bird ?? ''}`
        )
        this.auction.bid = { playerId, ...bidChoice(choice.contract, choice.bird) }
    }

    pass(playerId: string) {
        assert(this.canPass(playerId), `${playerId} cannot pass`)
        this.auction.passed.push(playerId)
    }

    isAuctionOver(): boolean {
        return isAuctionOver(this.auction, this.seats())
    }

    // The auction's winner holds the bid, or is Forehand after "Mein Spiel" was passed out.
    closeAuction(): DeclaredContract | undefined {
        const [winner] = remainingBidders(this.auction, this.seats())
        assertExists(winner, 'The auction has a winner')
        const held = this.auction.bid
        if (held === undefined) {
            assert(winner === this.forehandId(), 'Only Forehand can win without a bid')
            return undefined
        }
        assert(held.playerId === winner, 'The last bidder holds the bid')
        return this.declare(held, winner)
    }

    nameableChoices(): BidChoice[] {
        const forehand = this.forehandId()
        return nameableChoices().filter((choice) => this.mayDeclare(forehand, choice.contract))
    }

    nameContract(playerId: string, choice: BidChoice): DeclaredContract {
        assert(playerId === this.forehandId(), 'Only Forehand names the contract')
        assert(
            this.nameableChoices().some((candidate) => sameBid(candidate, choice)),
            `${choice.contract} ${choice.bird ?? ''} cannot be named`
        )
        return this.declare(choice, playerId)
    }

    private declare(choice: BidChoice, declarerId: string): DeclaredContract {
        this.contract = { ...bidChoice(choice.contract, choice.bird), declarerId }
        return this.contract
    }

    declared(): DeclaredContract {
        assertExists(this.contract, 'No contract has been declared')
        return this.contract
    }

    contractDefinition(): ContractDefinition {
        return contractDefinition(this.declared().contract)
    }

    declarerId(): string {
        return this.declared().declarerId
    }

    // King calling

    callableKings(playerId: string): CalledKing[] {
        if (playerId !== this.declarerId()) {
            return []
        }
        return callableKings(this.player(playerId).knownHand())
    }

    callKing(playerId: string, king: CalledKing) {
        assert(this.callableKings(playerId).includes(king), `${playerId} cannot call ${king}`)
        this.declared().calledKing = king
    }

    private isCalledKing(cardId: string, declarersCard: boolean): boolean {
        const called = this.contract?.calledKing
        return called !== undefined && isCalledKing(called, cardId, declarersCard)
    }

    // Talon

    revealTalon(): string[][] {
        const halves = talonHalves(this.knownTalon())
        this.talonHalves = halves
        this.talon = []
        return halves
    }

    private knownTalon(): string[] {
        assertExists(this.talon, 'The talon is hidden')
        return this.talon
    }

    // Wikipedia: with the called King in the exposed talon, declarer either gives up, paying the game
    // to each opponent, or takes a half and plays alone against three. Kontra is not allowed then.
    isCalledKingInTalon(): boolean {
        return (this.talonHalves ?? []).some((half) =>
            half.some((cardId) => this.isCalledKing(cardId, false))
        )
    }

    canGiveUp(playerId: string): boolean {
        return playerId === this.declarerId() && this.isCalledKingInTalon()
    }

    giveUp(playerId: string) {
        assert(this.canGiveUp(playerId), `${playerId} cannot give up`)
        this.declared().givenUp = true
    }

    // The exposed half made of exactly these cards, in any order.
    private talonHalfOf(cardIds: readonly string[]): string[] | undefined {
        return this.talonHalves?.find(
            (half) =>
                half.length === cardIds.length &&
                new Set(cardIds).size === cardIds.length &&
                cardIds.every((cardId) => half.includes(cardId))
        )
    }

    canChooseTalonHalf(playerId: string, cardIds: readonly string[]): boolean {
        return (
            playerId === this.declarerId() &&
            this.rejectedTalonHalf === undefined &&
            this.talonHalfOf(cardIds) !== undefined
        )
    }

    chooseTalonHalf(playerId: string, cardIds: readonly string[]) {
        assert(
            this.canChooseTalonHalf(playerId, cardIds),
            `${playerId} cannot take talon half ${cardIds.join(', ')}`
        )
        const taken = this.talonHalfOf(cardIds)
        assertExists(taken, `No talon half ${cardIds.join(', ')}`)
        this.rejectedTalonHalf = (this.talonHalves ?? []).filter((half) => half !== taken).flat()
        this.player(playerId).takeIntoHand(taken)
    }

    pickUpTalon() {
        this.player(this.declarerId()).takeIntoHand(this.knownTalon())
        this.talon = []
    }

    canLayAway(playerId: string, cardIds: readonly string[]): boolean {
        return (
            playerId === this.declarerId() &&
            canLayAway(
                this.player(playerId).knownHand(),
                cardIds,
                this.contractDefinition().talonCards,
                this.contractDefinition().layAway
            )
        )
    }

    layAway(playerId: string, cardIds: readonly string[]): string[] {
        assert(
            this.canLayAway(playerId, cardIds),
            `${playerId} cannot lay away ${cardIds.join(', ')}`
        )
        const shown = shownDiscards(cardIds, this.contractDefinition().layAway)
        this.player(playerId).layAway(cardIds, shown)
        return shown
    }

    // Announcements

    // A Besserrufer's bird, named with the bid, is already announced for declarer's side.
    startAnnouncements() {
        const { bird } = this.declared()
        this.announcements = newAnnouncements()
        if (bird !== undefined) {
            this.announcements.bonuses.push({
                bonus: bird,
                side: Side.Declarer,
                doubles: 0
            })
        }
    }

    knownAnnouncements(): Announcements {
        assertExists(this.announcements, 'No announcements are under way')
        return this.announcements
    }

    nextAnnouncer(): string {
        const last = this.turnManager.lastPlayer()
        return this.knownAnnouncements().turns === 0 || last === undefined
            ? this.declarerId()
            : this.turnManager.nextPlayer(last)
    }

    // A player's side, from their own hand: the called King's holder is declarer's partner.
    sideOf(playerId: string): Side {
        if (playerId === this.declarerId()) {
            return Side.Declarer
        }
        if (this.contractDefinition().partnership !== Partnership.CallKing) {
            return Side.Defenders
        }
        if (this.calledKingPlayedBy === playerId) {
            return Side.Declarer
        }
        const holdsCalledKing = this.player(playerId)
            .knownHand()
            .some((cardId) => this.isCalledKing(cardId, false))
        return holdsCalledKing ? Side.Declarer : Side.Defenders
    }

    private announcingContext(playerId: string): AnnouncingContext {
        const declarerId = this.declarerId()
        return {
            definition: this.contractDefinition(),
            playerId,
            side: this.sideOf(playerId),
            declarerId,
            defenderIds: this.seats().filter((seat) => seat !== declarerId),
            kontraAllowed: !this.isCalledKingInTalon(),
            calledKingInPlay: !this.isCalledKingInTalon()
        }
    }

    announceableBonuses(playerId: string): Bonus[] {
        return announceableBonuses(this.knownAnnouncements(), this.announcingContext(playerId))
    }

    doubleTargets(playerId: string): DoubleTarget[] {
        return doubleTargets(this.knownAnnouncements(), this.announcingContext(playerId))
    }

    announce(
        playerId: string,
        bonuses: readonly Bonus[],
        doubles: readonly DoubleTarget[]
    ): { side: Side; doubleLevels: number[] } {
        assert(this.activePlayerIds.includes(playerId), `It is not ${playerId}'s turn to announce`)
        const announcements = this.knownAnnouncements()
        const context = this.announcingContext(playerId)
        const problem = validateAnnouncement(announcements, context, bonuses, doubles)
        assert(problem === undefined, `${playerId} ${problem}`)
        applyAnnouncement(announcements, context, bonuses, doubles)
        return {
            side: context.side,
            doubleLevels: doubles.map((target) => doublesOn(announcements, target))
        }
    }

    isAnnouncingOver(): boolean {
        return isAnnouncingOver(this.knownAnnouncements(), this.players.length)
    }

    // Play

    startPlay() {
        const definition = this.contractDefinition()
        this.trick = {
            leaderId: definition.declarerLeads ? this.declarerId() : this.forehandId(),
            plays: []
        }
    }

    currentTrick(): Trick {
        assertExists(this.trick, 'No trick is in play')
        return this.trick
    }

    nextToPlay(): string {
        const trick = this.currentTrick()
        const last = trick.plays.at(-1)
        return last === undefined ? trick.leaderId : this.turnManager.nextPlayer(last.playerId)
    }

    legalPlays(playerId: string): string[] {
        if (playerId !== this.nextToPlay()) {
            return []
        }
        const options = legalPlays(
            this.player(playerId).knownHand(),
            this.currentTrick().plays,
            playRules(this.contractDefinition())
        )
        const reserved = this.reservedBirds(playerId)
        const free = options.filter((cardId) => !reserved.includes(cardId))
        return free.length > 0 ? free : options
    }

    // Wikipedia: an announced bird is kept for its trick unless nothing else may be played.
    private reservedBirds(playerId: string): string[] {
        const announced = this.announcements?.bonuses ?? []
        if (announced.length === 0) {
            return []
        }
        const side = this.sideOf(playerId)
        return announced.flatMap((entry) => {
            const bird = Birds[entry.bonus]
            return bird !== undefined && entry.side === side && this.tricks.length < bird.trick
                ? [bird.cardId]
                : []
        })
    }

    // Returns the trick's winner once its fourth card is played.
    playCard(playerId: string, cardId: string): string | undefined {
        assert(this.legalPlays(playerId).includes(cardId), `${playerId} cannot play ${cardId}`)
        this.player(playerId).removeFromHand(cardId)
        const trick = this.currentTrick()
        trick.plays.push({ playerId, cardId })
        // Pagat: ouvert hands are laid open once a card has been led to the second trick.
        if (this.contractDefinition().ouvert && this.tricks.length === 1) {
            this.handsShown = true
        }
        if (this.isCalledKing(cardId, playerId === this.declarerId())) {
            this.calledKingPlayedBy = playerId
        }
        if (trick.plays.length < this.players.length) {
            return undefined
        }
        const winnerId = trickWinner(trick.plays, this.contractDefinition().trumpsWin)
        this.tricks.push({ plays: trick.plays, winnerId })
        this.trick = this.isHandOver() ? undefined : { leaderId: winnerId, plays: [] }
        return winnerId
    }

    // Play stops once a negative game's declarer has taken more tricks than the contract allows.
    isHandOver(): boolean {
        const allowed = this.contractDefinition().tricksToTake
        return (
            this.tricks.length === TricksPerHand ||
            (allowed !== undefined && this.declarerTricks() > allowed)
        )
    }

    declarerTricks(): number {
        const declarerId = this.declarerId()
        return this.tricks.filter((trick) => trick.winnerId === declarerId).length
    }

    // Hand end

    partnerId(): string | undefined {
        const definition = this.contractDefinition()
        if (definition.partnership !== Partnership.CallKing) {
            return undefined
        }
        const holder = this.calledKingPlayedBy
        return holder !== undefined && holder !== this.declarerId() ? holder : undefined
    }

    endHand(): HandResult {
        if (this.declared().givenUp) {
            return this.endGivenUpHand()
        }
        const definition = this.contractDefinition()
        if (definition.partnership === Partnership.Individual) {
            return this.endTrischakenHand()
        }
        if (definition.tricksToTake !== undefined) {
            return this.endTrickGameHand()
        }
        const declarerId = this.declarerId()
        const partnerId = this.partnerId()
        const declarerSide = partnerId === undefined ? [declarerId] : [declarerId, partnerId]
        const defenders = this.seats().filter((playerId) => !declarerSide.includes(playerId))
        const talon = this.knownTalon()
        const discards = this.player(declarerId).knownDiscards()
        const won = this.tricks
            .filter((trick) => declarerSide.includes(trick.winnerId))
            .flatMap((trick) => trick.plays.map((play) => play.cardId))
        const talonHalfToDeclarer = untouchedTalonHalfForDeclarer(talon, (cardId) =>
            this.isCalledKing(cardId, false)
        )
        const declarerCards = [...won, ...discards, ...talonHalfToDeclarer]
        const announcements = this.announcements ?? newAnnouncements()
        const bonuses = scoreBonuses({
            definition,
            announcements,
            tricks: this.tricks,
            sideOf: (playerId) =>
                declarerSide.includes(playerId) ? Side.Declarer : Side.Defenders,
            cards: {
                [Side.Declarer]: declarerCards,
                [Side.Defenders]: Deck.map((card) => card.id).filter(
                    (cardId) => !declarerCards.includes(cardId)
                )
            },
            isCalledKing: (cardId, playerId) => this.isCalledKing(cardId, playerId === declarerId)
        })
        const multiplier = 2 ** gameDoubles(announcements)
        const result = scorePointGame(definition, declarerSide, defenders, declarerCards, {
            multiplier: () => multiplier,
            bonusPoints: bonuses.results.reduce(
                (sum, bonus) => sum + (bonus.side === Side.Declarer ? bonus.points : -bonus.points),
                0
            ),
            replaceGame: bonuses.valat
        })
        this.applyScoreChanges(result.scoreChanges)
        return {
            contract: definition.contract,
            declarerId,
            partnerId,
            declarerPoints: result.declarerPoints,
            made: result.made,
            ...this.announcementsResult(),
            bonuses: bonuses.results,
            ...(bonuses.valat ? { valat: true } : {}),
            scoreChanges: result.scoreChanges,
            talon: [...talon, ...(this.talonHalves?.flat() ?? [])],
            discards: [...discards]
        }
    }

    private endTrickGameHand(): HandResult {
        const definition = this.contractDefinition()
        const declarerId = this.declarerId()
        const defenders = this.seats().filter((playerId) => playerId !== declarerId)
        const won = this.tricks
            .filter((trick) => trick.winnerId === declarerId)
            .flatMap((trick) => trick.plays.map((play) => play.cardId))
        const declarerTricks = this.declarerTricks()
        const announcements = this.announcements ?? newAnnouncements()
        const result = scoreTrickGame(definition, declarerId, defenders, declarerTricks, {
            multiplier: (defenderId) => 2 ** gameDoubles(announcements, defenderId)
        })
        this.applyScoreChanges(result.scoreChanges)
        return {
            contract: definition.contract,
            declarerId,
            declarerPoints: cardPoints(won),
            declarerTricks,
            made: result.made,
            ...this.announcementsResult(),
            scoreChanges: result.scoreChanges,
            talon: [...this.knownTalon()],
            discards: []
        }
    }

    // The winner of the last trick takes the whole talon.
    private endTrischakenHand(): HandResult {
        const definition = this.contractDefinition()
        const declarerId = this.declarerId()
        const talon = this.knownTalon()
        const lastWinner = this.tricks.at(-1)?.winnerId
        const piles = this.seats().map((playerId) => {
            const won = this.tricks.filter((trick) => trick.winnerId === playerId)
            return {
                playerId,
                tricks: won.length,
                cardIds: [
                    ...won.flatMap((trick) => trick.plays.map((play) => play.cardId)),
                    ...(playerId === lastWinner ? talon : [])
                ]
            }
        })
        const result = scoreTrischaken(definition, piles)
        this.applyScoreChanges(result.scoreChanges)
        return {
            contract: definition.contract,
            declarerId,
            declarerPoints: result.points[declarerId],
            playerPoints: result.points,
            playerTricks: Object.fromEntries(piles.map((pile) => [pile.playerId, pile.tricks])),
            made: result.scoreChanges[declarerId] >= 0,
            scoreChanges: result.scoreChanges,
            talon: [...talon],
            discards: []
        }
    }

    private announcementsResult(): Pick<HandResult, 'gameDoubles'> {
        const doubles = this.announcements?.game ?? []
        return doubles.length > 0 ? { gameDoubles: doubles.map((entry) => ({ ...entry })) } : {}
    }

    private endGivenUpHand(): HandResult {
        const definition = this.contractDefinition()
        const declarerId = this.declarerId()
        const defenders = this.seats().filter((playerId) => playerId !== declarerId)
        const bonuses = this.givenUpBird()
        const lost = bonuses.reduce((sum, bonus) => sum - bonus.points, 0)
        const scoreChanges = scoreGivenUp(definition.loss + lost, declarerId, defenders)
        this.applyScoreChanges(scoreChanges)
        return {
            contract: definition.contract,
            declarerId,
            declarerPoints: 0,
            made: false,
            givenUp: true,
            ...(bonuses.length > 0 ? { bonuses } : {}),
            scoreChanges,
            talon: this.talonHalves?.flat() ?? [],
            discards: []
        }
    }

    // House rule (the Spieleversum convention): a Besserrufer given up also pays the bird
    // named with the bid, in full, as announced and lost. Only that bird: the talon is settled
    // before any other announcement, so nothing else was said and no Kontra was possible.
    private givenUpBird(): BonusResult[] {
        const bird = this.declared().bird
        if (bird === undefined) {
            return []
        }
        return [
            {
                bonus: bird,
                side: Side.Declarer,
                announced: true,
                doubles: 0,
                made: false,
                points: -Bonuses[bird].announced
            }
        ]
    }

    private applyScoreChanges(scoreChanges: Record<string, number>) {
        for (const [playerId, change] of Object.entries(scoreChanges)) {
            this.player(playerId).score += change
        }
        this.roundManager.endRound(this.actionCount)
    }

    // End of game

    leadingPlayerIds(): string[] {
        const best = Math.max(...this.players.map((player) => player.score))
        return this.players
            .filter((player) => player.score === best)
            .map((player) => player.playerId)
    }
}
