import { shuffle, type GameExploration, type RandomFunction } from '@tabletop/common'
import { RegionTiles, TileEpochs } from '../data/regionTiles.js'
import { HydratedFeudumGameState, type FeudumProjectedState } from '../model/gameState.js'
import type { FeudumVault } from '../model/vault.js'

/**
 * R-5-H1 No `createFromProjectedState`: a seal returned from a bead keeps an identity the table saw,
 * and where it can lie afterwards turns on concealed moves no Action records.
 */
export class FeudumGameExploration implements GameExploration<FeudumProjectedState> {
    /** R-5.1, R-5-H1, R-1.4-H2 Every known position kept; no one knows seals apart outside the pile. */
    createFromCanonicalState(state: FeudumProjectedState): FeudumProjectedState {
        const hydrated = new HydratedFeudumGameState(structuredClone(state))
        const vault = hydrated.requireVault()
        const { random } = hydrated.getProtectedPrng()
        FeudumGameExploration.reshuffleUnknownDeckSlots(hydrated, random)
        shuffle(vault.sealPile, random)
        FeudumGameExploration.reshuffleTileLandscapes(vault, random)
        return hydrated.dehydrate()
    }

    private static shuffled<T>(items: readonly T[], random: RandomFunction): T[] {
        const copy = [...items]
        shuffle(copy, random)
        return copy
    }

    /** R-5.1 Only deck slots no one can place trade writs. */
    private static reshuffleUnknownDeckSlots(
        state: HydratedFeudumGameState,
        random: RandomFunction
    ): void {
        const known = new Set<number>(
            [
                ...state.publicDeckWrits,
                ...state.players.flatMap((player) => player.requireDeckKnowledge())
            ].map(({ slot }) => slot)
        )
        const unknown = state.requireVault().writDeck.filter(({ slot }) => !known.has(slot))
        const writIds = FeudumGameExploration.shuffled(
            unknown.map(({ writId }) => writId),
            random
        )
        unknown.forEach((entry, index) => {
            entry.writId = writIds[index]
        })
    }

    /** R-1.4-H2 Each epoch keeps its mix. */
    private static reshuffleTileLandscapes(vault: FeudumVault, random: RandomFunction): void {
        for (const epoch of TileEpochs) {
            const tiles = RegionTiles.filter(
                (tile) => tile.epoch === epoch && Object.hasOwn(vault.tileLandscapes, tile.id)
            )
            const landscapes = FeudumGameExploration.shuffled(
                tiles.map((tile) => vault.tileLandscapes[tile.id]),
                random
            )
            tiles.forEach((tile, index) => {
                vault.tileLandscapes[tile.id] = landscapes[index]
            })
        }
    }
}
