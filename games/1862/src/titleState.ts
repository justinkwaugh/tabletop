import * as Type from 'typebox'
import { ShareMerge } from './shareMerge.js'

const Id = Type.String({ minLength: 1 })
const Kind = Type.Union([Type.Literal('express'), Type.Literal('local'), Type.Literal('freight')])
const Count = Type.Integer({ minimum: 0 })

/** The phase from which an unstarted company may be started (§2.4, §3.2). */
export const Availability = Type.Union([Type.Literal('A'), Type.Literal('B'), Type.Literal('C')])
export type Availability = Type.Static<typeof Availability>

/** A charter won in Parliament that must float by the end of the next stock round (§4.3). */
export const Obligation = Type.Object(
    { companyId: Id, playerId: Id, stockRound: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type Obligation = Type.Static<typeof Obligation>

/** An auction for a charter: the high bid, its bidder, and who has left the auction. */
export const CharterAuction = Type.Object(
    {
        companyId: Id,
        playerId: Id,
        bid: Count,
        passedIds: Type.Array(Id, { uniqueItems: true })
    },
    { additionalProperties: false }
)
export type CharterAuction = Type.Static<typeof CharterAuction>

/** A Parliament Round (§4.1). */
export const ParliamentRound = Type.Object(
    {
        number: Type.Integer({ minimum: 1 }),
        /** The stock round the round's charters must float by. */
        stockRound: Type.Integer({ minimum: 1 }),
        /** Players who declined in succession since the last auction, in turn. */
        declinedIds: Type.Array(Id, { uniqueItems: true }),
        /**
         * Players who won a charter this round, who may bid but not open again; the most recent
         * winner last.
         */
        winnerIds: Type.Array(Id, { uniqueItems: true }),
        auction: Type.Optional(CharterAuction),
        /** The winning bid, before its winner sets par and buys. */
        charter: Type.Optional(
            Type.Object(
                { companyId: Id, playerId: Id, bid: Count },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type ParliamentRound = Type.Static<typeof ParliamentRound>

export const Variants1862 = Type.Object(
    {
        /** Companies may hold eight stations (§11.4). */
        eightStations: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type Variants1862 = Type.Static<typeof Variants1862>

export const TitleFields1862 = {
    variants: Variants1862,
    /** Each company's train permits; a company never loses one (§6.5.4.3). */
    permits: Type.Record(Id, Type.Array(Kind, { minItems: 1, uniqueItems: true })),
    /** The permit each company was dealt, which it takes again on restarting (§7.5.7). */
    originalPermits: Type.Record(Id, Kind),
    /** When each company in play may first be started (§2.4). */
    availability: Type.Record(Id, Availability),
    /** Companies holding a parliamentary charter: fully capitalized, IPO at par (§3.1). */
    chartered: Type.Array(Id, { uniqueItems: true }),
    obligations: Type.Array(Obligation),
    /** Fines for missed obligations still owed, in turn, after their payers' cash (§4.3). */
    fines: Type.Optional(
        Type.Array(
            Type.Object(
                { playerId: Id, amount: Type.Integer({ minimum: 1 }) },
                { additionalProperties: false }
            ),
            { minItems: 1 }
        )
    ),
    /** Companies reset for a missed obligation, which may not start before the next stock round (§4.3). */
    resetCompanyIds: Type.Optional(Type.Array(Id, { minItems: 1, uniqueItems: true })),
    parliament: Type.Optional(ParliamentRound),
    /** The operating set after which the next Parliament Round has been held. */
    parliamentSet: Type.Optional(Type.Integer({ minimum: 1 })),
    /** A floated non-chartered company whose director chooses how many stations it buys. */
    stationPurchase: Type.Optional(Id),
    /** Warranty tokens on trains, by train (§7.10). */
    warranties: Type.Record(Id, Type.Integer({ minimum: 1, maximum: 3 })),
    /** The running company's warranties have expired for this run (§7.10). */
    warrantiesExpired: Type.Optional(Type.Literal(true)),
    /** This turn's build, where it was not track: a small station or a London link (§7.6). */
    build: Type.Optional(Type.Union([Type.Literal('small-station'), Type.Literal('london')])),
    /** The company raised money for a train this turn, which it must buy from the bank (§7.11). */
    raisedForTrain: Type.Optional(Id),
    /** The company has redeemed a share this turn (§7.13). */
    redeemed: Type.Optional(Type.Literal(true)),
    /** A merger or acquisition proposed, awaiting the other director's consent (§7.5.1). */
    mergerProposal: Type.Optional(
        Type.Object(
            {
                kind: Type.Union([Type.Literal('merge'), Type.Literal('acquire')]),
                companyId: Id,
                partnerId: Id,
                survivorId: Id,
                initiatorId: Id
            },
            { additionalProperties: false }
        )
    ),
    /** A 2:1 share merge in progress (§5). */
    shareMerge: Type.Optional(ShareMerge),
    /** The first H train is bought: the LNER forms at the end of the set (§10.3). */
    lnerDue: Type.Optional(Type.Literal(true)),
    /** The LNER has formed, with the certificate limit it set (§10.3). */
    lner: Type.Optional(Type.Object({ certificateLimit: Count }, { additionalProperties: false }))
}
export type TitleState1862 = Type.Static<Type.TObject<typeof TitleFields1862>>
