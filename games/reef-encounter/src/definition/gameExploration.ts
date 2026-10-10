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
    screen: number
    parrotfish: number
}

export class ReefEncounterGameExploration implements GameExploration<ReefEncounterProjectedState> {
    createFromCanonicalState(state: ReefEncounterProjectedState): ReefEncounterProjectedState {
        return new HydratedReefEncounterGameState(structuredClone(state)).dehydrate()
    }

    // Deals every polyp the viewer hasn't seen at random between the hidden screens, the hidden
    // parrotfish polyps and the bag. Earlier draws can hint where some polyps are (an empty
    // bonus space meant the bag then held none of its colour), but every deal can be played on.
    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<ReefEncounterProjectedState>): ReefEncounterProjectedState {
        const sample = structuredClone(state)
        const holders = sample.players
            .filter((player) => !player.secretScreenPolyps || !player.secretParrotfishPolyps)
            .map((player) => this.hiddenHolder(sample, player))
        const unseen = this.unseenPolyps(sample)
        assert(
            unseen.length ===
                holders.reduce((total, holder) => total + holder.screen + holder.parrotfish, 0) +
                    sample.polypBag.remaining,
            'Exploration polyp count does not match the source'
        )

        shuffle(unseen, random)
        for (const holder of holders) {
            holder.player.secretScreenPolyps = this.deal(unseen, holder.screen)
            holder.player.secretParrotfishPolyps = this.deal(unseen, holder.parrotfish)
        }
        sample.polypBag.items = unseen

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
            player.secretScreenPolypCount,
            'Exploration is unavailable while the game is Concealed'
        )
        assert(
            !player.secretScreenPolyps && !player.secretParrotfishPolyps,
            'A player’s secrets are shown or hidden together'
        )
        return {
            player,
            screen: player.secretScreenPolypCount,
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
                player.knownScreenPolyps && player.knownParrotfishPolyps,
                'Exploration is unavailable while the game is Concealed'
            )
            add(player.knownScreenPolyps)
            add(player.knownParrotfishPolyps)
            add(player.consumedPolyps)
            add(player.secretScreenPolyps)
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
