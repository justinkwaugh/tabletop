import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import { AnomalyChallenge, anomalyDefinition } from '../components/anomalies.js'
import { CardDeck, cardDefinition } from '../components/cards.js'
import { EscalationMarker } from '../components/escalation.js'
import { Faction } from '../components/factions.js'
import { TechField } from '../components/techFields.js'
import { TechId } from '../components/techs.js'
import { TitleId } from '../components/titles.js'
import { TradeGood } from '../components/tradeGoods.js'
import {
    TitleRequest,
    TurnRecord,
    EarnedMarkers,
    FulfilledDirective,
    HandCard,
    HeldDirective,
    Operation,
    OwnedCard,
    PendingAnomalyAttempt,
    PendingEventAttempt,
    PendingSurvey,
    ShipTerraform
} from './pieces.js'

export type TechMarkers = Type.Static<typeof TechMarkers>
export const TechMarkers = Type.Object({
    [TechField.Biology]: Type.Array(Type.Number()),
    [TechField.Physics]: Type.Array(Type.Number()),
    [TechField.Engineering]: Type.Array(Type.Number())
})

export function emptyTechMarkers(): TechMarkers {
    return { Biology: [], Physics: [], Engineering: [] }
}

export type OwnedTech = Type.Static<typeof OwnedTech>
export const OwnedTech = Type.Object({
    techId: Type.Enum(TechId),
    year: Type.Number()
})

export type StellarHorizonsPlayerState = Type.Static<typeof StellarHorizonsPlayerState>
export const StellarHorizonsPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            faction: Type.Optional(Type.Enum(Faction)),
            cash: Type.Number(),
            techMarkers: TechMarkers,
            spentMarkers: TechMarkers,
            earnedMarkers: Type.Array(EarnedMarkers),
            techs: Type.Array(OwnedTech),
            remoteRepairUsed: Type.Boolean(),
            fieldsDeveloped: Type.Array(Type.Enum(TechField)),
            pendingSurveys: Type.Array(PendingSurvey),
            anomalyAttempts: Type.Array(PendingAnomalyAttempt),
            anomalies: Type.Array(Type.String()),
            influence: Type.Number(),
            operations: Type.Array(Operation),
            shipTerraforms: Type.Array(ShipTerraform),
            eventAttempts: Type.Array(PendingEventAttempt),
            breakthroughs: Type.Array(Type.Enum(TechField)),
            explorationMarkers: Type.Number(),
            earthGoods: Type.Array(Type.Enum(TradeGood)),
            drawnGoods: Type.Array(Type.Enum(TradeGood)),
            discardedGoods: Type.Array(Type.Enum(TradeGood)),
            initiativeBid: Type.Optional(Type.Number()),
            hand: Type.Array(HandCard),
            cards: Type.Array(OwnedCard),
            // Cards owed to the hand, drawn on the Main Line one at a time (rulebook 1.20).
            cardDraws: Type.Array(Type.Enum(CardDeck)),
            settlementsBought: Type.Number(),
            // Transcend Biology's announced change to the end roll's chance.
            endRollModifier: Type.Optional(Type.Number()),
            escalation: Type.Array(Type.Enum(EscalationMarker)),
            // The markers chosen to keep at the next initiative roll's discard (rulebook 4.1).
            escalationKept: Type.Optional(Type.Array(Type.Enum(EscalationMarker))),
            // Short of IP for markers the pool could not supply: no attacks until after the next
            // initiative roll (rulebook 1.7).
            attackBanned: Type.Boolean(),
            // Rulebook 5.1: the directive held and any drawn to choose from, those fulfilled,
            // the draws owed at the next deal, whether the turn's redraw is used, and the turn's
            // totals toward a directive.
            heldDirectives: Type.Array(HeldDirective),
            fulfilledDirectives: Type.Array(FulfilledDirective),
            directiveDrawsOwed: Type.Number(),
            redrewDirective: Type.Boolean(),
            turnRecord: TurnRecord,
            // Rulebook 5.2: titles owned, and those bought or renounced in a Branch, waiting.
            titles: Type.Array(Type.Enum(TitleId)),
            titleRequests: Type.Array(TitleRequest)
        })
    ])
)

// Another Player's hand shows only its backs: which card each is, is omitted.
export const StellarHorizonsProjectedPlayerState = Visibility.createProjectionSchema(
    StellarHorizonsPlayerState
)
export type StellarHorizonsProjectedPlayerState = Type.Static<
    typeof StellarHorizonsProjectedPlayerState
>
export type ProjectedHandCard = StellarHorizonsProjectedPlayerState['hand'][number]
export const StellarHorizonsProjectedPlayerStateValidator = Compile(
    StellarHorizonsProjectedPlayerState
)

export class HydratedStellarHorizonsPlayerState
    extends Hydratable<typeof StellarHorizonsProjectedPlayerState>
    implements StellarHorizonsProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare faction?: Faction
    declare cash: number
    declare techMarkers: TechMarkers
    declare spentMarkers: TechMarkers
    declare earnedMarkers: EarnedMarkers[]
    declare techs: OwnedTech[]
    declare remoteRepairUsed: boolean
    declare fieldsDeveloped: TechField[]
    declare pendingSurveys: PendingSurvey[]
    declare anomalyAttempts: PendingAnomalyAttempt[]
    declare anomalies: string[]
    declare influence: number
    declare operations: Operation[]
    declare shipTerraforms: ShipTerraform[]
    declare eventAttempts: PendingEventAttempt[]
    declare breakthroughs: TechField[]
    declare explorationMarkers: number
    declare earthGoods: TradeGood[]
    declare drawnGoods: TradeGood[]
    declare discardedGoods: TradeGood[]
    declare initiativeBid?: number
    declare hand: ProjectedHandCard[]
    declare heldDirectives: StellarHorizonsProjectedPlayerState['heldDirectives']
    declare fulfilledDirectives: FulfilledDirective[]
    declare directiveDrawsOwed: number
    declare redrewDirective: boolean
    declare turnRecord: TurnRecord
    declare titles: TitleId[]
    declare titleRequests: TitleRequest[]
    declare cards: OwnedCard[]
    declare cardDraws: CardDeck[]
    declare settlementsBought: number
    declare endRollModifier?: number
    declare escalation: EscalationMarker[]
    declare escalationKept?: EscalationMarker[]
    declare attackBanned: boolean

    constructor(data: StellarHorizonsProjectedPlayerState) {
        super(data, StellarHorizonsProjectedPlayerStateValidator)
    }

    ownsTech(techId: TechId): boolean {
        return this.techs.some((owned) => owned.techId === techId)
    }

    ownedTechIds(): TechId[] {
        return this.techs.map((owned) => owned.techId)
    }

    ownedBefore(techId: TechId, year: number): boolean {
        return this.techs.some((owned) => owned.techId === techId && owned.year < year)
    }

    markerTotal(field: TechField): number {
        return this.techMarkers[field].reduce((total, value) => total + value, 0)
    }

    ownsCard(cardId: string): boolean {
        return this.cards.some((owned) => owned.cardId === cardId)
    }

    handCards(deck: CardDeck): ProjectedHandCard[] {
        return this.hand.filter((card) => card.deck === deck)
    }

    cardPoints(): number {
        return this.cards.reduce((total, owned) => total + cardDefinition(owned.cardId).points, 0)
    }

    anomaliesResolved(challenge: AnomalyChallenge): number {
        return this.anomalies.filter(
            (anomalyId) => anomalyDefinition(anomalyId).challenge === challenge
        ).length
    }
}
