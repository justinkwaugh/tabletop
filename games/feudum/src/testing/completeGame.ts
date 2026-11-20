import {
    ActionSource,
    assert,
    GameAction,
    GameEngine,
    getPrng,
    Visibility,
    type RandomFunction
} from '@tabletop/common'
import { Value } from 'typebox/value'
import { placeVesselOffers } from '../actions/placeVessel.js'
import { reclaimImmunitySealOffers } from '../actions/reclaimImmunitySeal.js'
import { spendRegionTileOffers } from '../actions/spendRegionTile.js'
import { ActionCards, type ActionCardKind } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import { FeudumRuntime } from '../definition/runtime.js'
import {
    FeudumGameStateValidator,
    type FeudumGameState,
    type FeudumProjectedState,
    type HydratedFeudumGameState
} from '../model/gameState.js'
import { CorpusSeats } from './corpusWalk.js'
import {
    asStored,
    canonical,
    needsHost,
    processedOf,
    runGuarded,
    viewOf,
    withoutOwnerKnown
} from './protected.js'
import { testGame } from './state.js'
import {
    cardMove,
    walkGame,
    type GameWalk,
    type Progress,
    type WalkMove,
    type WalkPlan,
    type WalkStep
} from './walk.js'

const engine = new GameEngine(FeudumRuntime)

/** The Action types that play one card, each by what the card would do now. */
const CardOfAction: Partial<Readonly<Record<string, ActionCardKind>>> = {
    [ActionType.Influence]: 'influence',
    [ActionType.Explore]: 'explore',
    [ActionType.Improve]: 'improve',
    [ActionType.TendLandscape]: 'improve',
    [ActionType.Harvest]: 'harvest',
    [ActionType.Conquer]: 'conquer',
    [ActionType.StarveThePeople]: 'conquer',
    [ActionType.Migrate]: 'migrate',
    [ActionType.Move]: 'move',
    [ActionType.Tax]: 'tax',
    [ActionType.PlayDefend]: 'defend'
}

/** R-3.3, R-3.1-H1 Even rounds commit a pouch good, so the scripted games keep one hidden. */
/** R-X.2 Seeded seats: an Action type not yet taken, else what a corpus seat wants, else the walk's play. */
export class CompleteGameSeats implements WalkPlan {
    private readonly corpus = new CorpusSeats()
    private readonly game
    private readonly random: RandomFunction
    private readonly taken = new Set<string>()
    /** Where the game stood at the last Action, for naming a stall. */
    lastReached = 'the start'

    constructor(masterSeed: string, numPlayers: number) {
        this.game = testGame(numPlayers)
        this.random = getPrng(Number.parseInt(masterSeed.slice(-8), 16))
        this.corpus.seed = masterSeed
    }

    moveFor(
        state: HydratedFeudumGameState,
        playerId: string,
        progress: Progress
    ): WalkMove | undefined {
        const fresh = engine
            .getValidActionTypesForPlayer(this.game, state.dehydrate(), playerId)
            .filter((type) => !this.taken.has(type))
        while (fresh.length > 0) {
            const [type] = fresh.splice(Math.floor(this.random() * fresh.length), 1)
            const move = this.moveOfType(type, state, playerId, progress)
            if (move) {
                return move
            }
        }
        return CompleteGameSeats.withPouch(
            state,
            playerId,
            this.corpus.moveFor(state, playerId, progress)
        )
    }

    noted(step: WalkStep): void {
        this.taken.add(step.input.type)
        this.corpus.noted(step)
        const reached = step.after[step.after.length - 1]
        this.lastReached = `${reached.machineState} at epoch ${reached.epoch}, action ${reached.actionCount}`
    }

    /** One Action of this type from the real offers, if the seat has one worth sending. */
    private moveOfType(
        type: string,
        state: HydratedFeudumGameState,
        playerId: string,
        progress: Progress
    ): WalkMove | undefined {
        const kind = CardOfAction[type]
        if (kind) {
            // R-3.15 A replay offers a card's Actions too; a corpus seat picks those.
            const held = state.getPlayerState(playerId).requireHand().includes(kind)
            const move = held ? cardMove(state, playerId, kind, progress) : undefined
            return move?.type === type ? move : undefined
        }
        switch (type) {
            case ActionType.ForfeitCard: {
                const hand = state.getPlayerState(playerId).requireHand()
                return { type: ActionType.ForfeitCard, playerId, kind: hand[hand.length - 1] }
            }
            case ActionType.SpendRegionTile: {
                const [offer] = spendRegionTileOffers(state, playerId)
                return offer
                    ? {
                          type: ActionType.SpendRegionTile,
                          playerId,
                          tileId: offer.tileId,
                          good: offer.goods[Math.floor(this.random() * offer.goods.length)]
                      }
                    : undefined
            }
            case ActionType.PlaceVessel: {
                const [offer] = placeVesselOffers(state, playerId)
                return offer
                    ? {
                          type: ActionType.PlaceVessel,
                          playerId,
                          vesselType: offer.vesselType,
                          pawn: offer.pawns[0]
                      }
                    : undefined
            }
            case ActionType.ReclaimImmunitySeal: {
                const [offer] = reclaimImmunitySealOffers(state, playerId)
                return offer
                    ? {
                          type: ActionType.ReclaimImmunitySeal,
                          playerId,
                          spaceId: offer.spaceId,
                          role: offer.role
                      }
                    : undefined
            }
            default: {
                return undefined
            }
        }
    }

    private static withPouch(
        state: HydratedFeudumGameState,
        playerId: string,
        move: WalkMove | undefined
    ): WalkMove | undefined {
        const round = state.roundManager.currentRound?.number ?? 1
        if (move?.type !== ActionType.FinaliseHand || round % 2 !== 0) {
            return move
        }
        const { goods } = state.getPlayerState(playerId)
        if (goods.sulfur > 0) {
            return { ...move, pouchGood: 'sulfur' }
        }
        const cards = CompleteGameSeats.cardKindsOf(move.cards)
        const fifth = ActionCards.find(({ kind }) => !cards.includes(kind))
        return goods.saltpeter > 0 && fifth
            ? { ...move, pouchGood: 'saltpeter', cards: [...cards, fifth.kind] }
            : move
    }

    /** A walk move's cards, read against the printed cards, in the order the move holds them. */
    private static cardKindsOf(value: unknown): ActionCardKind[] {
        const listed: unknown[] = Array.isArray(value) ? value : []
        return listed.flatMap((card) =>
            ActionCards.filter(({ kind }) => kind === card).map(({ kind }) => kind)
        )
    }
}

/** A whole game by the scripted seats; a stall throws, naming the seed and where it stood. */
export function completeGame(masterSeed: string, numPlayers: number): GameWalk {
    const seats = new CompleteGameSeats(masterSeed, numPlayers)
    try {
        return walkGame(masterSeed, numPlayers, seats)
    } catch (error) {
        throw new Error(
            `Seed ${masterSeed} at ${numPlayers} seats stalled after ${seats.lastReached}`,
            { cause: error }
        )
    }
}

/** A replay from storage: the initial state and history as text, a fresh engine, user Actions only. */
export interface PersistedReplay {
    readonly cascades: readonly number[]
    readonly processed: readonly GameAction[]
    readonly final: FeudumProjectedState
}

function stored<T>(value: T): unknown {
    return JSON.parse(JSON.stringify(value))
}

function restoredInitial(state: FeudumProjectedState): FeudumGameState {
    const restored = stored(state)
    assert(FeudumGameStateValidator.Check(restored), 'A stored initial state is canonical')
    return restored
}

function restoredAction(action: GameAction): GameAction {
    const restored = Value.Convert(GameAction, stored(action))
    assert(Value.Check(GameAction, restored), 'A stored Action is an Action')
    return restored
}

/** R-X.2 What storage replays: nothing but the initial state and the user Actions recorded. */
export function persistedReplay(walk: GameWalk): PersistedReplay {
    const fresh = new GameEngine(FeudumRuntime)
    const cascades: number[] = []
    const processed: GameAction[] = []
    let state: FeudumProjectedState = restoredInitial(walk.initial)
    for (const action of processedOf(walk).map(restoredAction)) {
        if (action.source === ActionSource.User) {
            const result = fresh.executeCanonicalAction({ game: walk.game, state, action })
            cascades.push(result.processedActions.length)
            processed.push(...result.processedActions)
            state = result.updatedState
        }
    }
    return { cascades, processed, final: state }
}

/** One perspective's replay of a whole game: what ran from its view and what waited for the host. */
export interface ProjectedReplay {
    readonly final: FeudumProjectedState
    /** R-5.1 The Action types this seat's view ran, and those that deferred to the host. */
    readonly ran: readonly string[]
    readonly deferred: readonly string[]
    /** R-5-H1 Steps that read hidden state and ran anyway: a guess. */
    readonly guessed: readonly string[]
    /** R-5.1 Steps that needed nothing hidden and deferred anyway. */
    readonly needless: readonly string[]
    /** R-5.1 Steps that ran from the view and reached anything but what the host's view shows. */
    readonly differs: readonly string[]
}

/** R-5.1 One perspective's replay: its own moves from its own view, the host's after a hidden read. */
export function replayFromView(
    walk: GameWalk,
    perspective: Visibility.Perspective
): ProjectedReplay {
    const history = Visibility.projectActionHistory({
        visibility: FeudumRuntime.visibility,
        currentState: canonical(walk.final),
        actions: processedOf(walk),
        perspective,
        game: walk.game
    })
    const seat = perspective.kind === 'player' ? perspective.playerId : undefined
    const ran: string[] = []
    const deferred: string[] = []
    const guessed: string[] = []
    const needless: string[] = []
    const differs: string[] = []
    let view = viewOf(walk.initial, perspective, walk)
    let next = 0
    for (const step of walk.steps) {
        const records = history.actions.slice(next, next + step.processed.length)
        next += step.processed.length
        const where = `${step.input.type} (${step.input.id})`
        const own = step.input.playerId === seat
        const result = own ? runGuarded(walk, step, view) : undefined
        if (result) {
            ran.push(step.input.type)
            if (needsHost(step)) {
                guessed.push(where)
            }
            const after = step.after[step.after.length - 1]
            if (
                !Value.Equal(
                    asStored(result.updatedState),
                    asStored(viewOf(after, perspective, walk))
                )
            ) {
                differs.push(where)
            }
            view = result.updatedState
        } else {
            if (own) {
                deferred.push(step.input.type)
                if (!needsHost(step)) {
                    needless.push(where)
                }
            }
            view = records.reduce<FeudumProjectedState>(
                (state, action) => engine.applyProcessedAction({ game: walk.game, state, action }),
                view
            )
        }
    }
    return { final: view, ran, deferred, guessed, needless, differs }
}

/** R-5.1 What any two perspectives must agree on: a view with every owner-known field away. */
export function publicPart(view: FeudumProjectedState): unknown {
    return asStored(withoutOwnerKnown(view))
}
