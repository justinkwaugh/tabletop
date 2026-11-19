import { assertExists } from '@tabletop/common'
import { PhaseTable, TrainDepot, type TrainInventory } from '@tabletop/18xx'

export const TwoPlusId = '2+'
export const ThreePlusId = '3+'
export const FourPlusId = '4+'
export const FivePlusId = '5+'
export const SixByTwoId = '6x2'

const plus = (cities: number) => ({ measure: 'cities-and-offboards', maximum: cities }) as const

/**
 * The train deck: + trains count cities and off-boards, any number of towns besides; the 6x2
 * counts six stops of any kind and doubles their value (Trains at a Glance).
 */
export const TrainDepotRoyalGorge = new TrainDepot({
    id: '18royalgorge',
    trains: [
        { id: TwoPlusId, name: '2+', price: 80, distance: plus(2), rustsOn: FourPlusId },
        { id: ThreePlusId, name: '3+', price: 180, distance: plus(3), rustsOn: SixByTwoId },
        { id: FourPlusId, name: '4+', price: 400, distance: plus(4) },
        { id: FivePlusId, name: '5+', price: 500, distance: plus(5) },
        {
            id: SixByTwoId,
            name: '6x2',
            price: 650,
            distance: { measure: 'revenue-centers', maximum: 6 }
        }
    ],
    supply: [
        { definitionId: TwoPlusId, count: 4 },
        { definitionId: ThreePlusId, count: 4 },
        { definitionId: FourPlusId, count: 3 },
        { definitionId: FivePlusId, count: 2 },
        { definitionId: SixByTwoId, count: 'unlimited' }
    ]
})

/** What a rusted train's company receives from the bank (Rusting Events). */
export const SalvageRoyalGorge: Readonly<Record<string, number>> = {
    [TwoPlusId]: 20,
    [ThreePlusId]: 45
}

/** The trains a 6x2 doubles the stops of. */
export function revenueMultiplier(definitionId: string): number {
    return definitionId === SixByTwoId ? 2 : 1
}

export const YellowPhaseId = 'yellow'
export const GreenPhaseId = 'green'
export const TreatyPhaseId = 'treaty'
export const GreenFourPhaseId = 'green-4'
export const BrownPhaseId = 'brown'
export const BrownFivePhaseId = 'brown-5'
export const SilverPhaseId = 'silver'
export const SilverSixPhaseId = 'silver-6'

/** The rulebook's colour phases, which set tiles, steel, pars, gold and private sales. */
export type ColorPhase = 'Yellow' | 'Green' | 'Brown' | 'Silver'

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const silver = ['yellow', 'green', 'brown', 'gray']
const phase = (id: string, startedBy: string[], tileColors: string[]) => ({
    id,
    startedBy,
    tileColors,
    operatingRounds: 2,
    trainLimit: 2
})

/**
 * Every card of the deck with an effect is a phase, as the family runs rusting, closures and
 * title events only as a phase begins; the colour phases are the rulebook's (Phase Changes).
 */
export const PhasesRoyalGorge = new PhaseTable(
    [
        phase(YellowPhaseId, [], yellow),
        phase(GreenPhaseId, [], green),
        phase(TreatyPhaseId, [], green),
        phase(GreenFourPhaseId, [FourPlusId], green),
        phase(BrownPhaseId, [], brown),
        phase(BrownFivePhaseId, [], brown),
        phase(SilverPhaseId, [], silver),
        phase(SilverSixPhaseId, [SixByTwoId], silver)
    ],
    TrainDepotRoyalGorge
)

const ColorPhases: Readonly<Record<string, ColorPhase>> = {
    [YellowPhaseId]: 'Yellow',
    [GreenPhaseId]: 'Green',
    [TreatyPhaseId]: 'Green',
    [GreenFourPhaseId]: 'Green',
    [BrownPhaseId]: 'Brown',
    [BrownFivePhaseId]: 'Brown',
    [SilverPhaseId]: 'Silver',
    [SilverSixPhaseId]: 'Silver'
}

export function colorPhase(phaseId: string): ColorPhase {
    const color = ColorPhases[phaseId]
    assertExists(color, `Unknown 18RoyalGorge phase ${phaseId}`)
    return color
}

/**
 * The deck's cards under each train: the phase a train starts as it leaves the depot, bought or
 * exported, by how many of its rank were still there (RT-6). Green lies under the last 2+, the
 * Treaty of Boston under the second 3+, Brown under the last 4+, the private closures under the
 * first 5+ and Silver under the last; the 2+ rust with the first 4+ and the 3+ with the first 6x2.
 */
const Cards: readonly { definitionId: string; remaining: number; phaseId: string }[] = [
    { definitionId: TwoPlusId, remaining: 1, phaseId: GreenPhaseId },
    { definitionId: ThreePlusId, remaining: 3, phaseId: TreatyPhaseId },
    { definitionId: FourPlusId, remaining: 3, phaseId: GreenFourPhaseId },
    { definitionId: FourPlusId, remaining: 1, phaseId: BrownPhaseId },
    { definitionId: FivePlusId, remaining: 2, phaseId: BrownFivePhaseId },
    { definitionId: FivePlusId, remaining: 1, phaseId: SilverPhaseId }
]

/** The phase once the next train of the rank leaves the depot. */
export function phaseAfterDeparture(
    state: { phaseId: string; trainInventory: TrainInventory },
    definitionId: string
): string {
    const remaining = TrainDepotRoyalGorge.remaining(state.trainInventory, definitionId)
    const card =
        definitionId === SixByTwoId
            ? SilverSixPhaseId
            : Cards.find(
                  (card) => card.definitionId === definitionId && card.remaining === remaining
              )?.phaseId
    return card && !PhasesRoyalGorge.isAtLeast(state.phaseId, card) ? card : state.phaseId
}

/**
 * The trains a set of operating rounds exports as it ends: every 2+ while one is next, otherwise
 * the next train, 6x2 trains included, every set (RT-7).
 */
export function trainsExportedRoyalGorge(inventory: TrainInventory): string[] {
    const next = TrainDepotRoyalGorge.nextDefinitionId(inventory)
    if (!next) return []
    if (next !== TwoPlusId) return [next]
    const remaining = TrainDepotRoyalGorge.remaining(inventory, TwoPlusId)
    return Array.from({ length: remaining === 'unlimited' ? 0 : remaining }, () => TwoPlusId)
}
