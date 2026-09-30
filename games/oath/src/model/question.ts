import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Visibility } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { Region, SearchPlay, Suit } from './oathEnums.js'
import { ConspiracyPlay } from './conspiracy.js'

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

/** R-9.4 — a facedown adviser's card is known to whoever its holder let peek, while it stays there. */
function isAdviserShownTo(context: Visibility.PolicyContext<unknown>): boolean {
    const row = context.parent
    return (
        context.perspective.kind === 'player' &&
        typeof row === 'object' &&
        row !== null &&
        'shownTo' in row &&
        Array.isArray(row.shownTo) &&
        row.shownTo.includes(context.perspective.playerId)
    )
}

export const OathVisibilityPolicies = {
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
    OrderDiscards = 'orderDiscards'
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
        // R-9.4 — drawn from the relic deck and seen by the asked player alone.
        relicCardId: Visibility.protect(Type.String(), { policy: AskedPlayerPolicy })
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.BottomRelic),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        // R-9.4 — drawn from the relic deck and seen by the asked player alone.
        relicCardId: Visibility.protect(Type.String(), { policy: AskedPlayerPolicy })
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
        holderPlayerId: Type.String()
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
        /** How many cards wait to be stacked: the denizens that left the site, which everyone saw. */
        cardCount: Type.Number(),
        cardIds: Visibility.protect(Type.Array(Type.String(), { maxItems: 16 }), {
            policy: AskedPlayerPolicy
        })
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.ShroudedWoodDestination),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        travelerPlayerId: Type.String(),
        fromSiteId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.OrderDiscards),
        cardId: Type.String(),
        askedPlayerId: Type.String(),
        /** Cards leaving play faceup, so their order is public. */
        cardIds: Type.Array(Type.String(), { maxItems: 16 }),
        fromRegion: Type.Enum(Region)
    })
])

/** A question as the host and its asked player see it, every protected field present. */
export const PowerQuestionValidator = Compile(PowerQuestion)

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
        heldRelicCardId: Type.Optional(Type.String())
    }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.RelicThiefRoll), roll: Type.Boolean() }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.TakeOrLeaveRelic), take: Type.Boolean() }),
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.PlayOrDiscardConspiracy),
        play: Type.Boolean(),
        /** R-5.1.4.IV — the optional take, when playing it. */
        conspiracy: Type.Optional(ConspiracyPlay)
    }),
    Type.Object({ kind: Type.Literal(PowerQuestionKind.TravelFreeTo), siteId: Type.String() }),
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
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.ShroudedWoodDestination),
        siteId: Type.String()
    }),
    /** Positions in the question's `cardIds`, first discarded first, so the last lies on top. */
    Type.Object({
        kind: Type.Literal(PowerQuestionKind.OrderDiscards),
        order: Type.Array(Type.Number(), { maxItems: 16 })
    })
])

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
