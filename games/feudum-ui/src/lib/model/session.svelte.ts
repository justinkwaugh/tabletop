import { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
import { FlightAnimator } from '$lib/animators/flightAnimator.svelte.js'
import { HistoryLog } from '$lib/model/historyLog.svelte.js'
import { ActionSource, GameStorage, type GameAction } from '@tabletop/common'
import { GameSession, type PresentedTransition } from '@tabletop/frontend-components'
import {
    ActionCards,
    ActionType,
    AnswerAttack,
    atWillOffers,
    ChooseFavours,
    ChooseStartingGoods,
    discardWritOffers,
    isNourishPawns,
    FinaliseHand,
    Goods,
    MachineState,
    PlaceStartingPawn,
    previewFinaliseHand,
    reasonPouchRefused,
    reasonStartingGoodRefused,
    reasonStartingGoodsRefused,
    reasonStartingPawnRefused,
    startingGoodOffers,
    StartingGoodsChosen,
    startingPawnOffers,
    StartingSpaceIds,
    type ActionCardKind,
    type Character,
    type FeudumProjectedState,
    type Good,
    type HydratedFeudumGameState,
    type PouchGood,
    type SpaceId
} from '@tabletop/feudum'
import { describeAction } from './actionDescription.js'
import { answerAttackPanelOf, type AnswerAttackPanel } from './answerAttack.js'
import { AnswerStarveDraft, type AnswerStarvePanel } from './answerStarveDraft.svelte.js'
import { AtWillDraft, type AtWillContext, type AtWillPanel } from './atWillDraft.svelte.js'
import type { BoardChrome } from './boardChrome.js'
import { deriveBoardOffer, spaceTarget, type BoardOffer, type BoardTarget } from './boardOffer.js'
import { CommitAttackDraft, type CommitPanel } from './commitAttackDraft.svelte.js'
import { primaryLabel, sendsOnPress } from './confirmingSend.js'
import { DiscDraft, type DiscPanel } from './discDraft.svelte.js'
import { FavoursDraft, type FavoursPanel } from './favoursDraft.svelte.js'
import { HandDraft, handDraftKey } from './handDraft.svelte.js'
import { GuildDraft, type GuildContext, type GuildPanel } from './guildDraft.svelte.js'
import { KeepWritsDraft, type KeepWritsPanel } from './keepWritsDraft.svelte.js'
import { LandscapesDraft, type LandscapesPanel } from './landscapesDraft.svelte.js'
import { MoveDraft, type MoveContext, type MovePanel } from './moveDraft.svelte.js'
import { NourishDraft, type NourishPanel } from './nourishDraft.svelte.js'
import { StartingGoodsDraft, type SulfurDestination } from './startingGoodsDraft.svelte.js'
import { StartingPawnDraft } from './startingPawnDraft.svelte.js'
import type { FlowPlay, FlowPopup, PanelChoice } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import { TableLayers } from './tableLayers.svelte.js'
import { TurnDraft, type TurnPanel } from './turnDraft.svelte.js'
import { actionPanelOf, type ActionPanelView } from './actionPanel.js'
import { seatPanelOf, type SeatPanelView } from './seatPanel.js'
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
}

export interface StartingGoodsPanel {
    readonly deciderId: string
    /** This seat chooses; otherwise only the counts and `waitingLine` apply. */
    readonly deciding: boolean
    readonly waitingLine?: string
    readonly goods: readonly {
        readonly good: Good
        readonly count: number
        readonly picked: boolean
        /** Dimmed, with the line a press gives. */
        readonly refusal?: string
    }[]
    readonly asksSulfurDestination: boolean
    readonly sulfurTo?: SulfurDestination
    readonly primary?: PrimaryButton
}

export interface StartingPawnPanel {
    readonly deciderId: string
    readonly deciding: boolean
    readonly characters: readonly {
        readonly character: Character
        /** R-4.5 "master", "journeyman", "apprentice" or "no rank". */
        readonly rankChip: string
        readonly picked: boolean
    }[]
    readonly pickedSpace?: SpaceId
    /** The character popup beside the picked space. */
    readonly asksCharacter: boolean
}

export interface FinaliseRowEntry {
    readonly playerId: string
    readonly finalised: boolean
    readonly pouchGood?: PouchGood
    readonly next: boolean
}

export interface HandDrafting {
    readonly cards: readonly { readonly kind: ActionCardKind; readonly picked: boolean }[]
    readonly pouch: readonly {
        readonly good?: PouchGood
        readonly label: string
        readonly picked: boolean
        readonly refusal?: string
    }[]
    /** "Round 4 · choose your hand" */
    readonly line: string
    /** "4 of 5" */
    readonly count: string
    readonly conquerWarning?: string
    readonly primary: PrimaryButton
}

export interface HandPanel {
    readonly finaliseRow: readonly FinaliseRowEntry[]
    /** This seat's draft; absent once it has finalised, and for anyone watching. */
    readonly drafting?: HandDrafting
}

const PouchRows: readonly { readonly good?: PouchGood; readonly label: string }[] = [
    { label: 'No pouch' },
    { good: 'saltpeter', label: 'Saltpeter: 5 cards' },
    { good: 'sulfur', label: 'Sulfur: two cards back to back' }
]

type SessionOptions = ConstructorParameters<
    typeof GameSession<FeudumProjectedState, HydratedFeudumGameState>
>[0]

/**
 * Components read this session and call its methods; it builds and sends every Action. Each staged
 * flow has one draft, registered with `localSelections`, which gives the contextual Undo.
 */
export class FeudumGameSession extends GameSession<FeudumProjectedState, HydratedFeudumGameState> {
    myPlayerId: string | undefined = $derived(this.myPlayer?.id)

    readonly boardAnimator = new BoardAnimator()
    readonly flightAnimator = new FlightAnimator()
    readonly historyLog = new HistoryLog(this)

    readonly startingGoods = new StartingGoodsDraft(() => startingGoodOffers(this.gameState))
    readonly startingPawn = new StartingPawnDraft()
    readonly hand = new HandDraft(() => this.handKey)
    /** What is open over the table: the enlarged card, the open seat, the stack view. */
    readonly layers = new TableLayers()
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
    readonly nourish = new NourishDraft(() => this.deciding(ActionType.Nourish))
    readonly landscapes = new LandscapesDraft(() => this.deciding(ActionType.CollectLandscapes))
    readonly disc = new DiscDraft(() => this.deciding(ActionType.PlaceDisc))
    readonly atWill = new AtWillDraft(() => this.atWillContext)
    readonly offTurnDiscard = new OffTurnDiscardDraft(() => this.offTurnDiscardContext)

    /** The drafts whose lifetime is one displayed state; `hand` alone outlives one. */
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
        this.nourish,
        this.landscapes,
        this.disc,
        this.offTurnDiscard,
        this.atWill
    ]

    /** The one send each follow-up's primary makes; the at-will list comes first, as it does for Undo. */
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

    /**
     * Contract, Hand draft: it survives another seat's Action and a reconciliation. It also survives this
     * seat's own at-will Action; its own `FinaliseHand` ends its key, so it reads as empty.
     */
    override keepsLocalSelections(transition: PresentedTransition): boolean {
        return (
            transition.kind === 'other-action' ||
            transition.kind === 'reconciliation' ||
            transition.kind === 'own-action'
        )
    }

    /**
     * The board's rows, then the copies crossing the wrapper, then what follows them on the board. S63 A
     * connection coming back shows the state with no motion at all.
     */
    override async onGameStateChange(
        change: Parameters<BoardAnimator['onGameStateChange']>[0] & { readonly kind?: string }
    ) {
        if (change.kind === 'reconciliation') {
            return
        }
        const { from, to, action, animationContext } = change
        const flights = from
            ? this.flightAnimator.plan({ from, to, action, viewerId: this.myPlayerId })
            : { flights: [], seconds: 0 }
        const flightsAt = await this.boardAnimator.onGameStateChange({
            ...change,
            flightRoom: flights.seconds
        })
        await this.flightAnimator.play(flights, animationContext, flightsAt)
    }

    /**
     * Contract, Replay: a replay covers its entry's span and stops there. The shared step otherwise
     * runs on through the System Actions after a span that ends on one, and the next seat's Action.
     */
    override shouldAutoStepAction(action: GameAction, next?: GameAction) {
        return !this.historyLog.replaying && super.shouldAutoStepAction(action, next)
    }

    /** Every other draft ends with the displayed state, whatever the transition. */
    override beforeNewState() {
        this.boardAnimator.settle()
        this.flightAnimator.settle()
        for (const draft of this.oneStateDrafts) {
            draft.clear()
        }
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

    // The board's chrome

    private menuPointer:
        { readonly owner: object; readonly lights: () => readonly BoardTarget[] } | undefined =
        $state.raw(undefined)

    /** Contract, Menu pointer: a panel row's hover or keyboard focus. */
    pointAtRow(owner: object, lights: () => readonly BoardTarget[]) {
        this.menuPointer = { owner, lights }
    }

    /** Its lifetime: the row's leave, blur or unmount. */
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
        }
    })

    /** One popup at a time: a guild's, a Move's, the card flow's, or setup's character. */
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
                  choices: panel.characters.map(({ character, rankChip, picked }) => ({
                      label: `${character.charAt(0).toUpperCase()}${character.slice(1)}`,
                      note: { kind: 'role', label: rankChip },
                      picked,
                      press: () => {
                          void this.pressStartingCharacter(character)
                      }
                  }))
              }
            : undefined
    })

    /** A dimmed row has no press. */
    async pressPopupChoice(choice: PanelChoice) {
        if (this.boardPopup && choice.press) {
            choice.press(this.turn)
            await this.sendTurnIfCompleted()
        }
    }

    /**
     * A lit element's press. With a popup open a press outside it does nothing and closes nothing
     * (contract: Coexistence and precedence); Undo removes the popup.
     */
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

    // Setup: goods

    private choosingStartingGoods: boolean = $derived(
        this.isOffered(ActionType.ChooseStartingGoods)
    )

    startingGoodsPanel: StartingGoodsPanel | undefined = $derived.by(() => {
        const state = this.gameState
        const deciderId = state.flow.setupOrder?.playerId
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
            ...(deciding
                ? {}
                : { waitingLine: `${this.getPlayerName(deciderId)} chooses starting goods` }),
            goods: Goods.map((good) => {
                const refusal = deciding && this.startingGoodRefusal(good)
                return {
                    good,
                    count: state.supply.haversack[good],
                    picked: picked.includes(good),
                    ...(refusal ? { refusal } : {})
                }
            }),
            asksSulfurDestination: deciding && draft.asksSulfurDestination,
            ...(deciding && draft.sulfurTo ? { sulfurTo: draft.sulfurTo } : {}),
            ...(deciding && draft.goods.length === StartingGoodsChosen
                ? { primary: { label: primaryLabel(draft.primaryName), enabled: draft.ready } }
                : {})
        }
    })

    /** R-1.4.8 Why a press on this good does nothing: none in the haversack, or three already. */
    private startingGoodRefusal(good: Good): string | undefined {
        const { goods } = this.startingGoods
        if (goods.includes(good)) {
            return undefined
        }
        return (
            reasonStartingGoodRefused(this.gameState, good) ??
            (goods.length === StartingGoodsChosen
                ? reasonStartingGoodsRefused(this.gameState, [...goods, good])
                : undefined)
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

    /** The primary button. Always a press: a lone legal pick stages and waits for it. */
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

    // Setup: pawn

    private placingStartingPawn: boolean = $derived(this.isOffered(ActionType.PlaceStartingPawn))

    startingPawnPanel: StartingPawnPanel | undefined = $derived.by(() => {
        const state = this.gameState
        const deciderId = state.flow.setupOrder?.playerId
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
                    rankChip: rank ?? 'no rank',
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

    /** The press that completes an undoable Action sends at once. */
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

    // Hand selection

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
        const finaliseRow = state.turnManager.turnOrder.map((playerId) => {
            const finalised = selection.finalised.includes(playerId)
            const { pouch } = state.getPlayerState(playerId)
            return {
                playerId,
                finalised,
                ...(finalised && pouch ? { pouchGood: pouch } : {}),
                next: selection.playerId === playerId
            }
        })
        const drafting = this.handDrafting(selection.playerId)
        return { finaliseRow, ...(drafting ? { drafting } : {}) }
    })

    private handDrafting(nextFinaliser: string): HandDrafting | undefined {
        const me = this.myPlayerId
        const preview = this.handPreview
        if (!me || !preview) {
            return undefined
        }
        const { cards, pouchGood } = this.drafted
        const player = this.gameState.getPlayerState(me)
        return {
            cards: ActionCards.map(({ kind }) => ({ kind, picked: cards.includes(kind) })),
            pouch: PouchRows.map(({ good, label }) => {
                const refusal = good && reasonPouchRefused(player, good)
                return {
                    ...(good ? { good } : {}),
                    label,
                    picked: good === pouchGood,
                    ...(refusal ? { refusal } : {})
                }
            }),
            line: `Round ${this.gameState.roundManager.currentRound?.number ?? 1} · choose your hand`,
            count: `${preview.chosen} of ${preview.required}`,
            ...(preview.conquerMayEndLast
                ? { conquerWarning: 'Conquer may end up your last card; it would be forfeited.' }
                : {}),
            primary:
                nextFinaliser === me
                    ? {
                          label: primaryLabel('Long live the king', preview),
                          enabled: preview.reason === undefined
                      }
                    : {
                          label: `Waiting for ${this.getPlayerName(nextFinaliser)} to finalise`,
                          enabled: false
                      }
        }
    }

    /** Every seat drafts at once, and any seat may edit until its own send (R-3.1, R-3.1-H1). */
    toggleHandCard(kind: ActionCardKind) {
        if (this.handKey) {
            this.hand.toggleCard(kind)
        }
    }

    /** A dimmed pouch row's press does nothing but give its line (R-3.3). */
    choosePouch(good: PouchGood | undefined) {
        const me = this.myPlayerId
        if (!this.handKey || !me) {
            return
        }
        if (!good || !reasonPouchRefused(this.gameState.getPlayerState(me), good)) {
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
                ...(pouchGood ? { pouchGood } : {})
            })
        )
    }

    // Turn: card plays. The rules and the stages are in the turn draft; a press comes through here.

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

    /** R-3.7 The card's own draft takes over from the flow, which hands it off. */
    private moveContext: MoveContext | undefined = $derived.by(() => {
        const context = this.turnContext
        return context && this.turn.mode === ActionType.Move
            ? { state: context.state, playerId: context.playerId, input: this.turn.cardInput }
            : undefined
    })

    /** R-3.16, R-3.16.3 As Move: the card's own draft takes over. */
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

    /** The bench stands over the board; for a map pick it closes down to its header. */
    benchCovers: boolean = $derived.by(() => {
        const bench = this.guildPanel?.bench
        return bench !== undefined && bench.collapsed === undefined
    })

    pressTurnCard(kind: ActionCardKind) {
        this.turnPanel?.cards.find((card) => card.kind === kind)?.press()
    }

    /** Contract, Seat panel: every view of a seat reads this one derivation, on the displayed state. */
    seatPanel(playerId: string): SeatPanelView {
        return seatPanelOf({
            state: this.gameState,
            playerId,
            viewerId: this.myPlayerId,
            hostView: this.isViewingHost,
            nameOf: (id) => this.getPlayerName(id),
            draftedPouch: this.hand.hand.pouchGood
        })
    }

    /** A dimmed row has no press: it gives its line and does nothing. */
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

    /** The press that completes an undoable Action sends at once. */
    private async sendTurnIfCompleted() {
        await this.sendTurnPlay(
            this.atWill.sendsNow ??
                this.offTurnDiscard.sendsNow ??
                this.disc.sendsNow ??
                this.guild.sendsNow ??
                this.turn.sendsNow
        )
    }

    /** The primary button. */
    async sendTurnCard() {
        await this.sendTurnPlay(this.guild.play ?? this.move.play ?? this.turn.flow?.play)
    }

    /** R-3.2 Its press sends. */
    async forfeitTurnCard() {
        await this.sendTurnPlay(this.turn.forfeitPlay)
    }

    // Follow-ups, asks and the at-will row: each draft reads only for the seat its state names.

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

    /**
     * R-4.4.4 The limit's own panel reads in its state, for the seat it asks: any seat holding a writ
     * is offered `DiscardWrit` at any time (R-4.4-H5).
     */
    private writLimitContext: TurnContext | undefined = $derived(
        this.gameState.machineState === MachineState.DiscardingWrits &&
            this.gameState.activePlayerIds.includes(this.myPlayerId ?? '')
            ? this.deciding(ActionType.DiscardWrit)
            : undefined
    )

    /**
     * R-4.4-H1 Open while no card is picked, for what this seat can do now (S50); R-4.4-H5 a discard
     * is offered at any time, on the seat's turn or not.
     */
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

    /**
     * R-4.4-H5 A hotseat plays every seat on one screen, which shows the seat the state asks; the
     * others holding a writ discard from here. The developer harness switches seats itself.
     */
    private offTurnDiscardContext: OffTurnDiscardContext | undefined = $derived.by(() => {
        if (
            !this.game.hotseat ||
            this.game.storage !== GameStorage.Local ||
            this.isDeveloperHarness ||
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
                  viewerId: this.myPlayerId,
                  nameOf: (id) => this.getPlayerName(id)
              })
    )

    /**
     * R-X.1 The log's line for an Action, as this seat reads it: who looks is decided here, once,
     * and the line reads nothing of the state.
     */
    actionLine(action: GameAction, viewerId = this.myPlayerId): string | undefined {
        return describeAction(action, {
            viewerId,
            hostView: this.isViewingHost,
            nameOf: (id) => this.getPlayerName(id)
        })
    }

    /** R-X.1 What the previous seat just did, for the waiting view; no line while looking back. */
    previousSeatLine: string | undefined = $derived.by(() => {
        if (this.isViewingHistory) {
            return undefined
        }
        const last = this.actions.findLast(({ source }) => source === ActionSource.User)
        return last && this.actionLine(last)
    })

    /** R-4.10, R-4.12.3 One read for the seat asked and the seats waiting (contract: Render ownership). */
    orderRow: OrderRow | undefined = $derived.by(() =>
        this.isViewingHistory
            ? undefined
            : orderRowOf(
                  this.gameState,
                  (
                      this.actions.findLast((action) => isNourishPawns(action))?.metadata?.fed ?? []
                  ).map(({ playerId }) => playerId)
              )
    )

    /** R-4.8.2 As the flow holds it, for every seat; only the attacker's own draft previews more. */
    combatTally: CombatTallyRow | undefined = $derived.by(() =>
        this.isViewingHistory ? undefined : combatTallyOf(this.gameState)
    )

    /** R-4.11, R-4.12 The roll's line and the dawn sheet, on the Actions the state has played. */
    roundEnd: RoundEndView | undefined = $derived.by(() =>
        this.isViewingHistory ? undefined : roundEndOf(this.actions)
    )

    /** R-6.2, R-6.3 The summary replaces the action area; History keeps its description. */
    gameEnd: GameEndSummaryView | undefined = $derived.by(() =>
        this.isViewingHistory || !this.gameState.result
            ? undefined
            : gameEndOf(this.actions, (id) => this.getPlayerName(id))
    )

    deckNote: string | undefined = $derived.by(() =>
        this.myPlayerId && !this.isViewingHistory
            ? deckNoteOf(this.gameState, this.myPlayerId)
            : undefined
    )

    /** The panel of this moment, in the order it stands (contract: Visual intents). */
    actionPanel: ActionPanelView = $derived(actionPanelOf(this))

    /** A dimmed row has no press: it gives its line and does nothing. */
    async pressDraftChoice(choice: { readonly press?: () => void }) {
        if (choice.press) {
            choice.press()
            await this.sendTurnPlay(
                this.atWill.sendsNow ?? this.offTurnDiscard.sendsNow ?? this.disc.sendsNow
            )
        }
    }

    /** The primary button of whichever follow-up is open. */
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
