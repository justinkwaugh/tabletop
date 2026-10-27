import { Color } from '@tabletop/common'
import * as Type from 'typebox'
import { OathType, Suit } from './oathEnums.js'
import { WIN_RULES, WinKind } from './ending.js'

/**
 * R-8 — what a won game writes at its end, and the record a chronicle keeps. Every field is public
 * and every later field optional: a stored final state is validated again under later revisions.
 */

/** The winner's story: at most this many characters, counted as Unicode code points. */
export const CHRONICLE_STORY_LIMIT = 500

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
    /** R-8.7 */
    Save = 'save',
    /** R-8.8 */
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

/** R-3 — the win as decided, stored once by the action that won. */
export type ChronicleEnding = Type.Static<typeof ChronicleEnding>
export const ChronicleEnding = Type.Object({
    winnerPlayerId: Type.String(),
    kind: Type.Enum(WinKind),
    rule: Type.Enum(WIN_RULES),
    mark: Type.Enum(ChronicleMark),
    waysMet: ChronicleWaysMet
})

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
    repaired: Type.Boolean()
})

/** R-8.2 — an Exile the winner offered Citizenship, and their answer once given (R-X.1). */
export type ChronicleOffer = Type.Static<typeof ChronicleOffer>
export const ChronicleOffer = Type.Object({
    playerId: Type.String(),
    accepted: Type.Optional(Type.Boolean())
})

/** R-8.2 — the boards the flip turned to their Exile side, then the offers, made together (R-8.2-H1). */
export type ChronicleCitizenship = Type.Static<typeof ChronicleCitizenship>
export const ChronicleCitizenship = Type.Object({
    /** The players whose Citizen boards just flipped: no offer goes to them. */
    flippedPlayerIds: Type.Array(Type.String()),
    /** The colours of the Citizen boards in the box that flipped with them. */
    flippedBoxColors: Type.Array(Type.Enum(Color)),
    /** Absent until the winner offers; empty when they offer no one. */
    offers: Type.Optional(Type.Array(ChronicleOffer))
})

/** R-8.4.a-H1 — the Dispossessed stacks tied for the most cards, published before anyone chooses. */
export type ChronicleHealTie = Type.Static<typeof ChronicleHealTie>
export const ChronicleHealTie = Type.Object({
    suits: Type.Array(Type.Enum(Suit)),
    count: Type.Number()
})

/** R-8 — present from the win; `step` is the step being written, absent once the last is done. */
export type Chronicle = Type.Static<typeof Chronicle>
export const Chronicle = Type.Object({
    ending: ChronicleEnding,
    step: Type.Optional(Type.Enum(ChronicleStep)),
    /** R-8.1 — the Oath the next game is played under. */
    vowedOath: Type.Optional(Type.Enum(OathType)),
    /** R-8.1 — the Vision a win with a Vision alone vowed by; absent when the winner chose. */
    vowedByVisionId: Type.Optional(Type.String()),
    /** R-8.2, an Exile winner only. */
    citizenship: Type.Optional(ChronicleCitizenship),
    /** R-8.3.1 */
    built: Type.Optional(ChronicleBuilt),
    /**
     * R-8.3.1 — the denizen a build replaced, bound for the world deck. Its place there is never
     * observable, since R-8.8 shuffles every denizen in play into the new deck, so it waits here,
     * public, until then.
     */
    returnedDenizenId: Type.Optional(Type.String()),
    /** R-8.4 — the most common suit in the winner's advisers, or the one they chose among the tied. */
    suit: Type.Optional(Type.Enum(Suit)),
    /** R-8.4.a-H1 */
    healTie: Type.Optional(ChronicleHealTie),
    /** R-8.4.a-H1 — the tied stack the winner chose. */
    healSuit: Type.Optional(Type.Enum(Suit)),
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
    mark: Type.Enum(ChronicleMark),
    kind: Type.Enum(WinKind),
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
