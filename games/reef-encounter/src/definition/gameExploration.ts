import {
    assert,
    assertExists,
    type ExplorationPopulation,
    type GameExploration,
    type RandomFunction,
    shuffle
} from '@tabletop/common'
import { CoralColor, CoralColors, type CoralCounts, coralCounts } from '../components/colors.js'
import {
    HydratedReefEncounterGameState,
    isParrotfishFed,
    ReefEncounterGameStateValidator,
    type ReefEncounterProjectedState
} from '../model/gameState.js'
import { ShrimpsPerPlayer } from '../model/playerState.js'
import { LarvaCubesPerColor, PolypsPerColor } from './initializer.js'

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
    // In a Concealed game the other players' totals are hidden too, so their larva cubes,
    // shrimps and polyps are sampled within what everyone can see.
    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<ReefEncounterProjectedState>): ReefEncounterProjectedState {
        const sample = structuredClone(state)
        const concealed = sample.players.filter((player) => !player.knownSupplyPolyps)
        const holders = sample.players
            .filter((player) => player.knownSupplyPolyps)
            .filter((player) => !player.secretSupplyPolyps || !player.secretParrotfishPolyps)
            .map((player) => this.hiddenHolder(sample, player))
        const unseen = this.unseenPolyps(sample)
        const dealtToHolders = holders.reduce(
            (total, holder) => total + holder.supply + holder.parrotfish,
            0
        )
        assert(
            concealed.length > 0 || unseen.length === dealtToHolders + sample.polypBag.remaining,
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
        this.sampleConcealed(sample, concealed, held, random)

        const result = new HydratedReefEncounterGameState(sample).dehydrate()
        assert(
            ReefEncounterGameStateValidator.Check(result),
            'Exploration must produce a complete Reef Encounter state'
        )
        return result
    }

    // The larva cubes no one can see are shared out among the concealed players, and so are the
    // polyps left once the bag is filled: one into each fed parrotfish, one more for each shrimp
    // it may have eaten, and the rest into the supplies, as evenly as they go.
    private sampleConcealed(
        state: ReefEncounterProjectedState,
        players: ProjectedPlayer[],
        polyps: CoralColor[],
        random: RandomFunction
    ) {
        if (players.length === 0) {
            assert(polyps.length === 0, 'Exploration polyp count does not match the source')
            return
        }
        const cubes = CoralColors.flatMap((color) => {
            const inSight =
                state.larvaCubeSupply[color] +
                state.openSea.filter((space) => space.larvaColor === color && space.hasLarvaCube)
                    .length +
                state.players.reduce(
                    (total, player) => total + (player.larvaCubes?.[color] ?? 0),
                    0
                )
            const unseen = LarvaCubesPerColor - inSight
            assert(unseen >= 0, `More ${color} larva cubes are in sight than exist`)
            return Array.from({ length: unseen }, () => color)
        })
        shuffle(cubes, random)
        const supplies = players.map((): CoralColor[] => [])
        for (const player of players) {
            player.larvaCubes = coralCounts()
            const onReefs = state.shrimps.filter(
                (shrimp) => shrimp.playerId === player.playerId
            ).length
            const unplaced = ShrimpsPerPlayer - onReefs - (player.shrimpOnOpenSea ? 1 : 0)
            const eaten = player.shrimpOnOpenSea
                ? Math.floor(random() * (Math.min(unplaced, ShrimpsPerPlayer - 2) + 1))
                : 0
            player.shrimpsInParrotfish = eaten
            player.shrimpsInSupply = unplaced - eaten
            const fed = isParrotfishFed(state, player.playerId) ? 1 : 0
            const meals = (player.shrimpOnOpenSea ? 1 : 0) + eaten
            player.secretParrotfishPolyps = this.deal(polyps, fed)
            player.knownParrotfishPolyps = this.deal(polyps, Math.min(meals, polyps.length))
            player.knownSupplyPolyps = coralCounts()
        }
        cubes.forEach((color, index) => {
            const player = players[index % players.length]
            assertExists(player.larvaCubes, 'Concealed larva cubes are sampled above')
            player.larvaCubes[color] += 1
        })
        polyps.forEach((color, index) => supplies[index % players.length].push(color))
        players.forEach((player, index) => {
            const supply = supplies[index]
            player.secretSupplyPolypCount = supply.length
            player.secretSupplyPolyps = this.deal(supply, supply.length)
        })
    }

    private hiddenHolder(
        state: ReefEncounterProjectedState,
        player: ProjectedPlayer
    ): HiddenHolder {
        assertExists(
            player.secretSupplyPolypCount,
            'A player whose supply is open shows how many secret polyps it holds'
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
