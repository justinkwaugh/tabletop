import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Visibility } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { Region, SearchPlay, Suit } from './oathEnums.js'
import { ConspiracyPlay } from './conspiracy.js'
import { WarbandOwner } from './warbandCounts.js'
import { PowerMoveKind } from './powerMoveToll.js'

export const AskedPlayerPolicy = 'oath.askedPlayer'

function isAskedPlayer(context: Visibility.PolicyContext<unknown>): boolean {
    const question = context.parent
    return (
        context.perspective.kind === 'player' &&
        typeof question === 'object' &&
        question !== null &&
        'askedPlayerId' in question &&
        question.askedPlayerId === context.perspective.playerId
    )
}

export const ShownPlayerPolicy = 'oath.shownPlayer'

function isShownPlayer(context: Visibility.PolicyContext<unknown>): boolean {
    const action = context.root
    return (
        context.perspective.kind === 'player' &&
        typeof action === 'object' &&
        action !== null &&
        'toPlayerId' in action &&
        action.toPlayerId === context.perspective.playerId
    )
}

export const AdviserShownPolicy = 'oath.adviserShownTo'

/**
 * R-9.4 — a facedown adviser's card is known to whoever its holder let peek, while it stays there,
 * and to everyone when the table saw it go down (`seen`).
 */
function isAdviserShownTo(context: Visibility.PolicyContext<unknown>): boolean {
    const row = context.parent
    if (typeof row !== 'object' || row === null) return false
    if ('seen' in row && row.seen === true) return true
    return (
        context.perspective.kind === 'player' &&
        'shownTo' in row &&
        Array.isArray(row.shownTo) &&
        row.shownTo.includes(context.perspective.playerId)
    )
}

export const HandShownPolicy = 'oath.handShown'

/** Truthful Harp — "you must reveal every card you draw": a hand the table has seen. */
function isHandShown(context: Visibility.PolicyContext<unknown>): boolean {
    const player = context.parent
    return (
        typeof player === 'object' &&
        player !== null &&
        'handShown' in player &&
        player.handShown === true
    )
}

export const RelicSeenPolicy = 'oath.relicSeenBy'

/** A relic drawn off the known bottom of the relic deck is known to whoever knew it there. */
function isRelicSeenBy(context: Visibility.PolicyContext<unknown>): boolean {
    const question = context.parent
    if (typeof question !== 'object' || question === null || !('seenBy' in question)) return false
    const seenBy = question.seenBy
    if (!Array.isArray(seenBy)) return false
    return (
        seenBy.includes('everyone') ||
        (context.perspective.kind === 'player' && seenBy.includes(context.perspective.playerId))
    )
}

export const OathVisibilityPolicies = {
    [HandShownPolicy]: isHandShown,
    [RelicSeenPolicy]: isRelicSeenBy,
    [AdviserShownPolicy]: isAdviserShownTo,
    [AskedPlayerPolicy]: isAskedPlayer,
    [ShownPlayerPolicy]: isShownPlayer
}

/** Jinx — "after you roll … for any reason": the roll, and what waits on it. */
export enum RerolledRollKind {
    Campaign = 'campaign',
    GamblingHall = 'gamblingHall',
    RelicThief = 'relicThief'
}

export type RerolledRoll = Type.Static<typeof RerolledRoll>
export const RerolledRoll = Type.Union([
    Type.Object({
        kind: Type.Literal(RerolledRollKind.Campaign),
        side: Type.Union([Type.Literal('attack'), Type.Literal('defense')])
    }),
    Type.Object({
        kind: Type.Literal(RerolledRollKind.GamblingHall),
        bank: Type.Enum(Suit),
        shields: Type.Number()
    }),
    Type.Object({
        kind: Type.Literal(RerolledRollKind.RelicThief),
        takerPlayerId: Type.String(),
        relicCardIds: Type.Array(Type.String()),
        shields: Type.Number()
    })
])

/** R-X.1 — a card's question to another player; the engine never infers the answer. */
export enum PowerQuestionKind {
    /** Revelation — "may burn any number of favor to gain an equal number of secrets". */
    BurnFavorForSecrets = 'burnFavorForSecrets',
    /** Blackmail — "you take the relic unless they give you favor". */
    PayOrLoseRelic = 'payOrLoseRelic',
    /** Herald, Book Binders — "you gain favor from any favor bank" for a player who is not acting. */
    PickFavorBank = 'pickFavorBank',
    /** Tinker's Fair, Deed Writer, The Gathering — a proposed binding exchange (R-7.6.3, R-10.8). */
    Exchange = 'exchange',
    /** The Gathering — "any players in turn order may put their pawn on this site". */
    JoinSite = 'joinSite',
    /** The Gathering — a present player's turn to propose one binding exchange, or pass. */
    GatheringFloor = 'gatheringFloor',
    /** Family Heirloom — a relic drawn and seen: take it, or put it on the bottom of the deck. */
    KeepOrBottomRelic = 'keepOrBottomRelic',
    /** Fae Merchant — a relic drawn and taken, then any relic held but the Grand Scepter to the bottom. */
    BottomRelic = 'bottomRelic',
    /** Relic Thief — "you may use this power to roll one defense die per relic taken". */
    RelicThiefRoll = 'relicThiefRoll',
    /** Skeleton Key — a Reliquary relic seen: take it, or leave it where it is. */
    TakeOrLeaveRelic = 'takeOrLeaveRelic',
    /** Inquisitor — the Conspiracy found among another player's advisers: play it, or discard it. */
    PlayOrDiscardConspiracy = 'playOrDiscardConspiracy',
    /** Brass Horse — a free Travel to one of the sites the revealed suit names. */
    TravelFreeTo = 'travelFreeTo',
    /** Jinx — reroll the dice just rolled, once. */
    RerollDice = 'rerollDice',
    /** False Prophet — the Vision under its warband was discarded: play or discard it (R-5.1.4). */
    PlayOrDiscardVision = 'playOrDiscardVision',
    /** Wild Mounts — R-5.5.8's discard of nomad battle plans, or one beast card the player rules instead. */
    DiscardInstead = 'discardInstead',
    /** Sneak Attack — campaign against the named defender for no Supply (answered by a `Campaign`), or pass. */
    SneakAttack = 'sneakAttack',
    /** Pilgrimage — the denizens drawn and peeked, stacked on the pile in the order the player chooses. */
    OrderDrawnCards = 'orderDrawnCards',
    /** R-11.7 — the ruler of a Shrouded Wood chooses where a pawn leaving it goes. */
    ShroudedWoodDestination = 'shroudedWoodDestination',
    /** Law Glossary "Discard" — the order several cards go onto one pile. */
    OrderDiscards = 'orderDiscards',
    /** Toll Roads — a power moves the asked player into its ruler's site: give the favor, or refuse and stay. */
    PayTravelToll = 'payTravelToll',
    /**
     * Second Wind out of turn (revision 7) — the holder's free Travel, then free Campaign, before the
     * held turn resumes: answered by the action itself, or skipped.
     */
    FreeActionOutOfTurn = 'freeActionOutOfTurn',
    /**
     * Dragonskin Drum (revision 7) — a power moved its holder, who "after traveling" may gain one
     * warband, as its Q&A rules a forced travel does: gain it, or skip.
     */
    DragonskinDrum = 'dragonskinDrum',
    /**
     * Enchantress, Twin Brother, Horned Mask (revision 11) — a swap left the asked player over their
     * adviser limit: they discard down to it, never a card the swap gave them (R-7.6.4). An
     * exchange that leaves a player over their limit asks the same (R-10.8).
     */
    DiscardAdvisers = 'discardAdvisers',
    /**
     * The Hidden Place, the Buried Giant (revision 15) — a power moves the asked player to a site
     * they reach only by flipping a faceup secret facedown: flip and travel, or stay (R-11.13-H1).
     */
    FlipToTravel = 'flipToTravel',
    /**
     * Way Station (revision 15) — the Shrouded Wood's ruler sent the asked player's Travel to its
     * site, and they can both pay the Supply and give its ruler a favor: give it and spend no
     * Supply, or pay the Supply; either way they travel (R-11.7-H3).
     */
    WayStationFavor = 'wayStationFavor',
    /**
     * Hospitality (revision 15) — declared on a Travel out of an enemy's Shrouded Wood, it names no
     * bank; once the ruler's pick has landed the asked player, two or more banks match: they choose
     * the one they gain from (R-11.7-H2).
     */
    HospitalityBank = 'hospitalityBank',
    /**
     * Vow of Kinship (revision 18) — Plague Engines or Dissent has every player place favor, and the
     * asked player's board did not hold all they owe: they may pay the rest from the bank that keeps
     * their favor, or not, since its Q&A never forces that favor (R-10.10-H1).
     */
    PayFromHomeBank = 'payFromHomeBank'
}

/** Deed Writer — a site changing hands. */
export type SiteTransfer = Type.Static<typeof SiteTransfer>
export const SiteTransfer = Type.Object({
    siteId: Type.String(),
    /** "new ruler moves warbands from board" — how many the receiver moves in. */
    warbands: Type.Number()
})

/** R-10.8, R-7.6.3-H1 — one side of a binding exchange. */
export type ExchangeTransfer = Type.Static<typeof ExchangeTransfer>
export const ExchangeTransfer = Type.Object({
    favor: Type.Optional(Type.Number()),
    secrets: Type.Optional(Type.Number()),
    relicCardIds: Type.Optional(Type.Array(Type.String(), { maxItems: 16 })),
    /** Deed Writer only. */
    sites: Type.Optional(Type.Array(SiteTransfer, { maxItems: 8 })),
    /** The Gathering only — rows of the giver's public adviser list, so a facedown card is never named (R-9.4). */
    adviserRows: Type.Optional(
        Type.Array(Type.Integer({ minimum: 0, maximum: 15 }), { maxItems: 8 })
    )
})

/** R-7.6.3-H1, R-10.8 — what a card's exchange may carry. */
export interface ExchangeAllowance {
    relics?: boolean
    sites?: boolean
    advisers?: boolean
}

export type ExchangeTerms = Type.Static<typeof ExchangeTerms>
export const ExchangeTerms = Type.Object({
    fromProposer: Type.Optional(ExchangeTransfer),
    fromCounterparty: Type.Optional(ExchangeTransfer)
})

/**
 * R-11.7-H2 — a card declared on a Travel out of an enemy's Shrouded Wood. No choice rides it:
 * Hospitality's bank is chosen once the pick has landed the traveller, and any other card that asks
 * a choice is refused there, as its choice depends on the site.
 */
export type WoodTravelCard = Type.Static<typeof WoodTravelCard>
export const WoodTravelCard = Type.Object({
    cardId: Type.String(),
    powerIndex: Type.Integer({ minimum: 0, maximum: 9 })
})

/** R-11.7 — the traveller's own Travel, which pays when the Shrouded Wood's ruler names the site. */
export type ShroudedWoodTravel = Type.Static<typeof ShroudedWoodTravel>
export const ShroudedWoodTravel = Type.Object({
    /** Second Wind, Brass Horse — the Travel spends no Supply wherever it goes. */
    free: Type.Boolean(),
    /**
     * R-11.7-H2 (revision 15) — the optional cards declared at the Travel's start, already paid; each
     * counts only for a pick that meets its condition. Public, as a Travel's declared cards are.
     */
    modifiers: Type.Optional(Type.Array(WoodTravelCard, { maxItems: 8 }))
})

/**
 * R-11.7-H1 (revision 15) — the power that moves a pawn out of an enemy's Shrouded Wood, whose
 * ruler then picks the site: the Whistle (any site the pawn can travel to) or the Brass Horse
 * (only among the sites its revealed suit allows).
 */
export type ShroudedWoodPower = Type.Static<typeof ShroudedWoodPower>
export const ShroudedWoodPower = Type.Object({
    powerCardId: Type.String(),
    /** Whistle — its secret goes to the pawn only at its user's site. */
    userPlayerId: Type.String(),
    /** Brass Horse — the sites the ruler may pick among; absent, any site the pawn can travel to. */
    siteIds: Type.Optional(Type.Array(Type.String(), { maxItems: 8 }))
})

/** R-11.7 — what the ruler's pick settled for the traveller's Travel. */
export type ShroudedWoodPick = Type.Static<typeof ShroudedWoodPick>
export const ShroudedWoodPick = Type.Object({
    travelerPlayerId: Type.String(),
    siteId: Type.String(),
    supplySpent: Type.Number(),
    supplyRemaining: Type.Number(),
    /** R-7.4 (Tyrant), R-7.1.4 (Grasping Vines, Boiling Lake) */
    notes: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })),
    /** R-10.13 — whose warband Tyrant killed. */
    warbandOwner: Type.Optional(WarbandOwner),
    /** R-11.7-H3 — the ruler who picked, when the traveller's own Way Station answer settles the pick. */
    chooserPlayerId: Type.Optional(Type.String()),
    /** R-11.7-H2 — the declared cards that set the price of this pick (Tents, Forest Paths), when any did. */
    pricedBy: Type.Optional(Type.Array(Type.String(), { maxItems: 8 }))
})

/** R-11.7-H2 — the ruler kept the traveller at the Shrouded Wood their Travel set out from. */
export type ShroudedWoodStay = Type.Static<typeof ShroudedWoodStay>
export const ShroudedWoodStay = Type.Object({
    travelerPlayerId: Type.String(),
    siteId: Type.String()
})

/** Dragonskin Drum — the warbands an answer put on its player's board, and whose they are (R-10.13). */
export type WarbandGain = Type.Static<typeof WarbandGain>
export const WarbandGain = Type.Object({
    owner: WarbandOwner,
    count: Type.Number()
})

export type PowerQuestion = Type.Static<typeof PowerQuestion>
export const PowerQuestion = Type.Union([
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.BurnFavorForSecrets),
        cardId: Type.String(),
        askedPlayerId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.PayOrLoseRelic),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        takerPlayerId: Type.String(),
        relicCardId: Type.String(),
        price: Type.Number()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.PickFavorBank),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        amount: Type.Number()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.Exchange),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        proposerPlayerId: Type.String(),
        terms: ExchangeTerms
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.JoinSite),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        siteId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.GatheringFloor),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        siteId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.KeepOrBottomRelic),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        /** Who already knew the relic drawn: it came off the known bottom of the relic deck. */
        seenBy: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })),
        // R-9.4 — drawn from the relic deck and seen by the asked player, and by whoever knew it.
        relicCardId: Visibility.protect(Type.String(), {
            policy: Visibility.Policy.anyOf(AskedPlayerPolicy, RelicSeenPolicy)
        })
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.BottomRelic),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        /** Who already knew the relic drawn: it came off the known bottom of the relic deck. */
        seenBy: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })),
        // R-9.4 — drawn from the relic deck and seen by the asked player, and by whoever knew it.
        relicCardId: Visibility.protect(Type.String(), {
            policy: Visibility.Policy.anyOf(AskedPlayerPolicy, RelicSeenPolicy)
        })
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.TakeOrLeaveRelic),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        slotId: Type.String(),
        // R-9.4 — a Reliquary relic stays facedown unless taken.
        relicCardId: Visibility.protect(Type.String(), { policy: AskedPlayerPolicy })
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.PlayOrDiscardConspiracy),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        holderPlayerId: Type.String(),
        /** The row Inquisitor peeked at, which everyone saw chosen. */
        index: Type.Number()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.TravelFreeTo),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        siteIds: Type.Array(Type.String(), { maxItems: 8 })
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.RerollDice),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        powerIndex: Type.Number(),
        roll: RerolledRoll
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.RelicThiefRoll),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        powerIndex: Type.Number(),
        takerPlayerId: Type.String(),
        relicCardIds: Type.Array(Type.String(), { maxItems: 16 })
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.PlayOrDiscardVision),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        visionCardId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.DiscardInstead),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        planCardIds: Type.Array(Type.String(), { maxItems: 16 }),
        insteadCardIds: Type.Array(Type.String(), { maxItems: 64 }),
        /** R-10.5 — the Campaign's acting player, who takes the secrets on the discards. */
        actingPlayerId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.SneakAttack),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        defenderPlayerId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.OrderDrawnCards),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        region: Type.Enum(Region),
        /** How many cards wait to be stacked: as many as left the site. */
        cardCount: Type.Number(),
        /**
         * When the Dispossessed was empty, the cards drawn back are the denizens that left the site,
         * which everyone saw: named here, sorted, since only their order is the asked player's.
         */
        among: Type.Optional(Type.Array(Type.String(), { maxItems: 16 })),
        cardIds: Visibility.protect(Type.Array(Type.String(), { maxItems: 16 }), {
            policy: AskedPlayerPolicy
        })
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.ShroudedWoodDestination),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        travelerPlayerId: Type.String(),
        fromSiteId: Type.String(),
        /** Absent when a power moves the pawn, and in a game created before `UiBatch1`. */
        travel: Type.Optional(ShroudedWoodTravel),
        /** The Whistle or the Brass Horse moved the pawn (revision 15). */
        power: Type.Optional(ShroudedWoodPower)
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.OrderDiscards),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        /** Cards leaving play faceup, so their order is public. */
        cardIds: Type.Array(Type.String(), { maxItems: 16 }),
        fromRegion: Type.Enum(Region)
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.PayTravelToll),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        /** Absent: the bandits rule the card, so the favor is burned. */
        payeeId: Type.Optional(Type.String()),
        move: Type.Enum(PowerMoveKind),
        powerCardId: Type.Optional(Type.String()),
        moverPlayerId: Type.String(),
        fromSiteId: Type.String(),
        siteId: Type.String(),
        /** R-5.5.7.III — the attacker's burn, which waits on the answer. */
        burnFavor: Type.Optional(Type.Boolean()),
        /** R-11.7 — the traveller's own Travel out of the Shrouded Wood, which pays its Supply once the toll is paid. */
        travel: Type.Optional(ShroudedWoodTravel),
        /** R-11.7-H1 — the power whose move the Shrouded Wood's ruler redirected. */
        power: Type.Optional(ShroudedWoodPower),
        /** R-11.13-H1 — the secret the asked player chose to flip, flipped once the toll is paid. */
        flipSecret: Type.Optional(Type.Boolean())
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.FreeActionOutOfTurn),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        /** "you may travel and then may campaign" — the one asked now. */
        action: Type.Union([Type.Literal(ActionType.Travel), Type.Literal(ActionType.Campaign)])
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.DragonskinDrum),
        cardId: Type.String(),
        askedPlayerId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.FlipToTravel),
        /** The power's card; for a banish, the site whose rule asks: The Hidden Place, or the Buried Giant left. */
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        move: Type.Enum(PowerMoveKind),
        /** The Whistle or Palanquin; absent for a banish. */
        powerCardId: Type.Optional(Type.String()),
        moverPlayerId: Type.String(),
        fromSiteId: Type.String(),
        siteId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.WayStationFavor),
        /** Way Station. */
        cardId: Type.String(),
        /** The traveller. */
        askedPlayerId: Type.String(),
        /** Absent: the bandits rule Way Station, so the favor is burned (R-10.3-H1). */
        payeeId: Type.Optional(Type.String()),
        /** The Shrouded Wood's ruler, who picked the site. */
        chooserPlayerId: Type.String(),
        fromSiteId: Type.String(),
        siteId: Type.String(),
        /** What the other answer spends: the Wood's price for this site, the cards counted. */
        supplyCost: Type.Number(),
        travel: ShroudedWoodTravel
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.HospitalityBank),
        /** Hospitality. */
        cardId: Type.String(),
        powerIndex: Type.Integer({ minimum: 0, maximum: 9 }),
        /** The traveller, at the site the Shrouded Wood's ruler picked. */
        askedPlayerId: Type.String(),
        siteId: Type.String(),
        /** The banks that match a card at the site and one of their advisers, and hold favor. */
        banks: Type.Array(Type.Enum(Suit), { maxItems: 6 }),
        /** A declared Special Envoy: the Act Phase ends once the bank is answered. */
        endsActPhase: Type.Optional(Type.Literal(true))
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.PayFromHomeBank),
        /** Plague Engines or Dissent. */
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        /** What their board left unpaid. */
        owed: Type.Integer({ minimum: 1, maximum: 99 }),
        /** Where the favor goes: this bank (Plague Engines), or, absent, onto the card (Dissent). */
        toBank: Type.Optional(Type.Enum(Suit))
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.DiscardAdvisers),
        /** The power that moved the advisers. */
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        /** R-10.5 — the power's user, who takes the secrets on the discards. */
        actingPlayerId: Type.String(),
        /** The fewest discards that meet the limit, as far as discardable advisers go (R-7.6.4). */
        count: Type.Number(),
        /** Enchantress's Q&A — the faceup cards the move gave the asked player, not discarded. */
        receivedCardIds: Type.Array(Type.String(), { maxItems: 8 }),
        /** R-9.4 — the facedown advisers an exchange gave them, kept the same way: named to them alone. */
        receivedFacedownCardIds: Visibility.protect(Type.Array(Type.String(), { maxItems: 8 }), {
            policy: AskedPlayerPolicy
        })
    })
])

/** A question as the host and its asked player see it, every protected field present. */
export const PowerQuestionValidator = Compile(PowerQuestion)

/** R-10.13-H1 — so many of the Obsidian Cage's Imperial warbands to a player's board. */
export type CagePlacement = Type.Static<typeof CagePlacement>
export const CagePlacement = Type.Array(
    Type.Object({ playerId: Type.String(), count: Type.Integer({ minimum: 1, maximum: 999 }) }),
    { maxItems: 8 }
)

export type QuestionAnswer = Type.Static<typeof QuestionAnswer>
export const QuestionAnswer = Type.Union([
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.BurnFavorForSecrets),
        favor: Type.Number()
    }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.PayOrLoseRelic), pay: Type.Boolean() }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.PickFavorBank), suit: Type.Enum(Suit) }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.Exchange), accept: Type.Boolean() }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.JoinSite), join: Type.Boolean() }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.GatheringFloor),
        /** Absent to pass. */
        proposal: Type.Optional(Type.Object({ withPlayerId: Type.String(), terms: ExchangeTerms }))
    }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.KeepOrBottomRelic), keep: Type.Boolean() }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.BottomRelic),
        /** A relic held before the draw; absent, the drawn relic goes, unnamed. */
        heldRelicCardId: Type.Optional(Type.String()),
        /**
         * R-10.13-H1 — the Obsidian Cage sent down: where its Imperial warbands go, when two or
         * more Imperial boards may take them. Absent in every other answer.
         */
        cagePlacement: Type.Optional(CagePlacement)
    }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.RelicThiefRoll), roll: Type.Boolean() }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.TakeOrLeaveRelic), take: Type.Boolean() }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.PlayOrDiscardConspiracy),
        play: Type.Boolean(),
        /** R-5.1.4.IV — the optional take, when playing it. */
        conspiracy: Type.Optional(ConspiracyPlay),
        /** R-5.1.4-H1 — played facedown to the finder's advisers; absent, the play is faceup. */
        facedown: Type.Optional(Type.Literal(true)),
        /** R-5.1.4.II — the adviser discarded to make room for the Conspiracy played facedown. */
        discardedAdviserCardId: Type.Optional(
            Visibility.protect(Type.String(), { policy: Visibility.Policy.Actor })
        )
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.TravelFreeTo),
        siteId: Type.String(),
        /** R-11.13-H1 — a faceup secret flipped facedown, for a site that asks for one. */
        flipSecret: Type.Optional(Type.Boolean())
    }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.RerollDice), reroll: Type.Boolean() }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.PlayOrDiscardVision),
        play: Type.Enum(SearchPlay),
        /** R-5.1.4.II — the adviser discarded to make room for a Vision played facedown. */
        discardedAdviserCardId: Type.Optional(
            Visibility.protect(Type.String(), { policy: Visibility.Policy.Actor })
        )
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.DiscardInstead),
        /** Absent to discard the battle plans as printed. */
        insteadCardId: Type.Optional(Type.String())
    }),
    /** The pass; the Campaign itself is the other answer. */
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.SneakAttack),
        campaign: Type.Literal(false)
    }),
    /** Positions in the question's `cardIds`, last on top, so the public record names no card. */
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.OrderDrawnCards),
        order: Type.Array(Type.Number(), { maxItems: 16 })
    }),
    /** The site picked; or, R-11.7-H2 (revision 15), `stay`: the ruler keeps the traveller in place. */
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.ShroudedWoodDestination),
        siteId: Type.Optional(Type.String()),
        stay: Type.Optional(Type.Literal(true))
    }),
    /** Positions in the question's `cardIds`, first discarded first, so the last lies on top. */
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.OrderDiscards),
        order: Type.Array(Type.Number(), { maxItems: 16 })
    }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.PayTravelToll), pay: Type.Boolean() }),
    /** The skip; the Travel or Campaign itself is the other answer. */
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.FreeActionOutOfTurn),
        take: Type.Literal(false)
    }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.DragonskinDrum), gain: Type.Boolean() }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.FlipToTravel), flip: Type.Boolean() }),
    /** `give`: the favor to Way Station's ruler and no Supply; otherwise the Supply. Both travel. */
    Type.Object({ kind: Type.Literal(PowerQuestionKind.WayStationFavor), give: Type.Boolean() }),
    /** The bank Hospitality gains from: one of the question's `banks`. */
    Type.Object({ kind: Type.Literal(PowerQuestionKind.HospitalityBank), suit: Type.Enum(Suit) }),
    /** How many favor to pay from the bank, 0 for none. */
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.PayFromHomeBank),
        favor: Type.Integer({ minimum: 0, maximum: 99 })
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.DiscardAdvisers),
        /** R-10.5 — in the order they go down, the last on top; a facedown one is named to its holder alone. */
        discardedAdviserCardIds: Visibility.protect(Type.Array(Type.String(), { maxItems: 8 }), {
            policy: Visibility.Policy.Actor
        })
    })
])

export type QuestionOf<K extends PowerQuestionKind> = Extract<PowerQuestion, { kind: K }>
export type AnswerOf<K extends PowerQuestionKind> = Extract<QuestionAnswer, { kind: K }>
export type Answered<K extends PowerQuestionKind> = { question: QuestionOf<K>; answer: AnswerOf<K> }

/** Present only while a question is unanswered. */
export type PendingQuestions = Type.Static<typeof PendingQuestions>
export const PendingQuestions = Type.Object({
    queue: Type.Array(PowerQuestion, { maxItems: 64 }),
    askingPlayerId: Type.String(),
    resumeMachineState: Type.Enum(MachineState),
    /** The Gathering — the second round is built once the first round's pawns have moved. */
    followUp: Type.Optional(
        Type.Object({
            kind: Type.Literal('gatheringFloor'),
            cardId: Type.String(),
            siteId: Type.String()
        })
    )
})
