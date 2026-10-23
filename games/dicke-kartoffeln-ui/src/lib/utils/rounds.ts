import { MachineState } from '@tabletop/dicke-kartoffeln'

export type RoundLabel = { number: string; name: string; short: string }

// The "Jahresübersicht": the twelve rounds of a farming year.
export const YEAR_OVERVIEW: readonly (RoundLabel & { states: readonly MachineState[] })[] = [
    { number: '1', name: 'Taking compost', short: 'Compost', states: [MachineState.TakingCompost] },
    {
        number: '2',
        name: 'Ploughing & sowing',
        short: 'Sow',
        states: [MachineState.Cultivating, MachineState.Sowing]
    },
    {
        number: '3',
        name: 'Fertilizing & spraying',
        short: 'Chemicals',
        states: [MachineState.Fertilizing, MachineState.Spraying]
    },
    {
        number: '4',
        name: 'Sunflowers',
        short: 'Sunflowers',
        states: [MachineState.GrowingSunflowers]
    },
    { number: '5', name: 'Messages', short: 'News', states: [MachineState.ReadingMessage] },
    {
        number: '6',
        name: 'Harvest & offers',
        short: 'Harvest',
        states: [MachineState.Harvesting, MachineState.RegisteringSales]
    },
    {
        number: '7',
        name: 'Market prices',
        short: 'Market',
        states: [MachineState.CalculatingMarket]
    },
    { number: '8', name: 'Sales', short: 'Sales', states: [MachineState.Selling] },
    {
        number: '9',
        name: 'Reaction of the soil',
        short: 'Soil',
        states: [MachineState.SoilReacting]
    },
    {
        number: '10',
        name: 'Using compost',
        short: 'Spread',
        states: [MachineState.SpreadingCompost]
    },
    { number: '11', name: 'Moving compost', short: 'Rot', states: [MachineState.MovingCompost] },
    { number: '12', name: 'End of the year', short: 'Bank', states: [MachineState.EndingYear] }
]

const STEP_LABELS: Partial<Record<MachineState, RoundLabel>> = {
    [MachineState.TakingCompost]: { number: '1', name: 'Taking compost', short: 'Compost' },
    [MachineState.Cultivating]: { number: '2.1', name: 'Ploughing', short: 'Plough' },
    [MachineState.Sowing]: { number: '2.2', name: 'Sowing', short: 'Sow' },
    [MachineState.Fertilizing]: { number: '3.1', name: 'Fertilizing', short: 'Fertilize' },
    [MachineState.Spraying]: { number: '3.2', name: 'Spraying poison', short: 'Spray' },
    [MachineState.GrowingSunflowers]: { number: '4', name: 'Sunflowers', short: 'Sunflowers' },
    [MachineState.ReadingMessage]: { number: '5', name: 'Messages', short: 'News' },
    [MachineState.Harvesting]: { number: '6.1', name: 'Harvest', short: 'Harvest' },
    [MachineState.RegisteringSales]: { number: '6.2', name: 'Offering potatoes', short: 'Offer' },
    [MachineState.CalculatingMarket]: { number: '7', name: 'Market prices', short: 'Market' },
    [MachineState.Selling]: { number: '8', name: 'Sales', short: 'Sales' },
    [MachineState.SoilReacting]: { number: '9', name: 'Reaction of the soil', short: 'Soil' },
    [MachineState.SpreadingCompost]: { number: '10', name: 'Using compost', short: 'Spread' },
    [MachineState.MovingCompost]: { number: '11', name: 'Moving compost', short: 'Rot' },
    [MachineState.EndingYear]: { number: '12', name: 'End of the year', short: 'Bank' }
}

export function roundLabel(state: MachineState): RoundLabel | undefined {
    return STEP_LABELS[state]
}

export type TrackRound = RoundLabel & { current: boolean; nextYear: boolean }

export function overviewIndex(state: MachineState): number {
    return YEAR_OVERVIEW.findIndex((round) => round.states.includes(state))
}

export function upcomingRounds(
    state: MachineState,
    hasNextYear: boolean,
    count: number
): TrackRound[] {
    const length = Math.min(count, YEAR_OVERVIEW.length)
    const current = overviewIndex(state)
    const lastStart = YEAR_OVERVIEW.length - length
    const start = current < 0 ? lastStart : hasNextYear ? current : Math.min(current, lastStart)
    return Array.from({ length }, (_, offset) => start + offset).map((index) => ({
        ...YEAR_OVERVIEW[index % YEAR_OVERVIEW.length],
        current: index === current,
        nextYear: index >= YEAR_OVERVIEW.length
    }))
}

export enum CompostPileId {
    Fresh = 'Fresh',
    Ripe = 'Ripe'
}

// Worms reach compost pile 2 in round 11 and are spread from it in round 10 of the next year.
export function compostUseYear(state: MachineState, year: number, pile: CompostPileId): number {
    const index = overviewIndex(state)
    if (pile === CompostPileId.Ripe) {
        return index <= overviewIndex(MachineState.SpreadingCompost) ? year : year + 1
    }
    return index <= overviewIndex(MachineState.MovingCompost) ? year + 1 : year + 2
}

const BEFORE_SOWING_DECIDED: readonly MachineState[] = [
    MachineState.TakingCompost,
    MachineState.Cultivating,
    MachineState.Sowing
]

export function sowingDecided(state: MachineState): boolean {
    return !BEFORE_SOWING_DECIDED.includes(state)
}
