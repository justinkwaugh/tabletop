import { GameSession, type PresentedTransition } from '@tabletop/frontend-components'
import {
    ActionCards,
    ActionType,
    ChooseStartingGoods,
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
    type ActionCardKind,
    type Character,
    type FeudumProjectedState,
    type Good,
    type HydratedFeudumGameState,
    type PouchGood,
    type SpaceId
} from '@tabletop/feudum'
import { deriveBoardOffer, type BoardOffer } from './boardOffer.js'
import { primaryLabel, sendsOnPress } from './confirmingSend.js'
import { HandDraft, handDraftKey } from './handDraft.svelte.js'
import { StartingGoodsDraft, type SulfurDestination } from './startingGoodsDraft.svelte.js'
import { StartingPawnDraft } from './startingPawnDraft.svelte.js'

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

    readonly startingGoods = new StartingGoodsDraft(() => startingGoodOffers(this.gameState))
    readonly startingPawn = new StartingPawnDraft()
    readonly hand = new HandDraft(() => this.handKey)

    /** The drafts whose lifetime is one displayed state; `hand` alone outlives one. */
    private readonly oneStateDrafts = [this.startingGoods, this.startingPawn]

    private handKey: string | undefined = $derived(
        this.isViewingHistory ? undefined : handDraftKey(this.gameState, this.myPlayerId)
    )

    constructor(options: SessionOptions) {
        super(options)
        for (const draft of [...this.oneStateDrafts, this.hand]) {
            this.localSelections.register(draft.localSelection)
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

    /** Every other draft ends with the displayed state, whatever the transition. */
    override beforeNewState() {
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
            { startingPawnSpace: this.startingPawn.spaceId },
            {
                viewerId: this.myPlayerId,
                validActions: this.validActionTypes,
                viewingHistory: this.isViewingHistory,
                updatingVisibleState: this.updatingVisibleState
            }
        )
    )

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
}
