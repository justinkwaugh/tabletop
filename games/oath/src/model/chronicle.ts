import { Color } from '@tabletop/common'
import * as Type from 'typebox'
import { OathType, Region, Suit } from './oathEnums.js'
import { WIN_KIND_OF_RULE, WIN_RULES, WinKind, type WinRule } from './ending.js'

/**
 * R-8 — what a won game writes at its end, and the record a chronicle keeps. Every field is public
 * and every later field optional: a stored final state is validated again under later revisions.
 */

/** The winner's story: at most this many characters, counted as Unicode code points. */
export const CHRONICLE_STORY_LIMIT = 1000

/** The journal's letter for how the game was won. */
export enum ChronicleMark {
    /** R-3.1, R-3.3, R-3.4.1, R-3.4.2, R-3.4.4 — a Usurper, or the Chancellor. */
    Oathkeeper = 'O',
    /** R-3.3.1 — a Citizen took the Chancellor's win. */
    Successor = 'S',
    /** R-3.2, R-3.4.3 */
    Visionary = 'V'
}

/** R-8's steps in the Law's order; the Chronicle phase walks them once. */
export enum ChronicleStep {
    /** R-8.1 */
    Vow = 'vow',
    /** R-8.2 */
    Citizenship = 'citizenship',
    /** R-8.3.1 */
    BuildOrRepair = 'buildOrRepair',
    /** R-8.3.2 to R-8.3.5 */
    Map = 'map',
    /** R-8.4 — the tie for the suit. */
    Suit = 'suit',
    /** R-8.4, R-8.4.a */
    AddSix = 'addSix',
    /** R-8.4.a — the tie for the biggest stack of the Dispossessed. */
    HealStack = 'healStack',
    /** R-8.5 */
    Dispossess = 'dispossess',
    /** R-8.6 */
    Relics = 'relics',
    /** R-8.7 and R-8.8 — the save moves nothing on the table, so the rebuild follows it at once. */
    Rebuild = 'rebuild',
    /** The winner's entry in the record. */
    Story = 'story'
}

/** Every way the winner met a win at the moment they won; R-8.1 reads it. */
export type ChronicleWaysMet = Type.Static<typeof ChronicleWaysMet>
export const ChronicleWaysMet = Type.Object({
    /** R-3.1, R-3.4.2 */
    usurper: Type.Boolean(),
    /** R-3.2, R-3.4.3 — each revealed Vision whose goal they meet (R-3.2-H1, R-3.2-H2). */
    visionIds: Type.Array(Type.String()),
    /** R-3.3, R-3.3.1, R-3.4.1, R-3.4.4 */
    empire: Type.Boolean()
})

/** R-3 — the win as decided, stored once by the action that won. The rule gives its kind and mark. */
export type ChronicleEnding = Type.Static<typeof ChronicleEnding>
export const ChronicleEnding = Type.Object({
    winnerPlayerId: Type.String(),
    rule: Type.Enum(WIN_RULES),
    waysMet: ChronicleWaysMet
})

/** The journal's letter for a win by `rule`. */
export function chronicleMarkOf(rule: WinRule): ChronicleMark {
    switch (WIN_KIND_OF_RULE[rule]) {
        case WinKind.Successor:
            return ChronicleMark.Successor
        case WinKind.Visionary:
            return ChronicleMark.Visionary
        case WinKind.Usurper:
        case WinKind.StableRegime:
        case WinKind.WarExhaustion:
            return ChronicleMark.Oathkeeper
    }
}

/** A seat as the record keeps it: player ids change between games, so a name and a colour. */
export type ChronicleSeat = Type.Static<typeof ChronicleSeat>
export const ChronicleSeat = Type.Object({
    name: Type.String(),
    color: Type.Enum(Color)
})

/** R-8.4 — the suits that added cards, in order, or the suit and count a heal added. */
export type ChronicleAdded = Type.Static<typeof ChronicleAdded>
export const ChronicleAdded = Type.Object({
    suits: Type.Optional(Type.Array(Type.Enum(Suit))),
    heal: Type.Optional(Type.Object({ suit: Type.Enum(Suit), count: Type.Number() }))
})

/** R-8.3.1 */
export type ChronicleBuilt = Type.Static<typeof ChronicleBuilt>
export const ChronicleBuilt = Type.Object({
    edificeId: Type.String(),
    siteId: Type.String(),
    /** The site card in that slot as it was built: R-8.3.5 may move it, and the record outlives the map. */
    siteCardId: Type.Optional(Type.String()),
    repaired: Type.Boolean()
})

/** R-8.2 — an Exile the winner offered Citizenship, and their answer once given (R-X.1). */
export type ChronicleOffer = Type.Static<typeof ChronicleOffer>
export const ChronicleOffer = Type.Object({
    playerId: Type.String(),
    accepted: Type.Optional(Type.Boolean())
})

/** R-8.2 — the players the flip turned to their Exile side, then the offers, made together (R-8.2-H1). */
export type ChronicleCitizenship = Type.Static<typeof ChronicleCitizenship>
export const ChronicleCitizenship = Type.Object({
    /** The players whose Citizen boards just flipped: no offer goes to them. */
    flippedPlayerIds: Type.Array(Type.String()),
    /** Absent until the winner offers; empty when they offer no one. */
    offers: Type.Optional(Type.Array(ChronicleOffer))
})

/** R-8.4.a-H1 — the Dispossessed stacks tied for the most cards, published before anyone chooses. */
export type ChronicleHealTie = Type.Static<typeof ChronicleHealTie>
export const ChronicleHealTie = Type.Object({
    suits: Type.Array(Type.Enum(Suit)),
    count: Type.Number()
})

/** A site card in a map slot. */
export type ChronicleSiteAt = Type.Static<typeof ChronicleSiteAt>
export const ChronicleSiteAt = Type.Object({
    slotId: Type.String(),
    siteCardId: Type.String()
})

/** R-8.3.3 — an edifice flipped to its ruined side, and the denizens discarded at its site. */
export type ChronicleRuin = Type.Static<typeof ChronicleRuin>
export const ChronicleRuin = Type.Object({
    edificeId: Type.String(),
    siteCardId: Type.String(),
    denizensDiscarded: Type.Number()
})

/** R-8.3.5 — a site that changed slot, with its cards, and each slot's region. */
export type ChronicleMove = Type.Static<typeof ChronicleMove>
export const ChronicleMove = Type.Object({
    siteCardId: Type.String(),
    from: Type.String(),
    to: Type.String(),
    fromRegion: Type.Enum(Region),
    toRegion: Type.Enum(Region)
})

/** R-8.3.2 — why a site stayed: the winner rules it, it holds an intact edifice, or Forest Temple keeps it. */
export enum ChronicleKeptFor {
    Ruled = 'ruled',
    Edifice = 'edifice',
    ForestTemple = 'forestTemple'
}

/**
 * R-8.3.2 to R-8.3.5 — the map step as the table saw it, recorded by its System Action: faceup
 * sites by card, facedown ones counted (R-9.4).
 */
export type ChronicleMapRecord = Type.Static<typeof ChronicleMapRecord>
export const ChronicleMapRecord = Type.Object({
    /** R-8.3.2 — the sites kept, in deal order; every one is faceup. */
    kept: Type.Array(Type.String()),
    /** R-8.3.2 — each kept site's reason, by card, the first that holds in the order above. */
    keptFor: Type.Optional(Type.Record(Type.String(), Type.Enum(ChronicleKeptFor))),
    /** R-8.3.2 — the faceup sites shuffled into the site deck. */
    discarded: Type.Array(Type.String()),
    /** R-8.3.2 — the facedown sites shuffled into the site deck. */
    discardedFacedown: Type.Number(),
    /** R-8.3.2 — the denizens at the discarded sites. */
    denizensDiscarded: Type.Number(),
    /** R-8.3.3 */
    ruins: Type.Array(ChronicleRuin),
    /** R-8.3.5 steps 1 to 5 */
    moved: Type.Array(ChronicleMove),
    /** R-8.3.5 step 6 — the slots dealt a facedown site. */
    dealt: Type.Array(Type.String()),
    /** R-8.3.5 step 7 */
    flipped: Type.Array(ChronicleSiteAt)
})

/**
 * R-8.6 — the relics as the table saw them move, recorded by its System Action: counts, never
 * which (R-9.4).
 */
export type ChronicleRelicsRecord = Type.Static<typeof ChronicleRelicsRecord>
export const ChronicleRelicsRecord = Type.Object({
    /** R-8.6.1 — each losing player's relics returned to the relic deck. */
    returned: Type.Array(Type.Object({ playerId: Type.String(), count: Type.Number() })),
    /** R-8.6.2 — each faceup site given facedown relics, by slot and site card. */
    placed: Type.Array(
        Type.Object({ slotId: Type.String(), siteCardId: Type.String(), count: Type.Number() })
    ),
    /** R-8.6.3 — the winner's relics and the Reliquary's stacked on top of the relic deck. */
    stacked: Type.Object({ winner: Type.Number(), reliquary: Type.Number() })
})

/**
 * R-8 — present from the win; `step` is the step being written, absent before the first and once
 * the last is done. What a step did is its Action's record: State keeps only what a later rule
 * reads, and once the entry is written only the ending, the Oath vowed and the rebuild.
 */
export type Chronicle = Type.Static<typeof Chronicle>
export const Chronicle = Type.Object({
    ending: ChronicleEnding,
    step: Type.Optional(Type.Enum(ChronicleStep)),
    /** R-8.1 — the Oath the next game is played under; the continuation reads it. */
    vowedOath: Type.Optional(Type.Enum(OathType)),
    /** R-8.2, an Exile winner only: who may be offered, and the answers the step waits on. */
    citizenship: Type.Optional(ChronicleCitizenship),
    /** R-8.3.1, for the entry. */
    built: Type.Optional(ChronicleBuilt),
    /**
     * R-8.3.1 — the denizen a build replaced, bound for the world deck. Its place there is never
     * observable, since R-8.8 shuffles every denizen in play into the new deck, so it waits here,
     * public, until then.
     */
    returnedDenizenId: Type.Optional(Type.String()),
    /** R-8.3.3 — the edifices flipped to their ruined side, for the entry. */
    ruined: Type.Optional(Type.Array(Type.String())),
    /** R-8.4 — the most common suit in the winner's advisers, or the one they chose among the tied. */
    suit: Type.Optional(Type.Enum(Suit)),
    /** R-8.4.a-H1 */
    healTie: Type.Optional(ChronicleHealTie),
    /** R-8.4.a-H1 — the tied stack the winner chose. */
    healSuit: Type.Optional(Type.Enum(Suit)),
    /** R-8.4, R-8.4.a, once done: the entry and the explorations read it. */
    added: Type.Optional(ChronicleAdded),
    /** R-8.5 — how many cards went to the Dispossessed, once done: the explorations read it. */
    dispossessed: Type.Optional(Type.Number()),
    /** R-8.8, once done: the continuation reads it. */
    rebuilt: Type.Optional(Type.Literal(true)),
    /** The winner's story, held only inside the action that writes it, until the record's entry takes it. */
    story: Type.Optional(Type.String())
})

/** One game of the chronicle, written once when its Chronicle phase ends and never edited. */
export type ChronicleEntry = Type.Static<typeof ChronicleEntry>
export const ChronicleEntry = Type.Object({
    /** The earlier entries' count plus one. */
    gameNumber: Type.Number(),
    sessionName: Type.String(),
    /** YYYY-MM-DD, UTC. */
    date: Type.String(),
    /** The Oath this game was played under. */
    startingOath: Type.Enum(OathType),
    /** R-3 — how it was won; its kind and mark follow from the rule. */
    rule: Type.Enum(WIN_RULES),
    winner: ChronicleSeat,
    /** R-8.1 */
    nextOath: Type.Optional(Type.Enum(OathType)),
    added: Type.Optional(ChronicleAdded),
    /** R-8.2 — the Exiles who accepted Citizenship. */
    citizens: Type.Optional(Type.Array(ChronicleSeat)),
    built: Type.Optional(ChronicleBuilt),
    /** R-8.3.3 — edifices flipped to their ruined side. */
    ruined: Type.Optional(Type.Array(Type.String())),
    /** The winner's own words, the only free text in the record. */
    story: Type.Optional(Type.String())
})

/** The table as it was when the game started: its name, the date and each seat's name. */
export type TableRecord = Type.Static<typeof TableRecord>
export const TableRecord = Type.Object({
    name: Type.String(),
    /** YYYY-MM-DD, UTC. */
    date: Type.String(),
    seatNames: Type.Record(Type.String(), Type.String())
})

/** R-1.7-H1 — why a continued game's Chancellor is who they are. */
export enum OpeningChancellor {
    /** The last game's winner, playing again. */
    Winner = 'winner',
    /** A returning player whose board was on its Citizen side, at random among them. */
    Citizen = 'citizen',
    /** Neither: a player at random. */
    Random = 'random'
}

/** R-8.7.2, R-1.9 — the side a board was saved on. */
export enum BoardSide {
    Exile = 'exile',
    Citizen = 'citizen'
}

/** R-1.9-H1 — a non-Chancellor's board as a continued game opens. */
export type OpeningBoard = Type.Static<typeof OpeningBoard>
export const OpeningBoard = Type.Object({
    playerId: Type.String(),
    color: Type.Enum(Color),
    side: Type.Enum(BoardSide),
    /** The colour they played in the last game; otherwise dealt at random from the free boards. */
    kept: Type.Boolean()
})

/**
 * R-1.7-H1, R-1.9-H1 — how a continued game's seats were settled: the setup's outcome, written
 * once by the initializer (the only code that sees the finished game) and never changed. No rule
 * reads it; the History's opening rows do, before any action exists to carry it. Present only in
 * a continued game.
 */
export type OpeningSeats = Type.Static<typeof OpeningSeats>
export const OpeningSeats = Type.Object({
    /** For `Winner`, the game they won is the record's last entry as this game opens. */
    chancellor: Type.Object({
        playerId: Type.String(),
        chosen: Type.Enum(OpeningChancellor)
    }),
    /** The other seats, in turn order. */
    boards: Type.Array(OpeningBoard, { maxItems: 5 })
})
