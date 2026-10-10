export enum Scenario {
    December2 = 'December2',
    December1 = 'December1'
}

export interface RoundDefinition {
    day: 1 | 2
    hour?: number
    night: boolean
}

function dayRounds(day: 1 | 2): RoundDefinition[] {
    return Array.from({ length: 10 }, (_, index) => ({ day, hour: 7 + index, night: false }))
}

const NIGHT: RoundDefinition = { day: 1, night: true }

export const ROUNDS: Record<Scenario, RoundDefinition[]> = {
    [Scenario.December2]: dayRounds(2),
    [Scenario.December1]: [...dayRounds(1), NIGHT, ...dayRounds(2)]
}

const FRENCH_ARRIVALS: Record<string, { day: 1 | 2; hour: number }> = {
    bernadotte: { day: 1, hour: 11 },
    davout: { day: 2, hour: 8 }
}

export function roundDefinition(scenario: Scenario, round: number): RoundDefinition {
    const definition = ROUNDS[scenario][round]
    if (!definition) {
        throw Error(`Scenario ${scenario} has no round ${round}`)
    }
    return definition
}

export function isLastRound(scenario: Scenario, round: number): boolean {
    return round === ROUNDS[scenario].length - 1
}

export function frenchArrivalRound(scenario: Scenario, commanderId: string): number {
    const arrival = FRENCH_ARRIVALS[commanderId]
    if (!arrival) {
        throw Error(`${commanderId} is not a French reinforcement`)
    }
    const index = ROUNDS[scenario].findIndex(
        (round) => !round.night && round.day === arrival.day && round.hour === arrival.hour
    )
    return Math.max(index, 0)
}

export function roundLabel(definition: RoundDefinition, withDay = false): string {
    const day = withDay ? `${definition.day} December · ` : ''
    if (definition.night || definition.hour === undefined) {
        return `${day}Night`
    }
    const hour = definition.hour > 12 ? definition.hour - 12 : definition.hour
    return `${day}${hour}:00${definition.hour >= 12 ? 'PM' : 'AM'}`
}
