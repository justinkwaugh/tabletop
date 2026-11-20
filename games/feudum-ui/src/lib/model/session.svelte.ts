import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
import { FlightAnimator } from '$lib/animators/flightAnimator.svelte.js'
import { PouchAnimator } from '$lib/animators/pouchAnimator.svelte.js'
import { HistoryLog } from '$lib/model/historyLog.svelte.js'
import { isDecisionPress, turnSeatAt } from '$lib/utils/decisionPress.js'
import { GameStorage, type Color, type GameAction } from '@tabletop/common'
import { GameSession, type PresentedTransition } from '@tabletop/frontend-components'
import {
    type ActionCardKind,
    ActionCards,
    ActionType,
    AnswerAttack,
    atWillOffers,
    type Character,
    ChooseFavours,
    ChooseStartingGoods,
    discardWritOffers,
    dummyRowColour,
    type FeudumProjectedState,
    FinaliseHand,
    type Good,
    Goods,
    type GuildRank,
    handSelectionGroup,
    type HydratedFeudumGameState,
    MachineState,
    PlaceStartingPawn,
    type PouchGood,
    previewFinaliseHand,
    reasonPouchRefused,
    reasonStartingGoodRefused,
    reasonStartingGoodsRefused,
    reasonStartingPawnRefused,
    setupSeat,
    type SpaceId,
    startingGoodOffers,
    StartingGoodsChosen,
    startingPawnOffers,
    StartingSpaceIds
} from '@tabletop/feudum'
import { describeAction } from './actionDescription.js'
import { answerAttackPanelOf, type AnswerAttackPanel } from './answerAttack.js'
import { AnswerStarveDraft, type AnswerStarvePanel } from './answerStarveDraft.svelte.js'
import { AtWillDraft, type AtWillContext, type AtWillPanel } from './atWillDraft.svelte.js'
import type { BoardChrome } from './boardChrome.js'
import { pickFrameOf, type PickFrame } from './boardFocus.svelte.js'
import { deriveBoardOffer, spaceTarget, type BoardOffer, type BoardTarget } from './boardOffer.js'
import { CommitAttackDraft, type CommitPanel } from './commitAttackDraft.svelte.js'
import { CantBeUndone, primaryLabel, sendsOnPress } from './confirmingSend.js'
import { DiscDraft, type DiscPanel } from './discDraft.svelte.js'
import { rankedDie } from './guildDie.js'
import { FavoursDraft, type FavoursPanel } from './favoursDraft.svelte.js'
import { HandDraft, handDraftKey } from './handDraft.svelte.js'
import { GuildDraft, type GuildContext, type GuildPanel } from './guildDraft.svelte.js'
import { KeepWritsDraft, type KeepWritsPanel } from './keepWritsDraft.svelte.js'
import { LandscapesDraft, type LandscapesPanel } from './landscapesDraft.svelte.js'
import { MoveDraft, type MoveContext, type MovePanel } from './moveDraft.svelte.js'
import { NourishDraft, type NourishPanel } from './nourishDraft.svelte.js'
import { PouchTitles } from './pouchWords.js'
import { StartingGoodsDraft, type SulfurDestination } from './startingGoodsDraft.svelte.js'
import { StartingPawnDraft } from './startingPawnDraft.svelte.js'
import type { FlowPlay, FlowPopup, PanelChoice } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import { TableLayers } from './tableLayers.svelte.js'
import { TurnDraft, type TurnPanel } from './turnDraft.svelte.js'
import { actionPanelOf, type ActionPanelView } from './actionPanel.js'
import { dummyPaint, seatPaint, type SeatPaint } from './seatPaint.js'
import { seatPanelOf, seatPouchOf, type SeatPanelView } from './seatPanel.js'
import { gameEndOf, type GameEndSummaryView } from './gameEnd.js'
import { roundEndOf, type RoundEndView } from './roundEnd.js'
import { combatTallyOf, orderRowOf, type CombatTallyRow, type OrderRow } from './sharedRows.js'
import { deckNoteOf, watchingPanelOf, type WatchingPanel } from './watching.js'
import { WritLimitDraft, type WritLimitPanel } from './writLimitDraft.svelte.js'
import {
    OffTurnDiscardDraft,
    type OffTurnDiscardContext,
    type OffTurnDiscardPanel
} from './offTurnDiscardDraft.svelte.js'

export interface PrimaryButton {
    readonly label: string
    readonly enabled: boolean
    readonly note?: string
}

export interface StartingGoodsPanel {
    readonly deciderId: string
    readonly deciding: boolean
    readonly goods: readonly {
        readonly good: Good
        readonly count: number
        readonly picked: boolean
        readonly refusal?: string
        readonly spent?: true
    }[]
    readonly sulfurTo?: SulfurDestination
    readonly primary?: PrimaryButton
}

export interface StartingPawnPanel {
    readonly deciderId: string
    readonly deciding: boolean
    readonly characters: readonly {
        readonly character: Character
        /** R-4.5 The rank this character would give now. */
        readonly rank?: GuildRank
        readonly picked: boolean
    }[]
    readonly pickedSpace?: SpaceId
    readonly asksCharacter: boolean
}

export interface FinaliseRowEntry {
    readonly playerId: string
    readonly finalised: boolean
}

/** R-3.1-H1 No other seat sees the pouch good yet. */
export interface HandSet {
    readonly cards: readonly ActionCardKind[]
    readonly pouch?: { readonly good: PouchGood; readonly title: string }
    readonly line: string
}

export interface HandDrafting {
    readonly cards: readonly {
        readonly kind: ActionCardKind
        readonly picked: boolean
        readonly slot?: number
    }[]
    /** R-3.1 The order is the seat's own; the cards may be played in any order. */
    readonly slots: readonly (ActionCardKind | undefined)[]
    /** R-3.3 None is chosen until a press; a second press clears it. */
    readonly pouch: readonly {
        readonly good: PouchGood
        readonly label: string
        readonly title: string
        readonly picked: boolean
        readonly refusal?: string
    }[]
    readonly line: string
    readonly count: string
    readonly conquerWarning?: string
    readonly primary: PrimaryButton
}

export interface HandPanel {
    readonly finaliseRow: readonly FinaliseRowEntry[]
    readonly drafting?: HandDrafting
    readonly set?: HandSet
    /** R-3.1-H1 The seats still choosing. */
    readonly waitingOn?: readonly string[]
}

const PouchRows: readonly {
    readonly good: PouchGood
    readonly label: string
    readonly title: string
}[] = [
    { good: 'saltpeter', label: 'Saltpeter: 5 cards', title: PouchTitles.saltpeter },
    { good: 'sulfur', label: 'Sulfur: two cards back to back', title: PouchTitles.sulfur }
]

type SessionOptions = ConstructorParameters<
    typeof GameSession<FeudumProjectedState, HydratedFeudumGameState>
>[0]

export class FeudumGameSession extends GameSession<FeudumProjectedState, HydratedFeudumGameState> {
    myPlayerId: string | undefined = $derived(this.myPlayer?.id)

    /** S71 A seat's paint, named by its seat in every piece's accessible name. */
    readonly paintOf = (playerId: string): SeatPaint =>
        seatPaint(this.colors, playerId, this.getPlayerName(playerId))
    /** R-1.4-H1 A dummy row's colour is one no seat is displayed in. */
    readonly colourPaintOf = (colour: Color): SeatPaint =>
        dummyPaint(this.colors, this.gameState, colour)

    readonly boardAnimator = new BoardAnimator(undefined, (piece) =>
        this.flightAnimator.carrier(piece)
    )
    readonly flightAnimator = new FlightAnimator()
    readonly pouchAnimator = new PouchAnimator()
    readonly historyLog = new HistoryLog(this)

    readonly startingGoods = new StartingGoodsDraft(() => startingGoodOffers(this.gameState))
    readonly startingPawn = new StartingPawnDraft()
    readonly hand = new HandDraft(() => this.handKey)
    readonly layers = new TableLayers(() => this.pickFrame)
    readonly turn = new TurnDraft(
        () => this.turnContext,
        () => {
            this.move.clear()
            this.guild.clear()
            this.atWill.clear()
        },
        (action, context, input) => {
            if (action === ActionType.Move) {
                return this.move.lightsOpening({ ...context, input })
            }
            return action === ActionType.GuildAction || action === ActionType.Feast
                ? this.guild.lightsOpening({
                      ...context,
                      mode: action,
                      input,
                      cardManual: false
                  })
                : []
        }
    )
    readonly move = new MoveDraft(() => this.moveContext)
    readonly guild = new GuildDraft(() => this.guildContext)
    readonly keepWrits = new KeepWritsDraft(() => this.deciding(ActionType.KeepWrits))
    readonly favours = new FavoursDraft(() => this.deciding(ActionType.ChooseFavours))
    readonly commitAttack = new CommitAttackDraft(() => this.deciding(ActionType.CommitAttack))
    readonly answerStarve = new AnswerStarveDraft(() => this.deciding(ActionType.AnswerStarve))
    readonly writLimit = new WritLimitDraft(() => this.writLimitContext)
    readonly nourish = new NourishDraft(
        () => this.deciding(ActionType.Nourish),
        () => this.nourishKey
    )
    readonly landscapes = new LandscapesDraft(() => this.deciding(ActionType.CollectLandscapes))
    readonly disc = new DiscDraft(() => this.deciding(ActionType.PlaceDisc))
    readonly atWill = new AtWillDraft(() => this.atWillContext)
    readonly offTurnDiscard = new OffTurnDiscardDraft(() => this.offTurnDiscardContext)

    private readonly oneStateDrafts = [
        this.startingGoods,
        this.startingPawn,
        this.turn,
        this.move,
        this.guild,
        this.keepWrits,
        this.favours,
        this.commitAttack,
        this.answerStarve,
        this.writLimit,
        this.landscapes,
        this.disc,
        this.offTurnDiscard,
        this.atWill
    ]

    private readonly followUps = [
        this.atWill,
        this.keepWrits,
        this.favours,
        this.commitAttack,
        this.writLimit,
        this.nourish,
        this.landscapes,
        this.disc
    ]

    private handKey: string | undefined = $derived(
        this.isViewingHistory ? undefined : handDraftKey(this.gameState, this.myPlayerId)
    )

    /** R-4.10-H4 A nourish draft lasts for this seat's decision this round. */
    private nourishKey: string | undefined = $derived.by(() => {
        const me = this.myPlayerId
        const round = this.gameState.roundManager.currentRound?.number
        if (
            this.isViewingHistory ||
            !me ||
            round === undefined ||
            this.gameState.machineState !== MachineState.Nourishing
        ) {
            return undefined
        }
        const own = this.actions.findLastIndex((action) => action.playerId === me)
        return `round-${round}:${me}:${own}`
    })

    constructor(options: SessionOptions) {
        super(options)
        for (const draft of [this.startingGoods, this.startingPawn, this.turn, this.hand]) {
            this.localSelections.register(draft.localSelection)
        }
        this.localSelections.register(this.move.localSelection, 'first')
        this.localSelections.register(this.guild.localSelection, 'first')
        for (const draft of [
            this.keepWrits,
            this.favours,
            this.commitAttack,
            this.answerStarve,
            this.writLimit,
            this.nourish,
            this.landscapes,
            this.disc,
            this.offTurnDiscard,
            // Last, so it is popped first: Undo closes an open list before anything else.
            this.atWill
        ]) {
            this.localSelections.register(draft.localSelection, 'first')
        }
    }

    /** Contract, Hand draft: it outlives others' Actions, a reconciliation and at-will plays. */
    override keepsLocalSelections(transition: PresentedTransition): boolean {
        return (
            transition.kind === 'other-action' ||
            transition.kind === 'reconciliation' ||
            transition.kind === 'own-action'
        )
    }

    /** S63 A connection coming back shows the state with no motion at all. */
    override async onGameStateChange(
        change: Parameters<BoardAnimator['onGameStateChange']>[0] & { readonly kind?: string }
    ) {
        if (change.kind === 'reconciliation') {
            return
        }
        const { from, to, action, animationContext } = change
        await this.pouchAnimator.onGameStateChange({
            from,
            to,
            action,
            animationContext,
            pouchOf: (state, playerId) =>
                seatPouchOf(state, playerId, this.myPlayerId, this.hand.hand.pouchGood)
        })
        const flights = from
            ? this.flightAnimator.plan({ from, to, action, viewerId: this.myPlayerId })
            : { flights: [], seconds: 0 }
        const flightsAt = await this.boardAnimator.onGameStateChange({
            ...change,
            flightRoom: flights.seconds
        })
        await this.flightAnimator.play(flights, animationContext, flightsAt)
    }

    /** Contract, Replay: a replay covers its entry's span and stops there. */
    override shouldAutoStepAction(action: GameAction, next?: GameAction) {
        return !this.historyLog.replaying && super.shouldAutoStepAction(action, next)
    }

    override beforeNewState(transition: PresentedTransition) {
        this.boardAnimator.settle()
        this.flightAnimator.settle()
        this.pouchAnimator.settle()
        if (this.endsDrafts(transition)) {
            for (const draft of this.oneStateDrafts) {
                draft.clear()
            }
        }
    }

    /** Contract, Shared visual state: of the Actions that arrive, only the seat's own end its draft. */
    private endsDrafts({ kind, actions }: PresentedTransition): boolean {
        if (kind !== 'other-action' && kind !== 'reconciliation') {
            return true
        }
        return actions.length === 0 || actions.some(({ playerId }) => playerId === this.myPlayerId)
    }

    private isOffered(type: ActionType): boolean {
        return !this.isViewingHistory && this.validActionTypes.includes(type)
    }

    boardOffer: BoardOffer = $derived(
        deriveBoardOffer(
            this.gameState,
            {
                startingPawnSpace: this.startingPawn.spaceId,
                ...(this.turn.cardPick ? { cardPick: this.turn.cardPick } : {}),
                ...(this.move.pick ? { movePick: this.move.pick } : {}),
                ...(this.guild.pick ? { guildPick: this.guild.pick } : {}),
                ...(this.atWillStage ? { atWillPick: this.atWillStage } : {}),
                ...(this.nourish.pick ? { nourishPick: this.nourish.pick } : {}),
                ...(this.landscapes.pick ? { landscapesPick: this.landscapes.pick } : {}),
                ...(this.disc.value('place') ? { discPlacing: true } : {})
            },
            {
                viewerId: this.myPlayerId,
                validActions: this.validActionTypes,
                viewingHistory: this.isViewingHistory,
                updatingVisibleState: this.updatingVisibleState
            }
        )
    )

    private menuPointer:
        { readonly owner: object; readonly lights: () => readonly BoardTarget[] } | undefined =
        $state.raw(undefined)

    /** Contract, Menu pointer: a panel row's hover or keyboard focus. */
    pointAtRow(owner: object, lights: () => readonly BoardTarget[]) {
        this.menuPointer = { owner, lights }
    }

    leaveRow(owner: object) {
        if (this.menuPointer?.owner === owner) {
            this.menuPointer = undefined
        }
    }

    /** Contract, Hover: touch has no hover, so a tap on the row's preview path stands in for it. */
    toggleRowPreview(owner: object, lights: () => readonly BoardTarget[]) {
        if (this.menuPointer?.owner === owner) {
            this.menuPointer = undefined
        } else {
            this.pointAtRow(owner, lights)
        }
    }

    isRowPointedAt(owner: object): boolean {
        return this.menuPointer?.owner === owner
    }

    private brightTargets: ReadonlySet<BoardTarget> = $derived(
        new Set(
            this.isViewingHistory || this.updatingVisibleState
                ? []
                : (this.menuPointer?.lights() ?? [])
        )
    )

    boardChrome: BoardChrome = $derived({
        offer: this.boardOffer,
        bright: this.brightTargets,
        press: (target) => {
            void this.pressBoardTarget(target)
        },
        openStack: (view) => {
            this.layers.openStack(view)
        },
        openSite: (spaceId) => {
            this.layers.openSite(spaceId)
        },
        hoverSite: (spaceId) => {
            this.layers.hoverSite(spaceId)
        }
    })

    boardPopup: FlowPopup | undefined = $derived.by(() => {
        const flowPopup =
            this.guildPanel?.popup ?? this.movePanel?.popup ?? this.turnPanel?.flow?.popup
        return flowPopup ?? this.startingCharacterPopup
    })

    /** S2 A space pressed first: its character is asked beside it. */
    private startingCharacterPopup: FlowPopup | undefined = $derived.by(() => {
        const panel = this.startingPawnPanel
        return panel?.asksCharacter && panel.pickedSpace
            ? {
                  anchor: spaceTarget(panel.pickedSpace),
                  choices: panel.characters.map(({ character, rank, picked }) => ({
                      ...rankedDie(character, rank),
                      picked,
                      press: () => {
                          void this.pressStartingCharacter(character)
                      }
                  }))
              }
            : undefined
    })

    async pressPopupChoice(choice: PanelChoice) {
        if (this.boardPopup && choice.press) {
            choice.press(this.turn)
            await this.sendTurnIfCompleted()
        }
    }

    /** Contract, Coexistence and precedence: with a popup open, a press outside it does nothing. */
    async pressBoardTarget(target: BoardTarget) {
        if (this.boardPopup) {
            return
        }
        const startingSpace = StartingSpaceIds.find((spaceId) => spaceTarget(spaceId) === target)
        if (this.placingStartingPawn && startingSpace) {
            await this.pressStartingSpace(startingSpace)
            return
        }
        await this.pressTurnTarget(target)
    }

    private choosingStartingGoods: boolean = $derived(
        this.isOffered(ActionType.ChooseStartingGoods)
    )

    startingGoodsPanel: StartingGoodsPanel | undefined = $derived.by(() => {
        const state = this.gameState
        const deciderId = setupSeat(state)
        if (
            this.isViewingHistory ||
            state.machineState !== MachineState.ChoosingStartingGoods ||
            !deciderId
        ) {
            return undefined
        }
        const deciding = this.choosingStartingGoods
        const draft = this.startingGoods
        const picked = deciding ? draft.goods : []
        return {
            deciderId,
            deciding,
            goods: Goods.map((good) => {
                const refusal = deciding && this.startingGoodRefusal(good)
                const spent = deciding && !refusal && this.startingGoodSpent(good)
                return {
                    good,
                    count: state.supply.haversack[good],
                    picked: picked.includes(good),
                    ...(refusal ? { refusal } : {}),
                    ...(spent ? { spent: true as const } : {})
                }
            }),
            ...(deciding && draft.asksSulfur ? { sulfurTo: draft.sulfurTo } : {}),
            ...(deciding && draft.goods.length === StartingGoodsChosen
                ? { primary: { label: primaryLabel(draft.primaryName), enabled: draft.ready } }
                : {})
        }
    })

    /** R-1.4.8 Refused when none is in the haversack. */
    private startingGoodRefusal(good: Good): string | undefined {
        return this.startingGoods.goods.includes(good)
            ? undefined
            : reasonStartingGoodRefused(this.gameState, good)
    }

    /** R-1.4.8 Three are picked already. */
    private startingGoodSpent(good: Good): boolean {
        const { goods } = this.startingGoods
        return (
            !goods.includes(good) &&
            goods.length === StartingGoodsChosen &&
            reasonStartingGoodsRefused(this.gameState, [...goods, good]) !== undefined
        )
    }

    pressStartingGood(good: Good) {
        if (this.choosingStartingGoods && !reasonStartingGoodRefused(this.gameState, good)) {
            this.startingGoods.press(good)
        }
    }

    chooseSulfurDestination(destination: SulfurDestination) {
        if (this.choosingStartingGoods) {
            this.startingGoods.chooseSulfurDestination(destination)
        }
    }

    async sendStartingGoods() {
        const { goods, sulfurTo, ready } = this.startingGoods
        const sulfurToBarrel = sulfurTo === 'barrel'
        if (
            !this.choosingStartingGoods ||
            !ready ||
            reasonStartingGoodsRefused(this.gameState, goods, sulfurToBarrel)
        ) {
            return
        }
        await this.applyAction(
            this.createPlayerAction(ChooseStartingGoods, {
                goods: [...goods],
                ...(sulfurToBarrel ? { sulfurToBarrel } : {})
            })
        )
    }

    private placingStartingPawn: boolean = $derived(this.isOffered(ActionType.PlaceStartingPawn))

    startingPawnPanel: StartingPawnPanel | undefined = $derived.by(() => {
        const state = this.gameState
        const deciderId = setupSeat(state)
        if (
            this.isViewingHistory ||
            state.machineState !== MachineState.PlacingStartingPawn ||
            !deciderId
        ) {
            return undefined
        }
        const deciding = this.placingStartingPawn
        const draft = this.startingPawn
        return {
            deciderId,
            deciding,
            characters: startingPawnOffers(state, deciderId).characters.map(
                ({ character, rank }) => ({
                    character,
                    ...(rank ? { rank } : {}),
                    picked: deciding && draft.character === character
                })
            ),
            ...(deciding && draft.spaceId ? { pickedSpace: draft.spaceId } : {}),
            asksCharacter: deciding && draft.asksCharacter
        }
    })

    async pressStartingCharacter(character: Character) {
        if (this.placingStartingPawn) {
            this.startingPawn.press({ kind: 'character', character })
            await this.sendStartingPawnIfCompleted()
        }
    }

    /** A dimmed map element does nothing (contract: Pick conventions). */
    async pressStartingSpace(spaceId: SpaceId) {
        if (this.placingStartingPawn && !reasonStartingPawnRefused(spaceId)) {
            this.startingPawn.press({ kind: 'space', spaceId })
            await this.sendStartingPawnIfCompleted()
        }
    }

    private async sendStartingPawnIfCompleted() {
        if (this.startingPawn.complete && sendsOnPress(this.startingPawn)) {
            await this.sendStartingPawn()
        }
    }

    async sendStartingPawn() {
        const { character, spaceId } = this.startingPawn
        if (this.placingStartingPawn && character && spaceId) {
            await this.applyAction(
                this.createPlayerAction(PlaceStartingPawn, { character, spaceId })
            )
        }
    }

    private drafted = $derived(this.hand.hand)

    private handPreview = $derived.by(() => {
        const me = this.myPlayerId
        return this.handKey && me
            ? previewFinaliseHand(this.gameState, me, this.drafted)
            : undefined
    })

    handPanel: HandPanel | undefined = $derived.by(() => {
        const state = this.gameState
        const { selection } = state.flow
        if (
            this.isViewingHistory ||
            state.machineState !== MachineState.SelectingHands ||
            !selection
        ) {
            return undefined
        }
        const me = this.myPlayerId
        const finaliseRow = state.turnManager.turnOrder.map((playerId) => ({
            playerId,
            finalised: selection.finalised.includes(playerId)
        }))
        const drafting = this.handDrafting()
        const set = me && selection.finalised.includes(me) ? this.handSet(me) : undefined
        const yet = finaliseRow
            .filter(({ playerId, finalised }) => !finalised && playerId !== me)
            .map(({ playerId }) => playerId)
        return {
            finaliseRow,
            ...(drafting ? { drafting } : {}),
            ...(set ? { set } : {}),
            ...(!drafting && yet.length > 0 ? { waitingOn: yet } : {})
        }
    })

    /** R-3.1-H1 Owner-known: the seat's own hand and good. */
    private handSet(me: string): HandSet {
        const { hand, committedPouch } = this.gameState.getPlayerState(me)
        const pouch = PouchRows.find(({ good }) => good === committedPouch)
        return {
            cards: hand ?? [],
            ...(pouch ? { pouch: { good: pouch.good, title: pouch.title } } : {}),
            line: this.roundLine()
        }
    }

    private roundLine(): string {
        return `Round ${this.gameState.roundManager.currentRound?.number ?? 1}`
    }

    private handDrafting(): HandDrafting | undefined {
        const me = this.myPlayerId
        const preview = this.handPreview
        if (!me || !preview) {
            return undefined
        }
        const { cards, pouchGood } = this.drafted
        const player = this.gameState.getPlayerState(me)
        const open = Math.max(preview.required - cards.length, 0)
        return {
            cards: ActionCards.map(({ kind }) => {
                const at = cards.indexOf(kind)
                return { kind, picked: at >= 0, ...(at >= 0 ? { slot: at + 1 } : {}) }
            }),
            slots: [...cards, ...Array.from({ length: open }, () => undefined)],
            pouch: PouchRows.map(({ good, label, title }) => {
                const refusal = reasonPouchRefused(player, good)
                return {
                    good,
                    label,
                    title,
                    picked: good === pouchGood,
                    ...(refusal ? { refusal } : {})
                }
            }),
            line: this.roundLine(),
            count: `${preview.chosen} of ${preview.required}`,
            ...(preview.conquerMayEndLast ? { conquerWarning: 'Conquer last is forfeited.' } : {}),
            // R-3.1-H1 Every seat finalises when it likes.
            primary: {
                label: 'Long live the king',
                note: preview.revealsInfo ? `finalise · ${CantBeUndone}` : 'finalise',
                enabled: preview.reason === undefined
            }
        }
    }

    /** Every seat drafts at once, and any seat may edit until its own send (R-3.1, R-3.1-H1). */
    toggleHandCard(kind: ActionCardKind) {
        if (this.handKey) {
            this.hand.toggleCard(kind)
        }
    }

    /** R-3.3 A press chooses the good, or clears it when chosen. */
    choosePouch(good: PouchGood) {
        const me = this.myPlayerId
        if (!this.handKey || !me) {
            return
        }
        if (!reasonPouchRefused(this.gameState.getPlayerState(me), good)) {
            this.hand.choosePouch(good)
        }
    }

    /** R-X.2 The primary button is the confirming press: a card or pouch press never sends. */
    async finaliseHand() {
        const { cards, pouchGood } = this.drafted
        if (
            !this.isOffered(ActionType.FinaliseHand) ||
            !this.handPreview ||
            this.handPreview.reason
        ) {
            return
        }
        await this.applyAction(
            this.createPlayerAction(FinaliseHand, {
                cards: [...cards],
                ...(pouchGood ? { pouchGood } : {}),
                simultaneousGroupId: handSelectionGroup(this.gameState)
            })
        )
    }

    private turnContext: TurnContext | undefined = $derived.by(() => {
        const me = this.myPlayerId
        return me && this.isOffered(ActionType.ForfeitCard)
            ? {
                  state: this.gameState,
                  playerId: me,
                  nameOf: (playerId) => this.getPlayerName(playerId)
              }
            : undefined
    })

    private moveContext: MoveContext | undefined = $derived.by(() => {
        const context = this.turnContext
        return context && this.turn.mode === ActionType.Move
            ? { state: context.state, playerId: context.playerId, input: this.turn.cardInput }
            : undefined
    })

    private guildContext: GuildContext | undefined = $derived.by(() => {
        const context = this.turnContext
        const mode = this.turn.mode
        return context && (mode === ActionType.GuildAction || mode === ActionType.Feast)
            ? { ...context, mode, input: this.turn.cardInput, cardManual: this.turn.allManual }
            : undefined
    })

    turnPanel: TurnPanel | undefined = $derived(this.turn.panel)

    movePanel: MovePanel | undefined = $derived(this.move.panel)

    guildPanel: GuildPanel | undefined = $derived(this.guild.panel)

    benchCovers: boolean = $derived.by(() => {
        const bench = this.guildPanel?.bench
        return bench !== undefined && bench.collapsed === undefined
    })

    /** Contract, Pick framing: what the open pick shows of the board; none under the bench. */
    pickFrame: PickFrame | undefined = $derived(
        this.benchCovers
            ? undefined
            : pickFrameOf(this.gameState, this.boardOffer, this.boardPopup?.anchor)
    )

    pressTurnCard(kind: ActionCardKind) {
        this.turnPanel?.cards.find((card) => card.kind === kind)?.press()
    }

    /** Contract, Seat panel: every view of a seat reads this one derivation. */
    seatPanel(playerId: string): SeatPanelView {
        const view = seatPanelOf({
            state: this.gameState,
            playerId,
            viewerId: this.myPlayerId,
            hostView: this.isViewingHost,
            nameOf: (id) => this.getPlayerName(id),
            draftedPouch: this.hand.hand.pouchGood,
            handOnDesk: this.turnPanel !== undefined
        })
        // R-3.1-H1 A pouch the reveal is turning shows its face before the state does.
        const revealing = this.pouchAnimator.revealing.get(playerId)
        return revealing ? { ...view, pouch: revealing } : view
    }

    async pressTurnChoice(choice: PanelChoice) {
        if (this.turnPanel && choice.press) {
            choice.press(this.turn)
            await this.sendTurnIfCompleted()
        }
    }

    /** A dimmed map element does nothing (contract: Pick conventions). */
    async pressTurnTarget(target: BoardTarget) {
        const pick =
            this.atWill.pickOf(target) ??
            this.nourish.pickOf(target) ??
            this.landscapes.pickOf(target) ??
            this.disc.pickOf(target) ??
            this.turn.pickOf(target) ??
            this.move.pickOf(target) ??
            this.guild.pickOf(target)
        if (pick) {
            pick.press(this.turn)
            await this.sendTurnIfCompleted()
        }
    }

    toggleTurnSecondCard() {
        if (this.turnPanel?.secondCard) {
            this.turn.toggleSecondCard()
        }
    }

    private async sendTurnPlay(play: FlowPlay | undefined) {
        if (play) {
            await this.applyAction(play.build(this))
        }
    }

    private async sendTurnIfCompleted() {
        await this.sendTurnPlay(
            this.atWill.sendsNow ??
                this.offTurnDiscard.sendsNow ??
                this.disc.sendsNow ??
                this.guild.sendsNow ??
                this.turn.sendsNow
        )
    }

    async sendTurnCard() {
        await this.sendTurnPlay(this.guild.play ?? this.move.play ?? this.turn.flow?.play)
    }

    /** R-3.2 Its press sends. */
    async forfeitTurnCard() {
        await this.sendTurnPlay(this.turn.forfeitPlay)
    }

    private contextFor(playerId: string): TurnContext {
        return {
            state: this.gameState,
            playerId,
            nameOf: (id) => this.getPlayerName(id)
        }
    }

    private deciding(type: ActionType): TurnContext | undefined {
        const me = this.myPlayerId
        return me && this.isOffered(type) ? this.contextFor(me) : undefined
    }

    /** R-4.4.4 The writ limit's own panel, for the seat its state asks. */
    private writLimitContext: TurnContext | undefined = $derived(
        this.gameState.machineState === MachineState.DiscardingWrits &&
            this.gameState.activePlayerIds.includes(this.myPlayerId ?? '')
            ? this.deciding(ActionType.DiscardWrit)
            : undefined
    )

    /** R-4.4-H1 Open while no card is picked (S50); R-4.4-H5 a discard at any time. */
    private atWillContext: AtWillContext | undefined = $derived.by(() => {
        const me = this.myPlayerId
        if (!me || this.isViewingHistory || this.turn.card) {
            return undefined
        }
        const offered = [...atWillOffers(this.gameState, me), ActionType.DiscardWrit].filter(
            (type) => this.validActionTypes.includes(type)
        )
        return offered.length > 0 ? { ...this.contextFor(me), offered } : undefined
    })

    /** R-4.4-H5 On a hotseat the seats not asked discard from here. */
    private offTurnDiscardContext: OffTurnDiscardContext | undefined = $derived.by(() => {
        if (
            !this.game.hotseat ||
            this.game.storage !== GameStorage.Local ||
            this.isViewingHistory
        ) {
            return undefined
        }
        const me = this.myPlayerId
        const state = this.gameState
        return {
            state,
            seats: state.turnManager.turnOrder.filter(
                (playerId) => playerId !== me && discardWritOffers(state, playerId).length > 0
            ),
            nameOf: (playerId) => this.getPlayerName(playerId)
        }
    })

    private get atWillStage() {
        const pick = this.atWill.pick
        const deciderId = this.myPlayerId
        const action = this.validActionTypes.find(
            (type) => type === ActionType.PlaceVessel || type === ActionType.ReclaimImmunitySeal
        )
        return pick && deciderId && action ? { ...pick, action, deciderId } : undefined
    }

    keepWritsPanel: KeepWritsPanel | undefined = $derived(this.keepWrits.panel)
    favoursPanel: FavoursPanel | undefined = $derived(this.favours.panel)
    commitPanel: CommitPanel | undefined = $derived(this.commitAttack.panel)
    answerStarvePanel: AnswerStarvePanel | undefined = $derived(this.answerStarve.panel)
    writLimitPanel: WritLimitPanel | undefined = $derived(this.writLimit.panel)
    nourishPanel: NourishPanel | undefined = $derived(this.nourish.panel)
    landscapesPanel: LandscapesPanel | undefined = $derived(this.landscapes.panel)
    discPanel: DiscPanel | undefined = $derived(this.disc.panel)
    atWillPanel: AtWillPanel | undefined = $derived(this.atWill.panel)
    offTurnDiscardPanel: OffTurnDiscardPanel | undefined = $derived(this.offTurnDiscard.panel)

    answerAttackPanel: AnswerAttackPanel | undefined = $derived.by(() => {
        const context = this.deciding(ActionType.AnswerAttack)
        return context && answerAttackPanelOf(context)
    })

    watchingPanel: WatchingPanel | undefined = $derived.by(() =>
        this.isViewingHistory
            ? undefined
            : watchingPanelOf({
                  state: this.gameState,
                  viewerId: this.myPlayerId
              })
    )

    /** R-X.1 Who looks is decided here, once; the line reads nothing of the state. */
    actionLine(action: GameAction, viewerId = this.myPlayerId): string | undefined {
        return describeAction(action, {
            viewerId,
            hostView: this.isViewingHost,
            nameOf: (id) => this.getPlayerName(id),
            dummyName: (rowId) => this.colourPaintOf(dummyRowColour(this.gameState, rowId)).owner,
            seats: this.gameState.players.map(({ playerId }) => playerId)
        })
    }

    /** R-X.1 No line while looking back; R-4.4-H5 an off-turn writ discard is not it. */
    previousSeatLine: string | undefined = $derived.by(() => {
        if (this.isViewingHistory) {
            return undefined
        }
        const turns = this.gameState.turnManager.series
        const last = this.actions.findLast((action) =>
            isDecisionPress(action, turnSeatAt(turns, action))
        )
        return last && this.actionLine(last)
    })

    /** R-4.10, R-4.12.3 One read for the asked and waiting seats (contract: Render ownership). */
    orderRow: OrderRow | undefined = $derived.by(() =>
        this.isViewingHistory ? undefined : orderRowOf(this.gameState)
    )

    /** R-4.8.2 As the flow holds it; only the attacker's own draft previews more. */
    combatTally: CombatTallyRow | undefined = $derived.by(() =>
        this.isViewingHistory ? undefined : combatTallyOf(this.gameState)
    )

    /** R-4.11, R-4.12 The roll's line and the dawn sheet, on the Actions the state has played. */
    roundEnd: RoundEndView | undefined = $derived.by(() =>
        this.isViewingHistory
            ? undefined
            : roundEndOf(this.actions, this.gameState.turnManager.series)
    )

    /** R-6.2, R-6.3 The summary replaces the action area; History keeps its description. */
    gameEnd: GameEndSummaryView | undefined = $derived.by(() =>
        this.isViewingHistory || !this.gameState.result ? undefined : gameEndOf(this.actions)
    )

    deckNote: string | undefined = $derived.by(() =>
        this.myPlayerId && !this.isViewingHistory
            ? deckNoteOf(this.gameState, this.myPlayerId)
            : undefined
    )

    /** The panel of this moment, in the order it stands (contract: Visual intents). */
    actionPanel: ActionPanelView = $derived(actionPanelOf(this))

    async pressDraftChoice(choice: { readonly press?: () => void }) {
        if (choice.press) {
            choice.press()
            await this.sendTurnPlay(
                this.atWill.sendsNow ?? this.offTurnDiscard.sendsNow ?? this.disc.sendsNow
            )
        }
    }

    async sendFollowUp() {
        await this.sendTurnPlay(this.followUps.find(({ play }) => play)?.play)
    }

    /** R-3.10.2 The second button: keep, and turn the Explore in for a second draw. */
    async keepThenShovels() {
        await this.sendTurnPlay(this.keepWrits.shovelsPlay)
    }

    /** R-3.11.3 The press that declines them; nothing staged is read. */
    async chooseNoFavours() {
        if (this.favoursPanel) {
            await this.applyAction(this.createPlayerAction(ChooseFavours, { favours: null }))
        }
    }

    /** R-3.14.1 Its press sends. An ask never answers itself. */
    async answerAttack(flipDefend: boolean) {
        const panel = this.answerAttackPanel
        if (panel && (!flipDefend || panel.flip)) {
            await this.applyAction(
                this.createPlayerAction(AnswerAttack, { revealsInfo: true, flipDefend })
            )
        }
    }

    /** R-3.14.2 Its press sends: Royal Immunity, or letting it go. */
    async answerStarveWith(royalImmunity: boolean) {
        await this.sendTurnPlay(this.answerStarve.playOf(royalImmunity))
    }
}
