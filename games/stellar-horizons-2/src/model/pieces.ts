import * as Type from 'typebox'
import { Visibility } from '@tabletop/common'
import { AnomalyChallenge } from '../components/anomalyCatalog.js'
import { CardDeck } from '../components/cards.js'
import { TechField } from '../components/techFields.js'
import { TradeGood } from '../components/tradeGoods.js'
import { WorldSide } from '../components/worlds.js'

export type WorldPlacement = Type.Static<typeof WorldPlacement>
export const WorldPlacement = Type.Object({
    tileId: Type.String(),
    side: Type.Enum(WorldSide)
})

export type SystemState = Type.Static<typeof SystemState>
export const SystemState = Type.Object({
    systemId: Type.String(),
    explorationMarker: Type.Number(),
    worlds: Type.Array(WorldPlacement),
    anomaly: Type.Optional(Type.String()),
    anomalyResolved: Type.Optional(Type.Boolean()),
    demand: Type.Optional(Type.Enum(TradeGood)),
    // Starports (fleet improvement II) let a system hold a second marker.
    secondDemand: Type.Optional(Type.Enum(TradeGood))
})

export type ShipState = Type.Static<typeof ShipState>
export const ShipState = Type.Object({
    shipId: Type.String(),
    playerId: Type.String(),
    systemId: Type.String(),
    transit: Type.Number(),
    damage: Type.Number(),
    settlements: Type.Number(),
    goods: Type.Array(Type.Enum(TradeGood)),
    loadedFromBase: Type.Boolean(),
    explored: Type.Boolean()
})

// What a base produces in the campaign's base production (rulebook 4.4): cash or one tech type.
export const CASH_PRODUCTION = 'Cash'
export type Production = Type.Static<typeof Production>
export const Production = Type.Union([Type.Literal(CASH_PRODUCTION), Type.Enum(TechField)])

export type Base = Type.Static<typeof Base>
export const Base = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    settlements: Type.Number(),
    spent: Type.Number(),
    cloned: Type.Boolean(),
    production: Type.Optional(Production),
    goods: Type.Array(Type.Enum(TradeGood)),
    // Goods taken in this turn, against the base's assignment limit (rulebook 4.5).
    goodsReceived: Type.Number()
})

export function baseKey(playerId: string, systemId: string): string {
    return `${playerId}:${systemId}`
}

export type TechPools = Type.Static<typeof TechPools>
export const TechPools = Type.Object({
    [TechField.Biology]: Type.Array(Type.Number()),
    [TechField.Physics]: Type.Array(Type.Number()),
    [TechField.Engineering]: Type.Array(Type.Number())
})

export enum MarkerReason {
    Exploration = 'Exploration',
    Loss = 'Loss',
    Research = 'Research'
}

export enum OperationKind {
    Mining = 'Mining',
    Research = 'Research'
}

// A mining or research action this turn (rulebook 1.17), kept for the once-per-system limit and
// the Syndicate's take.
export type Operation = Type.Static<typeof Operation>
export const Operation = Type.Object({
    shipId: Type.String(),
    systemId: Type.String(),
    kind: Type.Enum(OperationKind)
})

export type EarnedMarkers = Type.Static<typeof EarnedMarkers>
export const EarnedMarkers = Type.Object({
    shipId: Type.String(),
    systemId: Type.String(),
    field: Type.Enum(TechField),
    count: Type.Number(),
    reason: Type.Enum(MarkerReason)
})

export type PendingSurvey = Type.Static<typeof PendingSurvey>
export const PendingSurvey = Type.Object({
    shipId: Type.String(),
    systemId: Type.String()
})

export type PendingAnomalyAttempt = Type.Static<typeof PendingAnomalyAttempt>
export const PendingAnomalyAttempt = Type.Object({
    systemId: Type.String(),
    anomalyId: Type.String(),
    shipIds: Type.Array(Type.String()),
    pactId: Type.Optional(Type.String())
})

// Settlements an anomaly's reward gives, waiting to be placed (rulebook 1.16).
export type SettlementReward = Type.Static<typeof SettlementReward>
export const SettlementReward = Type.Object({
    playerId: Type.String(),
    anomalyId: Type.String(),
    systemId: Type.String(),
    settlements: Type.Number()
})

// Goods an anomaly's reward gives, waiting to be placed (rulebook 1.16).
export type GoodsReward = Type.Static<typeof GoodsReward>
export const GoodsReward = Type.Object({
    playerId: Type.String(),
    anomalyId: Type.String(),
    systemId: Type.String(),
    good: Type.Enum(TradeGood),
    count: Type.Number()
})

// Demand markers drawn for a system, one to be kept (rulebook 1.9).
// Where play goes on once a demand marker is kept: the trading turn, the surveys, or the next
// step after an anomaly attempt.
export enum DemandResume {
    Trading = 'Trading',
    Surveys = 'Surveys',
    Anomaly = 'Anomaly'
}

export type DemandDraw = Type.Static<typeof DemandDraw>
export const DemandDraw = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    drawn: Type.Array(Type.Enum(TradeGood)),
    // How many of those drawn are still to be kept: 2 with Starports.
    keep: Type.Number()
})

// An event challenge on the map (rulebook 4.2).
export type ActiveEvent = Type.Static<typeof ActiveEvent>
export const ActiveEvent = Type.Object({
    eventId: Type.String(),
    systemId: Type.String()
})

export type EventPlacement = Type.Static<typeof EventPlacement>
export const EventPlacement = Type.Object({
    eventId: Type.String(),
    playerId: Type.String()
})

export type PendingEventAttempt = Type.Static<typeof PendingEventAttempt>
export const PendingEventAttempt = Type.Object({
    eventId: Type.String(),
    systemId: Type.String(),
    challenge: Type.Enum(AnomalyChallenge),
    shipIds: Type.Array(Type.String()),
    pactId: Type.Optional(Type.String())
})

// Rulebook 1.16's joint resolution, negotiated with Common Actions (see model/pacts.ts).
export enum PactTargetKind {
    Anomaly = 'Anomaly',
    Event = 'Event'
}

export type PactShare = Type.Static<typeof PactShare>
export const PactShare = Type.Object({
    influence: Type.Number(),
    cash: Type.Number(),
    markers: Type.Number(),
    settlements: Type.Number(),
    goods: Type.Number(),
    // The card an anomaly gives, 1 for the partner who earns it.
    cards: Type.Number()
})

export type PactTerms = Type.Static<typeof PactTerms>
export const PactTerms = Type.Object({
    targetKind: Type.Enum(PactTargetKind),
    targetId: Type.String(),
    challenge: Type.Enum(AnomalyChallenge),
    partnerIds: Type.Array(Type.String()),
    pledges: Type.Record(Type.String(), Type.Array(Type.String())),
    shares: Type.Record(Type.String(), PactShare),
    keeperId: Type.Optional(Type.String())
})

export type Pact = Type.Static<typeof Pact>
export const Pact = Type.Object({
    id: Type.String(),
    systemId: Type.String(),
    terms: PactTerms,
    proposerId: Type.String(),
    revision: Type.Number(),
    acceptedIds: Type.Array(Type.String()),
    agreed: Type.Boolean()
})

// A ship's place and strength for each challenge as the exploration phase began: what the other
// Players see of it when it is pledged (docs/parallel-spans.md, Common Actions rule 5).
export type PledgeableShip = Type.Static<typeof PledgeableShip>
export const PledgeableShip = Type.Object({
    playerId: Type.String(),
    shipId: Type.String(),
    systemId: Type.String(),
    science: Type.Number(),
    combat: Type.Number()
})

// A survey's drawn worlds waiting for the surveyor: one for an empty slot (two with Planetary
// Surveys), or a replacement for a smaller world in a full system.
export type SurveyWorldChoice = Type.Static<typeof SurveyWorldChoice>
export const SurveyWorldChoice = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    drawnTileIds: Type.Array(Type.String()),
    fillsSlot: Type.Boolean()
})

export type TerraformTarget = Type.Static<typeof TerraformTarget>
export const TerraformTarget = Type.Object({
    systemId: Type.String(),
    slot: Type.Number()
})

// A mining ship's terraforming action (rule 1.18), resolved once everyone has explored.
export type ShipTerraform = Type.Static<typeof ShipTerraform>
export const ShipTerraform = Type.Object({
    shipId: Type.String(),
    ...TerraformTarget.properties
})

export type TerraformRecord = Type.Static<typeof TerraformRecord>
export const TerraformRecord = Type.Object({
    playerId: Type.String(),
    ...TerraformTarget.properties
})

export type TerraformChoice = Type.Static<typeof TerraformChoice>
export const TerraformChoice = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    slot: Type.Number(),
    drawnTileIds: Type.Array(Type.String())
})

// The schema of CardLevel, the levels the decks print.
export const CardLevelValue = Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)])

// Rulebook 1.20. A card in a Player's hand shows its back, its type and level, to everyone; only
// its owner sees which card it is.
export type HandCard = Type.Static<typeof HandCard>
export const HandCard = Type.Object({
    playerId: Type.String(),
    deck: Type.Enum(CardDeck),
    level: CardLevelValue,
    cardId: Visibility.protect(Type.String(), { policy: Visibility.Policy.Owner })
})

// A card bought or earned, face up in front of its owner.
export type OwnedCard = Type.Static<typeof OwnedCard>
export const OwnedCard = Type.Object({
    cardId: Type.String(),
    year: Type.Number(),
    // Bought in a development phase, rather than earned from an anomaly or a pact.
    bought: Type.Boolean()
})

// One of the six decks with its discards. Nobody sees which cards they hold, only how many.
export type CardPile = Type.Static<typeof CardPile>
export const CardPile = Type.Object({
    deck: Type.Enum(CardDeck),
    level: CardLevelValue,
    cards: Visibility.protect(Type.Array(Type.String()), {
        policy: Visibility.Policy.HostOnly,
        redaction: Visibility.redaction.emptyArray()
    }),
    remaining: Type.Number(),
    discards: Visibility.protect(Type.Array(Type.String()), {
        policy: Visibility.Policy.HostOnly,
        redaction: Visibility.redaction.emptyArray()
    }),
    discarded: Type.Number()
})

// Where play goes on once the cards owed are drawn: the first exploration phase after setup,
// the next anomaly attempt, or what follows the development phase.
export enum CardsResume {
    Setup = 'Setup',
    Anomaly = 'Anomaly',
    AfterDevelopment = 'AfterDevelopment'
}

// One conversion roll after growth (rulebook 4.6): the True Path's, or Cultural Dominance's.
export type ConversionChance = Type.Static<typeof ConversionChance>
export const ConversionChance = Type.Object({
    playerId: Type.String(),
    roll: Type.Number()
})
