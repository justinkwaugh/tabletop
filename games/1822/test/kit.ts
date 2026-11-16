import { titleTestKit, type Table as TitleTable } from '../../../libs/18xx/test/titleTestKit.js'
import { major1822, minor1822 } from '../src/companies.js'
import { Definition } from '../src/definition/gameDefinition.js'
import { Map1822 } from '../src/map.js'
import { TrainRules1822 } from '../src/operating.js'
import type { HydratedState1822, State1822 } from '../src/state.js'
import { StationRules1822 } from '../src/stations.js'
import { Market1822 } from '../src/stockMarket.js'
import { TileSet1822 } from '../src/tiles.js'
import { TrackRules1822 } from '../src/track.js'
import { TrainDepot1822 } from '../src/trains.js'

export type Table = TitleTable<State1822, HydratedState1822>

export const kit = titleTestKit<State1822, HydratedState1822>({
    definition: Definition,
    map: Map1822,
    tileSet: TileSet1822,
    market: Market1822,
    trackRules: TrackRules1822,
    stationRules: StationRules1822,
    trainRules: TrainRules1822,
    depot: TrainDepot1822,
    privates: [],
    home: (companyId) => (major1822(companyId)?.home ?? minor1822(companyId)?.home)?.locationId
})

/** The seeds a spec deals a random setup over. */
export const SetupSeeds = Array.from({ length: 12 }, (_, index) => index + 1)

/**
 * A table standing as prepared before its first move: in its second stock round, so that one
 * with nothing sold does not end the game (§1.3.1), and in the phase given.
 */
export function prepared(
    prepare: (state: State1822, players: string[]) => void,
    {
        config,
        seed = 3,
        phaseId
    }: { config?: Record<string, boolean | string>; seed?: number; phaseId?: string } = {}
): Table {
    const game = kit.table(4, seed, config)
    const state = structuredClone(game.state)
    state.stockRound.number = 2
    if (phaseId) state.phaseId = phaseId
    prepare(state, state.turnManager.turnOrder)
    game.state = state
    return game
}

/** The certificate in a bidding box. */
export function boxLot(state: Pick<State1822, 'bidBoxes'>, boxId: string): string | undefined {
    return state.bidBoxes.boxes.find((box) => box.boxId === boxId)?.lotId
}
