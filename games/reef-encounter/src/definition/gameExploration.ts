import {
    assert,
    assertExists,
    type ExplorationPopulation,
    type GameExploration,
    shuffle
} from '@tabletop/common'
import { CoralColor, CoralColors, type CoralCounts, coralCounts } from '../components/colors.js'
import {
    HydratedReefEncounterGameState,
    isParrotfishFed,
    ReefEncounterGameStateValidator,
    type ReefEncounterProjectedState
} from '../model/gameState.js'
import { PolypsPerColor } from './initializer.js'

type ProjectedPlayer = ReefEncounterProjectedState['players'][number]

interface HiddenHolder {
    player: ProjectedPlayer
    supply: number
    parrotfish: number
}

export class ReefEncounterGameExploration implements GameExploration<ReefEncounterProjectedState> {
    createFromCanonicalState(state: ReefEncounterProjectedState): ReefEncounterProjectedState {
        return new HydratedReefEncounterGameState(structuredClone(state)).dehydrate()
    }

    // Deals every polyp the viewer hasn't seen at random between the hidden supplies, the hidden
    // parrotfish polyps and the bag, keeping out of the bag any colour a search failed to find.
    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<ReefEncounterProjectedState>): ReefEncounterProjectedState {
        const sample = structuredClone(state)
        const holders = sample.players
            .filter((player) => !player.secretSupplyPolyps || !player.secretParrotfishPolyps)
            .map((player) => this.hiddenHolder(sample, player))
        const unseen = this.unseenPolyps(sample)
        assert(
            unseen.length ===
                holders.reduce((total, holder) => total + holder.supply + holder.parrotfish, 0) +
                    sample.polypBag.remaining,
            'Exploration polyp count does not match the source'
        )

        const missing = new Set(sample.colorsMissingFromBag)
        const mayBeInBag = unseen.filter((color) => !missing.has(color))
        shuffle(mayBeInBag, random)
        const bag = mayBeInBag.splice(0, sample.polypBag.remaining)
        assert(bag.length === sample.polypBag.remaining, 'Too few polyps may be in the bag')
        const held = [...unseen.filter((color) => missing.has(color)), ...mayBeInBag]
        shuffle(held, random)
        for (const holder of holders) {
            holder.player.secretSupplyPolyps = this.deal(held, holder.supply)
            holder.player.secretParrotfishPolyps = this.deal(held, holder.parrotfish)
        }
        sample.polypBag.items = bag

        const result = new HydratedReefEncounterGameState(sample).dehydrate()
        assert(
            ReefEncounterGameStateValidator.Check(result),
            'Exploration must produce a complete Reef Encounter state'
        )
        return result
    }

    private hiddenHolder(
        state: ReefEncounterProjectedState,
        player: ProjectedPlayer
    ): HiddenHolder {
        assertExists(
            player.secretSupplyPolypCount,
            'Exploration is unavailable while the game is Concealed'
        )
        assert(
            !player.secretSupplyPolyps && !player.secretParrotfishPolyps,
            'A player’s secrets are shown or hidden together'
        )
        return {
            player,
            supply: player.secretSupplyPolypCount,
            parrotfish: isParrotfishFed(state, player.playerId) ? 1 : 0
        }
    }

    private unseenPolyps(state: ReefEncounterProjectedState): CoralColor[] {
        const seen = coralCounts()
        const add = (counts: CoralCounts | undefined) => {
            for (const color of CoralColors) {
                seen[color] += counts?.[color] ?? 0
            }
        }
        const addEach = (polyps: readonly CoralColor[]) => {
            for (const color of polyps) {
                seen[color] += 1
            }
        }
        addEach(state.reefs.flatMap((reef) => reef.polyps.map((polyp) => polyp.color)))
        addEach(state.openSea.flatMap((space) => space.polyps))
        add(state.bonusPolyps)
        for (const player of state.players) {
            assertExists(
                player.knownSupplyPolyps && player.knownParrotfishPolyps,
                'Exploration is unavailable while the game is Concealed'
            )
            add(player.knownSupplyPolyps)
            add(player.knownParrotfishPolyps)
            add(player.consumedPolyps)
            add(player.secretSupplyPolyps)
            add(player.secretParrotfishPolyps)
        }
        return CoralColors.flatMap((color) => {
            const unseen = PolypsPerColor - seen[color]
            assert(unseen >= 0, `More ${color} polyps are in sight than exist`)
            return Array.from({ length: unseen }, () => color)
        })
    }

    private deal(polyps: CoralColor[], count: number): CoralCounts {
        const counts = coralCounts()
        for (const color of polyps.splice(0, count)) {
            counts[color] += 1
        }
        return counts
    }
}
