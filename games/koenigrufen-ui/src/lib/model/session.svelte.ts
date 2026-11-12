import {
    GameSession,
    undoableStagedSelection,
    type AnimationContext,
    type TitlePreferences
} from '@tabletop/frontend-components'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    ActionType,
    Announce,
    Bid,
    CallKing,
    card,
    ChooseContract,
    ChooseTalonHalf,
    GiveUp,
    isEndHand,
    KoenigrufenPreferenceDefinition,
    LayAway,
    layAwayCandidates,
    MachineState,
    Pass,
    PlayCard,
    SayMeinSpiel,
    Suits,
    type BidChoice,
    type Bonus,
    type CalledKing,
    type DoubleTarget,
    type HandResult,
    type HydratedKoenigrufenGameState,
    type KoenigrufenPreferences,
    type KoenigrufenProjectedState
} from '@tabletop/koenigrufen'
import { CardPlaces } from '$lib/animators/cardPlaces.js'
import { DealAnimator } from '$lib/animators/dealAnimator.js'
import { CardFlights, type FlyingCard } from '$lib/animators/flights.js'
import { TalonAnimator } from '$lib/animators/talonAnimator.js'
import { talonViewOf, type TalonView } from '$lib/utils/talonView.js'
import { TrickAnimator } from '$lib/animators/trickAnimator.js'
import { shownTrickOf, type ShownTrick } from '$lib/utils/trickMotion.js'
import type { CardStyle } from '$lib/utils/cardStyle.js'
import { scoreSheet, type ScoreSheet } from '$lib/utils/scoreSheet.js'
import { bonusKey, doubleKey } from '$lib/utils/announcementText.js'
import {
    AnnouncementStageOrder,
    chosenAnnouncements,
    chosenToLayAway,
    LayAwayStageOrder,
    pickedToPlay,
    pickToPlay,
    PlayStageOrder,
    toggleAnnouncement,
    toggleLayAway,
    type AnnouncementSelection,
    type AnnouncementSelectionValues,
    type LayAwaySelectionValues,
    type PlaySelectionValues,
    type LayAwaySelection,
    type PlaySelection
} from './stagedSelection.js'

// Suits alternate colour; trumps follow, low to high.
const SuitSortOrder = [Suits[0], Suits[2], Suits[1], Suits[3]]

function handSortKey(cardId: string): number {
    const found = card(cardId)
    return found.kind === 'trump'
        ? 100 + found.number
        : SuitSortOrder.indexOf(found.suit) * 10 + (10 - found.strength)
}

type SessionOptions = ConstructorParameters<
    typeof GameSession<KoenigrufenProjectedState, HydratedKoenigrufenGameState>
>[0]

export class KoenigrufenGameSession extends GameSession<
    KoenigrufenProjectedState,
    HydratedKoenigrufenGameState
> {
    readonly preferences: TitlePreferences<typeof KoenigrufenPreferences> = this.createPreferences(
        KoenigrufenPreferenceDefinition
    )

    readonly cardStyle: CardStyle = $derived({
        uniformPips: this.preferences.values.uniformPips,
        classicDeck: this.preferences.values.classicDeck
    })

    private readonly canAct = $derived(this.isPlayable && !this.isViewingHistory && this.isMyTurn)

    private layAwaySelection: LayAwaySelection = $state({})
    private playSelection: PlaySelection = $state({})
    private announcementSelection: AnnouncementSelection = $state({})

    // Undo takes back a picked card, then the latest announcement choice, then the latest card
    // chosen to lay away, before it undoes an action. Every new state clears them.
    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection<PlaySelectionValues>(
                PlayStageOrder,
                () => this.playSelection,
                (selection) => (this.playSelection = selection)
            )
        )
        this.localSelections.register(
            undoableStagedSelection<AnnouncementSelectionValues>(
                AnnouncementStageOrder,
                () => this.announcementSelection,
                (selection) => (this.announcementSelection = selection)
            )
        )
        this.localSelections.register(
            undoableStagedSelection<LayAwaySelectionValues>(
                LayAwayStageOrder,
                () => this.layAwaySelection,
                (selection) => (this.layAwaySelection = selection)
            )
        )
    }

    readonly machineState = $derived(this.gameState.machineState)

    readonly myHand: string[] = $derived(
        (this.myPlayerState?.hand ?? []).toSorted((a, b) => handSortKey(a) - handSortKey(b))
    )

    // Another player's hand, sorted like mine, once an ouvert game has laid the hands open.
    openHand(playerId: string): string[] | undefined {
        const hand = this.gameState.handsShown
            ? this.gameState.getPlayerState(playerId).hand
            : undefined
        return hand?.toSorted((a, b) => handSortKey(a) - handSortKey(b))
    }

    // Seats from mine round the table in turn order, so the next to play sits on my right.
    readonly seatsFromMe: string[] = $derived.by(() => {
        const order = this.gameState.turnManager.turnOrder
        const start = Math.max(order.indexOf(this.myPlayer?.id ?? ''), 0)
        return [...order.slice(start), ...order.slice(0, start)]
    })

    // ----- Auction -----

    readonly canSayMeinSpiel = $derived(this.canTake(ActionType.SayMeinSpiel))
    readonly canPass = $derived(this.canTake(ActionType.Pass))
    readonly biddableChoices: BidChoice[] = $derived(
        this.canTake(ActionType.Bid) ? this.gameState.biddableChoices(this.myPlayerId()) : []
    )
    readonly nameableChoices: BidChoice[] = $derived(
        this.canTake(ActionType.ChooseContract) ? this.gameState.nameableChoices() : []
    )

    // ----- King and talon -----

    readonly callableKings: CalledKing[] = $derived(
        this.canTake(ActionType.CallKing) ? this.gameState.callableKings(this.myPlayerId()) : []
    )
    readonly canChooseTalonHalf = $derived(this.canTake(ActionType.ChooseTalonHalf))
    readonly canGiveUp = $derived(this.canTake(ActionType.GiveUp))
    // The game's value, which declarer pays each opponent on giving up or wins from each alone.
    readonly isLayingAway = $derived(this.canTake(ActionType.LayAway))
    readonly layAwayCount: number = $derived(
        this.isLayingAway ? this.gameState.contractDefinition().talonCards : 0
    )
    readonly chosenToLayAway: string[] = $derived(
        this.isLayingAway ? chosenToLayAway(this.layAwaySelection) : []
    )
    readonly layAwayChoices: string[] = $derived(
        this.isLayingAway
            ? layAwayCandidates(
                  this.myHand,
                  this.chosenToLayAway,
                  this.layAwayCount,
                  this.gameState.contractDefinition().layAway
              )
            : []
    )
    readonly canConfirmLayAway = $derived(
        this.isLayingAway && this.chosenToLayAway.length === this.layAwayCount
    )

    // ----- Announcements -----

    readonly isAnnouncing = $derived(this.canTake(ActionType.Announce))
    readonly announceableBonuses: Bonus[] = $derived(
        this.isAnnouncing ? this.gameState.announceableBonuses(this.myPlayerId()) : []
    )
    readonly doubleTargets: DoubleTarget[] = $derived(
        this.isAnnouncing ? this.gameState.doubleTargets(this.myPlayerId()) : []
    )
    readonly chosenAnnouncementKeys: string[] = $derived(
        chosenAnnouncements(this.announcementSelection)
    )
    readonly chosenBonuses: Bonus[] = $derived(
        this.announceableBonuses.filter((bonus) =>
            this.chosenAnnouncementKeys.includes(bonusKey(bonus))
        )
    )
    readonly chosenDoubles: DoubleTarget[] = $derived(
        this.doubleTargets.filter((target) =>
            this.chosenAnnouncementKeys.includes(doubleKey(target))
        )
    )
    readonly canConfirmAnnouncement: boolean = $derived(this.isAnnouncing)

    // ----- Play -----

    readonly playableCards: string[] = $derived(
        this.canTake(ActionType.PlayCard) ? this.gameState.legalPlays(this.myPlayerId()) : []
    )

    readonly pickedCard: string | undefined = $derived.by(() => {
        const picked = pickedToPlay(this.playSelection)
        return picked !== undefined && this.playableCards.includes(picked) ? picked : undefined
    })

    // The trick on the table. Each animated transition sets it to the trick it shows (a won trick
    // while it is shown and taken), so arriving cards are drawn before the state swap.
    shownTrick: ShownTrick = $derived(shownTrickOf(this.gameState))

    readonly cardPlaces = new CardPlaces()

    readonly trickAnimator = new TrickAnimator(this.cardPlaces, {
        present: (trick) => {
            this.shownTrick = trick
        }
    })

    // Cards crossing the table (a deal, the talon going to the declarer, cards laid away), drawn
    // only while they fly.
    flyingCards: FlyingCard[] = $state([])

    readonly cardFlights = new CardFlights(this.cardPlaces, {
        show: (cards) => {
            this.flyingCards = [...this.flyingCards, ...cards]
        },
        clear: () => {
            this.flyingCards = []
        },
        isViewer: (playerId) => this.myPlayer?.id === playerId
    })

    // The talon as the table shows it. The talon animator sets it to the talon a transition ends on,
    // so the halves are drawn before the state swap to turn over in place.
    talonView: TalonView = $derived(talonViewOf(this.gameState))

    readonly talonAnimator = new TalonAnimator(this.cardPlaces, this.cardFlights, {
        presentTalon: (view) => {
            this.talonView = view
        }
    })

    readonly dealAnimator = new DealAnimator(this.cardPlaces, this.cardFlights)

    readonly lastHandResult: HandResult | undefined = $derived(
        this.actions.findLast(isEndHand)?.metadata
    )

    readonly scoreSheet: ScoreSheet = $derived(
        scoreSheet(this.actions, this.gameState.turnManager.turnOrder)
    )

    // The table is clear between hands while the next auction runs, and once the game is over.
    readonly showsHandSummary = $derived(
        this.lastHandResult !== undefined &&
            (this.machineState === MachineState.Bidding || this.gameState.result !== undefined)
    )

    readonly canUndo = $derived(
        this.isPlayable &&
            !this.isViewingHistory &&
            (this.hasLocalSelection || Boolean(this.undoableAction))
    )

    canTake(type: ActionType): boolean {
        return this.canAct && this.validActionTypes.includes(type)
    }

    myPlayerId(): string {
        assertExists(this.myPlayer, 'Only a seated player acts')
        return this.myPlayer.id
    }

    tricksWonBy(playerId: string): number {
        return this.gameState.tricks.filter((trick) => trick.winnerId === playerId).length
    }

    setCardStyle(change: Partial<CardStyle>) {
        this.preferences.set(change)
    }

    override async onGameStateChange(change: {
        to: HydratedKoenigrufenGameState
        from?: HydratedKoenigrufenGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        await Promise.all([
            this.trickAnimator.onGameStateChange(change),
            this.talonAnimator.onGameStateChange(change),
            this.dealAnimator.onGameStateChange(change)
        ])
    }

    async sayMeinSpiel() {
        await this.applyAction(this.createPlayerAction(SayMeinSpiel, {}))
    }

    async bid(choice: BidChoice) {
        await this.applyAction(this.createPlayerAction(Bid, { ...choice }))
    }

    async pass() {
        await this.applyAction(this.createPlayerAction(Pass, {}))
    }

    async chooseContract(choice: BidChoice) {
        await this.applyAction(this.createPlayerAction(ChooseContract, { ...choice }))
    }

    async callKing(king: CalledKing) {
        await this.applyAction(this.createPlayerAction(CallKing, { king }))
    }

    async chooseTalonHalf(cardIds: readonly string[]) {
        await this.applyAction(this.createPlayerAction(ChooseTalonHalf, { cardIds: [...cardIds] }))
    }

    async giveUp() {
        await this.applyAction(this.createPlayerAction(GiveUp, {}))
    }

    toggleLayAway(cardId: string) {
        if (this.chosenToLayAway.includes(cardId) || this.layAwayChoices.includes(cardId)) {
            this.layAwaySelection = toggleLayAway(this.layAwaySelection, cardId)
        }
    }

    async confirmLayAway() {
        await this.applyAction(
            this.createPlayerAction(LayAway, { cardIds: [...this.chosenToLayAway] })
        )
    }

    toggleAnnouncement(key: string) {
        this.announcementSelection = toggleAnnouncement(this.announcementSelection, key)
    }

    // Saying nothing passes.
    async confirmAnnouncement() {
        await this.applyAction(
            this.createPlayerAction(Announce, {
                bonuses: [...this.chosenBonuses],
                doubles: this.chosenDoubles.map((target) => ({ ...target }))
            })
        )
    }

    // The first click picks a card; a second click on the same card plays it.
    async pickOrPlay(cardId: string) {
        if (!this.playableCards.includes(cardId)) {
            return
        }
        if (this.pickedCard === cardId) {
            await this.playCard(cardId)
            return
        }
        this.playSelection = pickToPlay(cardId)
    }

    async playCard(cardId: string) {
        await this.applyAction(this.createPlayerAction(PlayCard, { cardId }))
    }
}
