import { expect } from 'vitest'
import {
    ActionSource,
    assertExists,
    GameEngine,
    type Game,
    type GameAction
} from '@tabletop/common'
import { answerAttackOffer } from '../actions/answerAttack.js'
import { chooseFavoursOffer, type ChooseFavoursOffer } from '../actions/chooseFavours.js'
import { collectLandscapesOffer } from '../actions/collectLandscapes.js'
import { attackerMayAdd } from '../actions/combat.js'
import { commitAttackOffer } from '../actions/commitAttack.js'
import { conquerOffers } from '../actions/conquer.js'
import { discardWritOffers } from '../actions/discardWrit.js'
import { exploreOffer } from '../actions/explore.js'
import { harvestOffers } from '../actions/harvest.js'
import { improveOffers, type ImproveOffer } from '../actions/improve.js'
import { influenceOffers } from '../actions/influence.js'
import { isKeepWrits, keepWritsOffer } from '../actions/keepWrits.js'
import { migrateOffers } from '../actions/migrate.js'
import { moveOffers, type MoveStep, type Pilfer, type PilferOffer } from '../actions/move.js'
import { nourishOffer } from '../actions/nourish.js'
import { isPlaceDisc, reasonPlaceDiscRefused } from '../actions/placeDisc.js'
import { starveOffers } from '../actions/starveThePeople.js'
import { reasonTaxRefused } from '../actions/tax.js'
import { tendLandscapeOffers } from '../actions/tendLandscape.js'
import { Spaces, type SpaceId } from '../data/board.js'
import { ActionCards, type ActionCardKind } from '../data/cards.js'
import type { GuildId } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { FeudumRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { HydratedFeudumGameState, type FeudumProjectedState } from '../model/gameState.js'
import { nextMarkerRole } from '../model/locationControl.js'
import type { GoodCounts } from '../model/stateSchemas.js'
import { testGame } from './state.js'

const engine = new GameEngine(FeudumRuntime)

/** What a seat sends: an Action's input, with no id and nothing the engine fills in. */
export type WalkMove = Record<string, unknown> & { type: ActionType; playerId: string }

/** One user Action and all it set off. */
export interface WalkStep {
    /** The input alone, as a client sends it. */
    readonly input: WalkMove & { id: string }
    readonly before: FeudumProjectedState
    readonly processed: readonly GameAction[]
    /** The state after each processed Action, in step with `processed`. */
    readonly after: readonly FeudumProjectedState[]
}

export interface GameWalk {
    readonly game: Game
    readonly initial: FeudumProjectedState
    readonly steps: readonly WalkStep[]
    readonly final: FeudumProjectedState
}

/** The most Actions a walk may send before it counts as stuck. */
const MostMoves = 4000

/** Seats' first pawns: a noble for Starve the People, farmers for inspecting a harvest. */
const FirstCharacters: readonly GuildId[] = ['noble', 'farmer', 'farmer', 'monk', 'knight']
const MigrantCharacters: readonly GuildId[] = ['farmer', 'noble', 'merchant', 'knight', 'monk']

/** R-4.11.2 The epoch whose stacks show their last tiles. */
const LastTileEpoch = 4

/** What the walk has already done, so the seats turn to what it hasn't. */
export class Progress {
    private readonly reached = new Set<string>()

    note(steps: readonly GameAction[], after: readonly FeudumProjectedState[]): void {
        after.forEach((state) => this.reached.add(state.machineState))
        for (const action of steps) {
            if (isPlaceDisc(action) && action.metadata?.drawnCount) {
                this.reached.add('voyage-draw')
            }
            if (isKeepWrits(action) && action.shovelsAndSwords) {
                this.reached.add('shovels')
            }
        }
    }

    has(name: string): boolean {
        return this.reached.has(name)
    }
}

/** The regions whose stacks are nearly out: a location there can empty one. */
function stackSize(state: HydratedFeudumGameState, spaceId: SpaceId): number {
    const space = Spaces.find(({ id }) => id === spaceId)
    assertExists(space, `${spaceId} is a space`)
    return state.regionStacks[space.region].length
}

/** The location whose stack is shortest, keeping the walk moving towards the end of the game. */
function bestImprovement(
    state: HydratedFeudumGameState,
    playerId: string
): ImproveOffer | undefined {
    const { goods, regionTiles } = state.getPlayerState(playerId)
    const firstTile = regionTiles.length === 0 && state.epoch < 3
    return improveOffers(state, playerId)
        .filter(
            (offer) =>
                (offer.tile.kind === 'legal' || offer.tile.candidates.length > 0) &&
                ((state.epoch === LastTileEpoch && stackSize(state, offer.spaceId) === 1) ||
                    (offer.cost !== 'seal' && (goods[offer.cost] > 1 || firstTile)))
        )
        .sort((a, b) => stackSize(state, a.spaceId) - stackSize(state, b.spaceId))[0]
}

function improveMove(offer: ImproveOffer, playerId: string): WalkMove {
    const { spaceId, feudumGuilds, discs, tile } = offer
    return {
        type: ActionType.Improve,
        playerId,
        spaceId,
        ...(feudumGuilds[0] ? { feudumGuild: feudumGuilds[0] } : {}),
        ...(discs.length > 1 ? { discId: discs[0].discId } : {}),
        ...(tile.kind === 'prohibited' ? { fallbackRegion: tile.candidates[0].stack } : {})
    }
}

/** A pawn goes where it can take a marker, the sooner where a stack is running short. */
function spaceWorth(state: HydratedFeudumGameState, playerId: string, spaceId: SpaceId): number {
    const { location } = state.spaces[spaceId]
    const takesMarker = nextMarkerRole(state.spaces[spaceId], playerId) === undefined ? 0 : 3
    const improvable = location.kind === 'outpost' || location.kind === 'farm' ? 1 : 0
    return takesMarker + (state.epoch >= 3 ? (5 - stackSize(state, spaceId)) * 2 + improvable : 0)
}

/** The best way on offer for one piece; ties turn with the action count, so pawns spread out. */
function bestStep(state: HydratedFeudumGameState, playerId: string, steps: readonly MoveStep[]) {
    const offers = moveOffers(state, playerId, { steps })
    if (offers.stepsLeft === 0) {
        return undefined
    }
    const ways = offers.pieces.flatMap(({ piece, pinned, ways: pieceWays }): MoveStep[] =>
        pinned || piece.kind !== 'pawn'
            ? []
            : pieceWays.flatMap((way): MoveStep[] =>
                  way.vessel === 'place'
                      ? []
                      : [
                            {
                                piece,
                                to: way.to,
                                medium: way.route.medium,
                                ...(way.vessel ? { vessel: way.vessel } : {}),
                                ...(way.ferry ? { ferry: way.ferry } : {})
                            }
                        ]
              )
    )
    if (ways.length === 0) {
        return undefined
    }
    const best = Math.max(...ways.map((way) => spaceWorth(state, playerId, way.to)))
    const top = ways.filter((way) => spaceWorth(state, playerId, way.to) === best)
    return top[(state.actionCount + steps.length) % top.length]
}

/** R-3.7 As many steps as the allowance gives, then a pilfer of what the seat is short of. */
function moveMove(state: HydratedFeudumGameState, playerId: string): WalkMove | undefined {
    const steps: MoveStep[] = []
    for (
        let step = bestStep(state, playerId, steps);
        step;
        step = bestStep(state, playerId, steps)
    ) {
        steps.push(step)
    }
    const { pilfers } = moveOffers(state, playerId, { steps })
    const { goods } = state.getPlayerState(playerId)
    const needed = (['food', 'wood', 'iron'] as const).filter((good) => goods[good] <= 1)
    const pilfer =
        needed.flatMap((good) => pilfers.filter(({ resource }) => resource === good))[0] ??
        pilfers[0]
    if (steps.length === 0 && !pilfer) {
        return undefined
    }
    return {
        type: ActionType.Move,
        playerId,
        steps,
        ...(pilfer ? { pilfer: pilferOf(pilfer) } : {})
    }
}

function pilferOf({ piece, from, resource }: PilferOffer): Pilfer {
    return { piece, from, resource }
}

/** What each card would do now, if anything worth a card. */
export function cardMove(
    state: HydratedFeudumGameState,
    playerId: string,
    kind: ActionCardKind,
    progress: Progress
): WalkMove | undefined {
    const player = state.getPlayerState(playerId)
    switch (kind) {
        case 'influence': {
            const { spaces, markers, short } = influenceOffers(state, playerId)
            return markers === 0
                ? undefined
                : {
                      type: ActionType.Influence,
                      playerId,
                      ...(short ? { spaceIds: spaces.slice(0, markers) } : {})
                  }
        }
        case 'explore': {
            return exploreOffer(state, playerId)?.drawCount
                ? { type: ActionType.Explore, playerId, revealsInfo: true }
                : undefined
        }
        case 'improve': {
            const tend = tendLandscapeOffers(state, playerId)
            const offer = bestImprovement(state, playerId)
            if (!progress.has(MachineState.CollectingLandscapes)) {
                const [tile] = tend.tiles
                const [spaceId] = tend.spaceIds
                if (tile && spaceId) {
                    return {
                        type: ActionType.TendLandscape,
                        playerId,
                        tileId: tile.tileId,
                        spaceId,
                        collect: false
                    }
                }
            }
            return offer ? improveMove(offer, playerId) : undefined
        }
        case 'harvest': {
            const { farms, inspect } = harvestOffers(state, playerId)
            return farms[0]
                ? {
                      type: ActionType.Harvest,
                      playerId,
                      revealsInfo: true,
                      spaceId: farms[0].spaceId,
                      mode: inspect ? 'inspect' : 'plain'
                  }
                : undefined
        }
        case 'conquer': {
            const starve = progress.has(MachineState.AwaitingImmunity)
                ? undefined
                : starveOffers(state, playerId).find((offer) => offer.revealsInfo)
            if (starve) {
                const { spaceId, targetPlayerId, role } = starve
                return { type: ActionType.StarveThePeople, playerId, spaceId, targetPlayerId, role }
            }
            const attack =
                progress.has(MachineState.CommittingAttack) || !attackerMayAdd(state, playerId)
                    ? undefined
                    : conquerOffers(state, playerId).find((offer) => offer.revealsInfo)
            return attack
                ? {
                      type: ActionType.Conquer,
                      playerId,
                      spaceId: attack.spaceId,
                      target: attack.target
                  }
                : undefined
        }
        case 'migrate': {
            const { pawnsOff, spaces, wildTileNeeded } = migrateOffers(state, playerId)
            const [pawn] = pawnsOff
            const worth = [...spaces].sort(
                (a, b) => spaceWorth(state, playerId, b) - spaceWorth(state, playerId, a)
            )
            return pawn && worth[0] && !wildTileNeeded
                ? {
                      type: ActionType.Migrate,
                      playerId,
                      pawn,
                      onto: {
                          character: MigrantCharacters[pawn % MigrantCharacters.length],
                          spaceId: worth[0]
                      }
                  }
                : undefined
        }
        case 'move': {
            return moveMove(state, playerId)
        }
        case 'repeat': {
            const played = player.played.some((card) => card.kind === 'move')
            const move = played && !player.repeatUsed ? moveMove(state, playerId) : undefined
            return move && { ...move, asRepeat: 'repeat' }
        }
        case 'tax': {
            return reasonTaxRefused(state, playerId, {})
                ? undefined
                : { type: ActionType.Tax, playerId }
        }
        case 'defend': {
            return { type: ActionType.PlayDefend, playerId }
        }
        default: {
            return undefined
        }
    }
}

/** The order a seat wants its cards in. */
const CardOrder: readonly ActionCardKind[] = [
    'influence',
    'conquer',
    'explore',
    'improve',
    'harvest',
    'migrate',
    'move',
    'repeat',
    'tax',
    'defend',
    'guild'
]

/** R-3.9.1 The seat rules a location whose stack has one tile left: taking it ends the epochs. */
function canEmptyStack(state: HydratedFeudumGameState, playerId: string): boolean {
    return (
        state.epoch === LastTileEpoch &&
        improveOffers(state, playerId).some(
            (offer) => offer.tile.kind === 'legal' && stackSize(state, offer.spaceId) === 1
        )
    )
}

/** The cards in the order the seat wants them now. */
function cardsInOrder(state: HydratedFeudumGameState, playerId: string): ActionCardKind[] {
    return canEmptyStack(state, playerId) ? ['improve', ...CardOrder] : [...CardOrder]
}

/** R-3.13.2 A noble can starve whoever next takes the serf's place beside it. */
function waitsToStarve(
    state: HydratedFeudumGameState,
    playerId: string,
    progress: Progress
): boolean {
    return (
        !progress.has(MachineState.AwaitingImmunity) &&
        state.getPlayerState(playerId).pawns.some((pawn) => pawn.character === 'noble')
    )
}

/** What each card would do if the seat were on turn holding it, run on a copy. */
function usefulCards(
    state: HydratedFeudumGameState,
    playerId: string,
    progress: Progress
): ActionCardKind[] {
    const trial = new HydratedFeudumGameState(state.dehydrate())
    const seat = trial.getPlayerState(playerId)
    seat.hand = ActionCards.map((card) => card.kind)
    trial.flow.turn = { playerId, secondCard: false, followUps: [] }
    return cardsInOrder(state, playerId).filter(
        (kind) => kind !== 'repeat' && cardMove(trial, playerId, kind, progress) !== undefined
    )
}

/** R-3.1 Four cards: those with something to do first, keeping Move and Repeat for the voyage. */
export function handFor(
    state: HydratedFeudumGameState,
    playerId: string,
    progress: Progress
): ActionCardKind[] {
    const useful = usefulCards(state, playerId, progress)
    const voyage: ActionCardKind[] = ['move', 'repeat']
    const starving: ActionCardKind[] = waitsToStarve(state, playerId, progress) ? ['conquer'] : []
    return [
        ...new Set([...starving, ...useful.slice(0, 2), ...voyage, ...useful, ...CardOrder])
    ].slice(0, 4)
}

/** R-3.2 The first card with something to do, else the last forfeited. */
function cardTurn(state: HydratedFeudumGameState, playerId: string, progress: Progress): WalkMove {
    const hand = state.getPlayerState(playerId).hand ?? []
    for (const kind of cardsInOrder(state, playerId)) {
        if (hand.includes(kind)) {
            const move = cardMove(state, playerId, kind, progress)
            if (move && !(kind === 'conquer' && hand.length === 1)) {
                return move
            }
        }
    }
    return { type: ActionType.ForfeitCard, playerId, kind: hand[hand.length - 1] }
}

/** R-3.11.3 The chart's count from what was drawn, whatever comes first. */
function favoursFrom({ drawn, favours }: ChooseFavoursOffer): GoodCounts {
    const taken = { ...drawn }
    let spare = Object.values(drawn).reduce((sum, count) => sum + count, 0) - favours
    for (const good of ['sulfur', 'saltpeter', 'iron', 'wood', 'food'] as const) {
        const back = Math.min(spare, taken[good])
        taken[good] -= back
        spare -= back
    }
    return taken
}

/** What the seat asked sends in each state that asks. */
function moveOf(state: HydratedFeudumGameState, playerId: string, progress: Progress): WalkMove {
    switch (state.machineState) {
        case MachineState.ChoosingStartingGoods: {
            return state.turnManager.turnOrder[0] === playerId
                ? {
                      type: ActionType.ChooseStartingGoods,
                      playerId,
                      goods: ['wood', 'iron', 'saltpeter']
                  }
                : {
                      type: ActionType.ChooseStartingGoods,
                      playerId,
                      goods: ['wood', 'iron', 'sulfur'],
                      sulfurToBarrel: true
                  }
        }
        case MachineState.PlacingStartingPawn: {
            const seat = state.turnManager.turnOrder.indexOf(playerId)
            return {
                type: ActionType.PlaceStartingPawn,
                playerId,
                character: FirstCharacters[seat],
                spaceId: 'space.desert.3'
            }
        }
        case MachineState.SelectingHands: {
            return {
                type: ActionType.FinaliseHand,
                playerId,
                revealsInfo: true,
                cards: handFor(state, playerId, progress)
            }
        }
        case MachineState.PlayingCards: {
            return cardTurn(state, playerId, progress)
        }
        case MachineState.AwaitingDefence: {
            const holdsDefend = answerAttackOffer(state, playerId)?.holdsDefend ?? false
            return {
                type: ActionType.AnswerAttack,
                playerId,
                revealsInfo: true,
                flipDefend: holdsDefend
            }
        }
        case MachineState.AwaitingImmunity: {
            return {
                type: ActionType.AnswerStarve,
                playerId,
                revealsInfo: true,
                royalImmunity: false
            }
        }
        case MachineState.CommittingAttack: {
            // R-4.3.3 The most counts tiles too, and this seat spends none.
            const { saltpeterMost } = commitAttackOffer(state, playerId) ?? { saltpeterMost: 0 }
            const { saltpeter } = state.getPlayerState(playerId).goods
            return {
                type: ActionType.CommitAttack,
                playerId,
                saltpeter: Math.min(1, saltpeterMost, saltpeter),
                weapons: []
            }
        }
        case MachineState.PlacingDisc: {
            return {
                type: ActionType.PlaceDisc,
                playerId,
                place: reasonPlaceDiscRefused(state, playerId, true) === undefined
            }
        }
        case MachineState.KeepingWrits: {
            const offer = keepWritsOffer(state, playerId)
            assertExists(offer, 'R-4.4.1 A writ draw waits on the seat')
            const shovels = offer.shovelsAndSwords && !offer.shovelsAndSwords.wildTileNeeded
            return {
                type: ActionType.KeepWrits,
                playerId,
                keep: offer.drawn.slice(0, offer.keep),
                ...(shovels ? { shovelsAndSwords: true } : {})
            }
        }
        case MachineState.InspectingHarvest: {
            const offer = chooseFavoursOffer(state, playerId)
            assertExists(offer, 'R-3.11.3 A harvest waits on the seat')
            return { type: ActionType.ChooseFavours, playerId, favours: favoursFrom(offer) }
        }
        case MachineState.DiscardingWrits: {
            return {
                type: ActionType.DiscardWrit,
                playerId,
                writId: discardWritOffers(state, playerId)[0]
            }
        }
        case MachineState.Nourishing: {
            const offer = nourishOffer(state, playerId)
            assertExists(offer, 'R-4.10 The seat decides its feeding')
            return { type: ActionType.Nourish, playerId, ...offer.preselected }
        }
        case MachineState.CollectingLandscapes: {
            const offer = collectLandscapesOffer(state, playerId)
            assertExists(offer, 'R-4.12.3 The serf decides')
            return {
                type: ActionType.CollectLandscapes,
                playerId,
                spaceIds: offer.spaces.map((space) => space.spaceId)
            }
        }
        default: {
            throw Error(`Nobody is asked in ${state.machineState}`)
        }
    }
}

/** What a seat asked anything but a card sends: the walk's own answer, for a spec playing on. */
export function answerOf(state: HydratedFeudumGameState, playerId: string): WalkMove {
    return moveOf(state, playerId, new Progress())
}

/** Runs one user Action canonically. */
function stepOf(game: Game, state: FeudumProjectedState, input: WalkStep['input']): WalkStep {
    const { processedActions, actionCascade } = engine.executeCanonicalAction({
        game,
        state,
        action: { gameId: game.id, source: ActionSource.User, ...input }
    })
    return {
        input,
        before: state,
        processed: processedActions,
        after: actionCascade.transitions.map(({ after }) => after)
    }
}

/** What seats want beyond the walk's own play: each ask goes to it first. */
export interface WalkPlan {
    moveFor(
        state: HydratedFeudumGameState,
        playerId: string,
        progress: Progress
    ): WalkMove | undefined
    noted(step: WalkStep): void
}

/**
 * Plays a whole game from the seed: user Actions only, each chosen from the real offers on the state
 * reached, so nothing is edited by hand and the input alone replays it.
 */
export function walkGame(masterSeed: string, numPlayers = 3, plan?: WalkPlan): GameWalk {
    const game = testGame(numPlayers)
    const initial = engine.startGame(game, { masterSeed }).initialState
    const progress = new Progress()
    const steps: WalkStep[] = []
    let state = initial
    while (state.machineState !== MachineState.EndOfGame) {
        if (steps.length >= MostMoves) {
            throw Error(`The walk is stuck in ${state.machineState} after ${steps.length} moves`)
        }
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `A seat is asked in ${state.machineState}`)
        const hydrated = new HydratedFeudumGameState(state)
        const move =
            plan?.moveFor(hydrated, playerId, progress) ?? moveOf(hydrated, playerId, progress)
        const step = stepOf(game, state, { id: `w${steps.length}`, ...move })
        progress.note(step.processed, step.after)
        plan?.noted(step)
        steps.push(step)
        state = step.after[step.after.length - 1]
    }
    return { game, initial, steps, final: state }
}

/** Replays the walk's input on a fresh game from the seed. */
export function replayWalk(masterSeed: string, walk: GameWalk): GameWalk {
    const initial = engine.startGame(walk.game, { masterSeed }).initialState
    const steps: WalkStep[] = []
    let state = initial
    for (const { input } of walk.steps) {
        const step = stepOf(walk.game, state, input)
        steps.push(step)
        state = step.after[step.after.length - 1]
    }
    return { game: walk.game, initial, steps, final: state }
}

/** The engine stamps the clock on each Action; nothing else in it may differ between two plays. */
export function withoutClock(action: GameAction): GameAction {
    const copy = { ...action }
    delete copy.createdAt
    return copy
}

/** The engine names each started game's state with a fresh row id; the rules never read it. */
export function withoutRowId(state: FeudumProjectedState): Omit<FeudumProjectedState, 'id'> {
    const { id, ...rules } = state
    expect(id).toBeTruthy()
    return rules
}

/** Undoes one processed Action by its recorded patch. */
export function undoAction(action: GameAction, state: FeudumProjectedState): FeudumProjectedState {
    return engine.undoProcessedAction({ action, state })
}
