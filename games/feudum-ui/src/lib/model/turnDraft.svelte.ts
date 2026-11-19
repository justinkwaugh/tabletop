import {
    getStagedSelectionValue,
    pushStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import {
    ActionType,
    atWillOffers,
    discardWritOffers,
    cardOf,
    cardPlayOffers,
    ForfeitCard,
    goodsShort,
    improveOffers,
    MigrateFood,
    reasonForfeitRefused,
    tendLandscapeOffers,
    type ActionCardKind,
    type CardPlayInput,
    type RepeatMode,
    type CardPlayOffers
} from '@tabletop/feudum'
import {
    flowOf,
    TurnStageOrder,
    type FlowInput,
    type FlowPick,
    type FlowPlay,
    type FlowView,
    type PanelChoice,
    type TurnDraftValues,
    type TurnPresser,
    type TurnStage
} from './cardFlows.js'
import {
    cardModes,
    loneMode,
    type CardAction,
    type CardMode,
    type TurnContext
} from './cardModes.js'
import { primaryLabel, sendsOnPress } from './confirmingSend.js'
import type { BoardTarget, PickTarget } from './boardOffer.js'
import { StagedDraft, withLoneChoice } from './stagedDraft.svelte.js'
import { coverNeeds, loneCover } from './tileCover.js'

type TurnStages = StagedSelectionState<TurnDraftValues>

function stageValue<K extends TurnStage>(
    stages: TurnStages,
    stage: K
): TurnDraftValues[K] | undefined {
    return getStagedSelectionValue<TurnDraftValues, K>(stages, stage)
}

export const EpochNumerals = ['', 'I', 'II', 'III', 'IV', 'V']

export interface TurnPrimary {
    readonly label: string
    /** The full words, its accessible name, where the label says them shorter. */
    readonly named?: string
    readonly enabled: boolean
}

export interface TurnCardRow {
    readonly kind: ActionCardKind
    readonly label: string
    readonly picked: boolean
    readonly press: () => void
    /** Contract, Hover: what this row's press would light. */
    readonly lights: () => readonly BoardTarget[]
}

export interface TurnPanel {
    /** "Card 2 of 4", or "2nd card" (R-3.3). */
    readonly line: string
    readonly cards: readonly TurnCardRow[]
    /** Repeat's played cards the seat can replay now (R-3.15); one it can't is not drawn. */
    readonly replays: readonly PanelChoice[]
    /** The modes open now; a refused one is not drawn. Empty when only Forfeit is left. */
    readonly modes: readonly PanelChoice[]
    /** R-3.13-H1, R-3.15 The engine refuses every other mode. */
    readonly forfeitOnly: boolean
    /** With only Forfeit left, one short line why ("Can't be played last."). */
    readonly fact?: string
    /** Present once a card is picked: R-3.2. */
    readonly forfeit?: string
    /**
     * R-3.3 Present while the pouch holds an unused sulfur: "2 cards" and the sulfur it spends, its
     * label the accessible name.
     */
    readonly secondCard?: { readonly label: string; readonly shown: string; readonly on: boolean }
    readonly flow?: FlowView
    readonly primary?: TurnPrimary
}

/**
 * R-3.13-H1, R-3.15 Why only Forfeit is left, in one short line: a card that can't be last, a Repeat
 * with nothing to replay, or what the first of the card's modes is refused for.
 */
function forfeitFact(
    card: ActionCardKind,
    notLast: boolean,
    modes: readonly CardMode[]
): string | undefined {
    if (card === 'repeat') {
        return 'Nothing to replay.'
    }
    return notLast ? "Can't be played last." : modes.find(({ refusal }) => refusal)?.refusal
}

/**
 * R-3.2 The turn draft (contract: Shared visual state): card, mode, then that mode's targets and
 * popups, then the cover for a short payment. The rules stay in the logic package's offers and
 * refusals: `cardModes` asks which modes are open, `cardFlows` turns the open one into a view.
 */
export class TurnDraft extends StagedDraft<TurnDraftValues> implements TurnPresser {
    private readonly seeing: TurnStages = $derived.by(() => this.withLoneChoices(super.read()))

    /**
     * `onReselect`: a later draft's stages end when a card, replay or mode is pressed.
     * `lightsOfHandOff`: what opening a mode another draft builds would light.
     */
    constructor(
        private readonly contextOf: () => TurnContext | undefined,
        private readonly onReselect?: () => void,
        private readonly lightsOfHandOff?: (
            action: ActionType,
            context: TurnContext,
            input: CardPlayInput
        ) => readonly BoardTarget[]
    ) {
        super(TurnStageOrder)
    }

    /** R-X.1 Others and History View have no draft; lone choices read through as `auto`. */
    protected override read(): TurnStages {
        return this.seeing
    }

    private withLoneChoices(stored: TurnStages): TurnStages {
        const context = this.contextOf()
        if (!context) {
            return {}
        }
        const { state, playerId } = context
        const offers = cardPlayOffers(state, playerId)
        let stages = withLoneChoice<TurnDraftValues, 'card'>(
            stored,
            TurnStageOrder,
            'card',
            // R-4.4-H1 A staged card hides the at-will row: it stays a press while the row can act,
            // and R-4.4-H5 a held writ can always be discarded there.
            atWillOffers(state, playerId).length > 0 ||
                discardWritOffers(state, playerId).length > 0
                ? []
                : offers.cards.map(({ kind }) => kind)
        )
        if (stageValue(stages, 'card') === 'repeat') {
            stages = withLoneChoice<TurnDraftValues, 'replay'>(
                stages,
                TurnStageOrder,
                'replay',
                offers.repeats.map(({ kind }) => kind)
            )
        }
        const input = this.inputOf(stages, offers)
        const modeNow = this.openMode(stages, context, input)
        const space = stageValue(stages, 'space')
        if (modeNow === ActionType.Improve) {
            const offer = improveOffers(state, playerId).find((row) => row.spaceId === space)
            stages = withLoneChoice<TurnDraftValues, 'guild'>(
                stages,
                TurnStageOrder,
                'guild',
                offer?.feudumGuilds ?? []
            )
        }
        if (modeNow === ActionType.TendLandscape) {
            stages = withLoneChoice<TurnDraftValues, 'tile'>(
                stages,
                TurnStageOrder,
                'tile',
                tendLandscapeOffers(state, playerId).tiles.map(({ tileId }) => tileId)
            )
        }
        if (modeNow === ActionType.Migrate && stageValue(stages, 'character')) {
            const needs = coverNeeds(goodsShort(state, playerId, MigrateFood))
            stages = withLoneChoice<TurnDraftValues, 'cover'>(
                stages,
                TurnStageOrder,
                'cover',
                needs.length > 0 ? loneCover(state, playerId, needs) : []
            )
        }
        return stages
    }

    private inputOf(stages: TurnStages, offers: CardPlayOffers): CardPlayInput {
        const replay = stageValue(stages, 'replay')
        const asRepeat = offers.repeats.find(({ kind }) => kind === replay)?.mode
        return {
            ...(asRepeat ? { asRepeat } : {}),
            ...(stageValue(stages, 'secondCard') ? { secondCard: true } : {})
        }
    }

    private playedKind(stages: TurnStages): ActionCardKind | undefined {
        const card = stageValue(stages, 'card')
        return card === 'repeat' ? stageValue(stages, 'replay') : card
    }

    private modesOf(
        stages: TurnStages,
        context: TurnContext,
        input: CardPlayInput
    ): readonly CardMode[] {
        const kind = this.playedKind(stages)
        return kind ? cardModes(context, kind, input) : []
    }

    private openMode(
        stages: TurnStages,
        context: TurnContext,
        input: CardPlayInput
    ): CardAction | undefined {
        return stageValue(stages, 'mode') ?? loneMode(this.modesOf(stages, context, input))
    }

    private offers: CardPlayOffers | undefined = $derived.by(() => {
        const context = this.contextOf()
        return context && cardPlayOffers(context.state, context.playerId)
    })

    get card(): ActionCardKind | undefined {
        return this.value('card')
    }

    /** What the Action's input carries: for a later draft that builds a card's Action. */
    cardInput: CardPlayInput = $derived.by(() =>
        this.offers ? this.inputOf(this.selection, this.offers) : {}
    )

    private modes: readonly CardMode[] = $derived.by(() => {
        const context = this.contextOf()
        return context ? this.modesOf(this.selection, context, this.cardInput) : []
    })

    /** The picked or lone mode: Move and the guild functions read this to open their own draft. */
    mode: CardAction | undefined = $derived.by(() => {
        const context = this.contextOf()
        return context ? this.openMode(this.selection, context, this.cardInput) : undefined
    })

    flow: FlowView | undefined = $derived.by(() => {
        const context = this.contextOf()
        const { mode } = this
        if (!context || !mode) {
            return undefined
        }
        const flow: FlowInput = {
            ...context,
            input: this.cardInput,
            read: (stage) => this.value(stage)
        }
        const label = this.modes.find(({ action }) => action === mode)?.label ?? ''
        return flowOf(mode, flow, label)
    })

    /** Contract, Pick conventions: pressing a pick again unpicks it. */
    pick<K extends TurnStage>(stage: K, value: TurnDraftValues[K]): void {
        if (this.value(stage) === value) {
            this.clearFrom(stage)
        } else {
            this.set(stage, value)
        }
        this.onReselect?.()
    }

    stack<K extends 'spaces' | 'cover'>(stage: K, value: TurnDraftValues[K]): void {
        this.write(pushStagedSelectionValue(this.selection, TurnStageOrder, stage, value))
    }

    /** R-3.3 A toggle keeps what is picked after it: it changes the declaration, not the card. */
    toggleSecondCard(): void {
        const { secondCard, ...rest } = this.selection
        this.write(secondCard ? rest : { ...rest, secondCard: { value: true, source: 'manual' } })
    }

    /** R-3.2 Plays the card in hand, a Repeat being forfeited as itself. */
    get forfeitPlay(): FlowPlay | undefined {
        const context = this.contextOf()
        const { card } = this
        if (!context || !card) {
            return undefined
        }
        const secondCard = this.value('secondCard')
        const input = secondCard ? { secondCard } : {}
        return reasonForfeitRefused(context.state, context.playerId, card, input)
            ? undefined
            : {
                  build: (maker) => maker.createPlayerAction(ForfeitCard, { kind: card, ...input })
              }
    }

    /** Contract, Hover: what a press on this mode's row would light, staging nothing. */
    private lightsOfMode(
        action: CardAction,
        label: string,
        card = this.value('card'),
        input = this.cardInput
    ): readonly BoardTarget[] {
        const context = this.contextOf()
        if (!context) {
            return []
        }
        const secondCard = this.value('secondCard')
        const replay = this.value('replay')
        const seeing: Partial<TurnDraftValues> = {
            ...(card ? { card } : {}),
            ...(secondCard ? { secondCard } : {}),
            ...(replay ? { replay } : {}),
            mode: action
        }
        const flow = flowOf(action, { ...context, input, read: (stage) => seeing[stage] }, label)
        return flow.handedOff
            ? (this.lightsOfHandOff?.(flow.handedOff, context, input) ?? [])
            : flow.picks.map(({ target }) => target)
    }

    /** A card with a lone open mode opens it at once; any other press lights nothing yet. */
    private lightsOfCard(kind: ActionCardKind): readonly BoardTarget[] {
        const context = this.contextOf()
        if (!context || kind === 'repeat') {
            return []
        }
        const modes = cardModes(context, kind, this.cardInput)
        const action = loneMode(modes)
        const label = modes.find((mode) => mode.action === action)?.label
        return action && label ? this.lightsOfMode(action, label, kind) : []
    }

    /** R-3.15 A replay opens that card's stages: what they would light, with the repeat it carries. */
    private lightsOfReplay(kind: ActionCardKind, asRepeat: RepeatMode): readonly BoardTarget[] {
        const context = this.contextOf()
        if (!context) {
            return []
        }
        const input = { ...this.cardInput, asRepeat }
        const modes = cardModes(context, kind, input)
        const action = loneMode(modes)
        const label = modes.find((mode) => mode.action === action)?.label
        return action && label ? this.lightsOfMode(action, label, undefined, input) : []
    }

    /** What the board lights for the open flow. */
    cardPick:
        | { readonly targets: readonly PickTarget[]; readonly picked: readonly BoardTarget[] }
        | undefined = $derived.by(() => {
        const { flow } = this
        return flow && flow.picks.length > 0
            ? {
                  targets: flow.picks.map(({ target, notes }) => ({
                      target,
                      ...(notes ? { notes } : {})
                  })),
                  picked: flow.picked
              }
            : undefined
    })

    /** A press outside an open popup does nothing (contract: Coexistence and precedence). */
    pickOf(target: BoardTarget): FlowPick | undefined {
        const { flow } = this
        return flow?.popup ? undefined : flow?.picks.find((pick) => pick.target === target)
    }

    /** The press just made finishes an undoable Action, so it sends rather than asks. */
    get sendsNow(): FlowPlay | undefined {
        const { flow } = this
        return flow?.play && !flow.confirms && sendsOnPress(this, flow.play) ? flow.play : undefined
    }

    private get primary(): TurnPrimary | undefined {
        const { flow } = this
        if (
            !flow?.primaryName ||
            !(flow.confirms || (flow.play && !sendsOnPress(this, flow.play)))
        ) {
            return undefined
        }
        return {
            label: primaryLabel(flow.primaryName, flow.play),
            ...(flow.primaryNamed ? { named: primaryLabel(flow.primaryNamed, flow.play) } : {}),
            enabled: flow.play !== undefined
        }
    }

    private replays(
        context: TurnContext,
        offers: CardPlayOffers,
        input: CardPlayInput
    ): readonly PanelChoice[] {
        const replay = this.value('replay')
        // Rule 5: a played card none of whose modes is open now is not drawn.
        return offers.repeats
            .filter(({ kind, mode }) =>
                cardModes(context, kind, { ...input, asRepeat: mode }).some(
                    ({ refusal }) => !refusal
                )
            )
            .map(({ kind, mode }): PanelChoice => ({
                label: cardOf(kind).printedName,
                ...(mode === 'deja-vu'
                    ? { note: { kind: 'cost', label: 'Déjà Vu · 1 saltpeter' } as const }
                    : {}),
                picked: replay === kind,
                press: (draft: TurnPresser) => {
                    draft.pick('replay', kind)
                },
                lights: () => this.lightsOfReplay(kind, mode)
            }))
    }

    panel: TurnPanel | undefined = $derived.by(() => {
        const context = this.contextOf()
        const { offers } = this
        if (!context || !offers) {
            return undefined
        }
        const { state, playerId } = context
        const player = state.getPlayerState(playerId)
        const { card, mode, modes, flow, cardInput } = this
        const hand = offers.cards
        // The epoch and round stand on the board and the phone's status strip.
        const line = state.flow.turn?.secondCard
            ? '2nd card'
            : `Card ${player.played.length + 1} of ${player.played.length + hand.length}`
        const cards = hand.map(({ kind }): TurnCardRow => ({
            kind,
            label: cardOf(kind).printedName,
            picked: card === kind,
            press: () => {
                this.pick('card', kind)
            },
            lights: () => this.lightsOfCard(kind)
        }))
        if (!card) {
            return { line, cards, replays: [], modes: [], forfeitOnly: false }
        }
        const logic = hand.find(({ kind }) => kind === card)
        const replays = card === 'repeat' ? this.replays(context, offers, cardInput) : []
        const noneOpen = modes.length > 0 && modes.every(({ refusal }) => refusal)
        const forfeitOnly =
            logic?.forfeitOnly === true || noneOpen || (card === 'repeat' && replays.length === 0)
        const fact = forfeitOnly ? forfeitFact(card, logic?.forfeitOnly === true, modes) : undefined
        const { primary } = this
        return {
            line,
            cards,
            replays: forfeitOnly ? [] : replays,
            modes: forfeitOnly
                ? []
                : modes
                      .filter(({ refusal }) => !refusal)
                      .map(({ action, label, shown, cost }): PanelChoice => ({
                          label,
                          ...(shown ? { shown } : {}),
                          ...(cost ? { cost } : {}),
                          picked: mode === action,
                          press: (draft: TurnPresser) => {
                              draft.pick('mode', action)
                          },
                          lights: () => this.lightsOfMode(action, label)
                      })),
            forfeitOnly,
            ...(fact ? { fact } : {}),
            forfeit: 'Forfeit',
            ...(offers.secondCard
                ? {
                      secondCard: {
                          label: 'Play two cards this turn',
                          shown: '2 cards',
                          on: this.value('secondCard') === true
                      }
                  }
                : {}),
            ...(flow && !forfeitOnly ? { flow } : {}),
            ...(primary && !forfeitOnly ? { primary } : {})
        }
    })
}
