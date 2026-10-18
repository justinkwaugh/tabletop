import { AnomalyChallenge } from './anomalyCatalog.js'
import { TechField } from './techFields.js'
import { WorldClass } from './worldTypes.js'

// Rulebook 4.2 and 1.16. Events without a challenge act when drawn; the others are placed at a
// base and resolved like anomalies for their IP, acting every turn or when the next event is
// drawn while they are still unresolved. Transcribed from the event tiles in the Vassal module:
// its deck of 20, and Unrest, whose tile is in the module's art but not its deck.

export enum EventTiming {
    // Acts once, when drawn.
    Drawn = 'Drawn',
    // Acts at the end of every turn while unresolved.
    EachTurn = 'EachTurn',
    // Acts while unresolved, where the rule it changes applies.
    WhileUnresolved = 'WhileUnresolved',
    // Acts if still unresolved when the next event is drawn, then leaves.
    NextEvent = 'NextEvent'
}

export enum EventEffectKind {
    Breakthrough = 'Breakthrough',
    ColonialRush = 'ColonialRush',
    Homesteaders = 'Homesteaders',
    LoseInfluence = 'LoseInfluence',
    LoseCash = 'LoseCash',
    LoseInfluenceAndCash = 'LoseInfluenceAndCash',
    DestroySettlements = 'DestroySettlements',
    HalveBases = 'HalveBases',
    ReplaceWorld = 'ReplaceWorld',
    EarthProduction = 'EarthProduction',
    NoProductionOrGrowth = 'NoProductionOrGrowth',
    NoTradeGoods = 'NoTradeGoods',
    ExplorersMalfunction = 'ExplorersMalfunction',
    None = 'None'
}

export type EventEffect =
    | { kind: EventEffectKind.Breakthrough; field: TechField }
    | { kind: EventEffectKind.ColonialRush; settlements: number }
    | { kind: EventEffectKind.Homesteaders; settlements: number }
    | { kind: EventEffectKind.LoseInfluence; influence: number }
    | { kind: EventEffectKind.LoseCash; cash: number }
    | { kind: EventEffectKind.LoseInfluenceAndCash; influence: number; cash: number }
    | { kind: EventEffectKind.DestroySettlements; roll: number; range: number }
    | { kind: EventEffectKind.HalveBases }
    | { kind: EventEffectKind.ReplaceWorld; worldClass: WorldClass }
    | { kind: EventEffectKind.EarthProduction; markers: number }
    | { kind: EventEffectKind.NoProductionOrGrowth }
    | { kind: EventEffectKind.NoTradeGoods }
    | { kind: EventEffectKind.ExplorersMalfunction; range: number }
    | { kind: EventEffectKind.None }

export interface EventChallenge {
    science?: number
    combat?: number
}

export interface EventDefinition {
    id: string
    name: string
    challenge?: EventChallenge
    influence: number
    timing: EventTiming
    effect: EventEffect
}

function event(
    id: string,
    name: string,
    timing: EventTiming,
    effect: EventEffect,
    challenge?: EventChallenge,
    influence = 0
): EventDefinition {
    return { id, name, timing, effect, challenge, influence }
}

const { Drawn, EachTurn, WhileUnresolved, NextEvent } = EventTiming
const K = EventEffectKind

export const EVENTS: readonly EventDefinition[] = [
    event(
        'apprehend-renegade',
        'Apprehend Renegade',
        EachTurn,
        { kind: K.LoseInfluence, influence: 1 },
        { combat: 4 },
        4
    ),
    event('breakthrough-biology', 'Breakthrough', Drawn, {
        kind: K.Breakthrough,
        field: TechField.Biology
    }),
    event('breakthrough-engineering', 'Breakthrough', Drawn, {
        kind: K.Breakthrough,
        field: TechField.Engineering
    }),
    event('breakthrough-physics', 'Breakthrough', Drawn, {
        kind: K.Breakthrough,
        field: TechField.Physics
    }),
    event(
        'collapsing-biosphere',
        'Collapsing Biosphere',
        NextEvent,
        { kind: K.ReplaceWorld, worldClass: WorldClass.K },
        { science: 8 },
        6
    ),
    event('colonial-rush', 'Colonial Rush', Drawn, { kind: K.ColonialRush, settlements: 1 }),
    event(
        'contagion',
        'Contagion',
        EachTurn,
        { kind: K.DestroySettlements, roll: 3, range: 0 },
        { science: 3 },
        4
    ),
    event(
        'first-contact',
        'First Contact',
        WhileUnresolved,
        { kind: K.EarthProduction, markers: 1 },
        { science: 30 },
        20
    ),
    event('homesteaders', 'Homesteaders', Drawn, { kind: K.Homesteaders, settlements: 2 }),
    event('hostile-probe', 'Hostile Probe', NextEvent, { kind: K.HalveBases }, { combat: 15 }, 10),
    event('incoming-comet', 'Incoming Comet', NextEvent, { kind: K.HalveBases }, { combat: 6 }, 5),
    event(
        'infectious-parasites',
        'Infectious Parasites',
        EachTurn,
        { kind: K.DestroySettlements, roll: 2, range: 2 },
        { science: 5 },
        5
    ),
    event(
        'irradiated-atmosphere',
        'Irradiated Atmosphere',
        NextEvent,
        { kind: K.HalveBases },
        { science: 6 },
        5
    ),
    event(
        'pirate-raids-3',
        'Pirate Raids',
        EachTurn,
        { kind: K.LoseCash, cash: 1 },
        { combat: 3 },
        3
    ),
    event(
        'pirate-raids-5',
        'Pirate Raids',
        EachTurn,
        { kind: K.LoseCash, cash: 1 },
        { combat: 5 },
        5
    ),
    event(
        'prisoner-revolt',
        'Prisoner Revolt',
        NextEvent,
        { kind: K.LoseInfluenceAndCash, influence: 3, cash: 3 },
        { combat: 2 },
        2
    ),
    event('smugglers', 'Smugglers', WhileUnresolved, { kind: K.NoTradeGoods }, { combat: 8 }, 5),
    event('stellar-chart', 'Stellar Chart', WhileUnresolved, { kind: K.None }, { science: 4 }, 3),
    event(
        'supervolcano',
        'Supervolcano',
        NextEvent,
        { kind: K.ReplaceWorld, worldClass: WorldClass.A },
        { science: 7 },
        6
    ),
    event('unrest', 'Unrest', WhileUnresolved, { kind: K.NoProductionOrGrowth }, { combat: 3 }, 3),
    event(
        'ai-sentient-emergence',
        'AI Sentient Emergence',
        NextEvent,
        { kind: K.ExplorersMalfunction, range: 4 },
        { science: 7, combat: 9 },
        6
    )
]

export function eventDefinition(eventId: string): EventDefinition {
    const definition = EVENTS.find((candidate) => candidate.id === eventId)
    if (!definition) {
        throw new Error(`Unknown event ${eventId}`)
    }
    return definition
}

export function printedEventDifficulty(
    eventId: string,
    challenge: AnomalyChallenge
): number | undefined {
    const printed = eventDefinition(eventId).challenge
    return challenge === AnomalyChallenge.Science ? printed?.science : printed?.combat
}

export function eventChallenges(eventId: string): AnomalyChallenge[] {
    return Object.values(AnomalyChallenge).filter(
        (challenge) => printedEventDifficulty(eventId, challenge) !== undefined
    )
}
