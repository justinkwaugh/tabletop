import {
    assert,
    shuffle,
    type ExplorationPopulation,
    type GameExploration,
    type RandomFunction
} from '@tabletop/common'
import { Spaces } from '../data/board.js'
import { ActionCards, type ActionCardKind } from '../data/cards.js'
import { ScrollSpaces } from '../data/guilds.js'
import {
    EpochLandscapes,
    RegionTiles,
    TileEpochs,
    type LandscapeKind,
    type TileId
} from '../data/regionTiles.js'
import { Seals, type SealId } from '../data/seals.js'
import { Charters, RoyalWrits, type WritId } from '../data/writs.js'
import { FeudumCanonicalStateValidator } from '../model/canonicalValidator.js'
import { HydratedFeudumGameState, type FeudumProjectedState } from '../model/gameState.js'
import { immunityKey } from '../model/seals.js'
import type { FeudumVault } from '../model/vault.js'

type ProjectedPlayer = FeudumProjectedState['players'][number]

function shuffled<T>(items: readonly T[], random: RandomFunction): T[] {
    const copy = [...items]
    shuffle(copy, random)
    return copy
}

/** Takes the next `count` from a dealt pile; a pile too short means the counts don't add up. */
function deal<T>(pile: T[], count: number): T[] {
    assert(pile.length >= count, 'Exploration counts do not match the source')
    return pile.splice(0, count)
}

/** R-3.1, R-3.2 Different kinds from the player's eleven, none played this round. */
function dealHand(
    { played, handCount }: ProjectedPlayer,
    random: RandomFunction
): ActionCardKind[] {
    const unplayed = ActionCards.map((card) => card.kind).filter(
        (kind) => !played.some((card) => card.kind === kind)
    )
    return deal(shuffled(unplayed, random), handCount)
}

/** R-5.1 The writs the explorer cannot place, in catalogue order. */
function unplacedWrits(state: FeudumProjectedState): WritId[] {
    const placed = new Set<WritId>([
        ...state.publicDeckWrits.map(({ writId }) => writId),
        ...state.players.flatMap((player) => [
            ...(player.writs ?? []),
            ...(player.sealedCharters ?? []),
            ...(player.deckKnowledge ?? []).map(({ writId }) => writId)
        ]),
        ...(state.flow.writDraw?.drawn ?? [])
    ])
    return RoyalWrits.map((writ) => writ.id).filter((writId) => !placed.has(writId))
}

/** R-4.4.3 Only a charter is sealed, so these come out of the pile before anything else. */
function dealCharters(pile: WritId[], count: number): WritId[] {
    const charters = pile
        .filter((writId) => Charters.some((charter) => charter.id === writId))
        .slice(0, count)
    assert(charters.length === count, 'Exploration counts do not match the source')
    for (const charter of charters) {
        pile.splice(pile.indexOf(charter), 1)
    }
    return charters
}

/**
 * R-4.4.4, R-3.10, R-5.1 Fills in each writ the projection omits, then returns the deck by slot from
 * `top`, every slot the explorer or the table knows keeping its writ.
 */
function dealWrits(state: FeudumProjectedState, random: RandomFunction): FeudumVault['writDeck'] {
    const known = new Map<number, WritId>(
        [
            ...state.publicDeckWrits,
            ...state.players.flatMap((player) => player.deckKnowledge ?? [])
        ].map(({ slot, writId }) => [slot, writId])
    )
    const pile = shuffled(unplacedWrits(state), random)

    for (const player of state.players) {
        player.sealedCharters ??= dealCharters(pile, player.sealedCharterCount)
    }
    for (const player of state.players) {
        player.writs ??= deal(pile, player.writCount - player.sealedCharterCount)
        // R-4.4.1 The projection does not say what another seat saw.
        player.deckKnowledge ??= []
    }
    const { writDraw } = state.flow
    if (writDraw) {
        writDraw.drawn ??= deal(pile, writDraw.drawnCount)
    }

    const { top, nextBottom } = state.writDeck
    const deck = Array.from({ length: nextBottom - top }, (_, index) => {
        const slot = top + index
        return { slot, writId: known.get(slot) ?? deal(pile, 1)[0] }
    })
    assert(pile.length === 0, 'Exploration counts do not match the source')
    return deck
}

/** R-3.14.2 Public state shows which markers are immune; the vault keys each by space and role. */
function immuneMarkers(state: FeudumProjectedState): string[] {
    return Spaces.flatMap(({ id }) => {
        const { ruler, serf } = state.spaces[id]
        return [
            ...(ruler?.subjectImmune ? [immunityKey(id, 'subject')] : []),
            ...(serf?.immune ? [immunityKey(id, 'serf')] : [])
        ]
    })
}

type ConcealedSeals = Pick<
    FeudumVault,
    'sealPile' | 'scrollSeals' | 'heldSeals' | 'charterSeals' | 'immunitySeals'
>

/** R-5-H1 The seals not shown as beads go to every place public state counts, each once. */
function dealSeals(state: FeudumProjectedState, random: RandomFunction): ConcealedSeals {
    const { farmer, monk, noble } = state.guilds
    const shown = new Set<string>([
        ...state.players.flatMap((player) => player.beads),
        ...farmer.chickens.flatMap((chicken) => (chicken === null ? [] : [chicken])),
        ...monk.rosary
    ])
    const pile = shuffled(
        Seals.map((seal) => seal.id).filter((sealId) => !shown.has(sealId)),
        random
    )
    const onePerKey = (keys: readonly string[]): Record<string, SealId> =>
        Object.fromEntries(keys.map((key) => [key, deal(pile, 1)[0]]))
    const perPlayer = (count: (player: ProjectedPlayer) => number): Record<string, SealId[]> =>
        Object.fromEntries(
            state.players.map((player) => [player.playerId, deal(pile, count(player))])
        )

    const seals: ConcealedSeals = {
        sealPile: deal(pile, state.supply.sealPileCount),
        scrollSeals: onePerKey(
            ScrollSpaces.filter((space) => noble.scrolls[space.id]).map((space) => space.id)
        ),
        heldSeals: perPlayer((player) => player.sealCount),
        charterSeals: perPlayer((player) => player.sealedCharterCount),
        immunitySeals: onePerKey(immuneMarkers(state))
    }
    assert(pile.length === 0, 'Exploration counts do not match the source')
    return seals
}

/** R-1.4-H2 Each epoch's printed mix, less the landscapes shown, across its tiles still hidden. */
function dealTileLandscapes(
    state: FeudumProjectedState,
    random: RandomFunction
): Record<string, LandscapeKind> {
    const shown = state.tileLandscapes
    return Object.fromEntries(
        TileEpochs.flatMap((epoch) => {
            const tiles = RegionTiles.filter((tile) => tile.epoch === epoch)
            const unseen = [...EpochLandscapes[epoch]]
            for (const tile of tiles) {
                if (Object.hasOwn(shown, tile.id)) {
                    unseen.splice(unseen.indexOf(shown[tile.id]), 1)
                }
            }
            const hidden = tiles.filter((tile) => !Object.hasOwn(shown, tile.id))
            const landscapes = deal(shuffled(unseen, random), hidden.length)
            return hidden.map((tile, index): [TileId, LandscapeKind] => [
                tile.id,
                landscapes[index]
            ])
        })
    )
}

/** R-5.1 Only deck slots no one can place trade writs. */
function reshuffleUnknownDeckSlots(state: HydratedFeudumGameState, random: RandomFunction): void {
    const known = new Set<number>(
        [
            ...state.publicDeckWrits,
            ...state.players.flatMap((player) => player.requireDeckKnowledge())
        ].map(({ slot }) => slot)
    )
    const unknown = state.requireVault().writDeck.filter(({ slot }) => !known.has(slot))
    const writIds = shuffled(
        unknown.map(({ writId }) => writId),
        random
    )
    unknown.forEach((entry, index) => {
        entry.writId = writIds[index]
    })
}

/** R-1.4-H2 Every tile still hidden keeps its epoch's mix, in a fresh order. */
function reshuffleTileLandscapes(vault: FeudumVault, random: RandomFunction): void {
    for (const epoch of TileEpochs) {
        const tiles = RegionTiles.filter(
            (tile) => tile.epoch === epoch && Object.hasOwn(vault.tileLandscapes, tile.id)
        )
        const landscapes = shuffled(
            tiles.map((tile) => vault.tileLandscapes[tile.id]),
            random
        )
        tiles.forEach((tile, index) => {
            vault.tileLandscapes[tile.id] = landscapes[index]
        })
    }
}

export class FeudumGameExploration implements GameExploration<FeudumProjectedState> {
    /**
     * R-5.1, R-5-H1, R-1.4-H2 Host View and local branches: each hidden list in a new order from the
     * branch's own protected stream, every known slot kept. No one knows seals apart, so those
     * outside the pile stay.
     */
    createFromCanonicalState(state: FeudumProjectedState): FeudumProjectedState {
        const hydrated = new HydratedFeudumGameState(structuredClone(state))
        const vault = hydrated.requireVault()
        const { random } = hydrated.getProtectedPrng()
        reshuffleUnknownDeckSlots(hydrated, random)
        shuffle(vault.sealPile, random)
        reshuffleTileLandscapes(vault, random)
        return hydrated.dehydrate()
    }

    /**
     * R-5.1, R-5-H1, R-1.4-H2 A player or spectator's branch: everything the projection names stays,
     * and each hidden value is dealt afresh from the sampling randomness alone, within public counts.
     * Reads no history and no source vault, so sources differing only in hidden values agree.
     */
    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<FeudumProjectedState>): FeudumProjectedState {
        const sample = structuredClone(state)
        for (const player of sample.players) {
            player.hand ??= dealHand(player, random)
        }
        const writDeck = dealWrits(sample, random)
        const seals = dealSeals(sample, random)
        sample.vault = {
            writDeck,
            ...seals,
            tileLandscapes: dealTileLandscapes(sample, random)
        }
        assert(
            FeudumCanonicalStateValidator.Check(sample),
            'Exploration must produce a complete Feudum state'
        )
        return sample
    }
}
