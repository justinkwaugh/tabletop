import * as Type from 'typebox'
import { GameConfig } from '../game/model/gameConfig.js'
import { getMiniTournamentDefaults, Tournament } from './tournament.js'

export const LeagueShape = Type.Union([Type.Literal('ladder'), Type.Literal('pyramid')])
export type LeagueShape = Type.Static<typeof LeagueShape>

export const LeagueGroupSizes = Type.Object(
    {
        groupSize: Type.Integer({ minimum: 2, maximum: 64 }),
        bottomMinimum: Type.Integer({ minimum: 2, maximum: 64 }),
        bottomMaximum: Type.Integer({ minimum: 2, maximum: 128 })
    },
    { additionalProperties: false }
)
export type LeagueGroupSizes = Type.Static<typeof LeagueGroupSizes>

export function leagueGroupSizesFor(tableSize: number): LeagueGroupSizes | undefined {
    const groupSize = getMiniTournamentDefaults(tableSize)?.capacity
    if (groupSize === undefined) return undefined
    const bottomMinimum = groupSize - 2
    return { groupSize, bottomMinimum, bottomMaximum: bottomMinimum + groupSize - 1 }
}

export function leagueGroupsAtLevel(shape: LeagueShape, level: number): number {
    return shape === 'ladder' ? 1 : 2 ** level
}

export function leagueLevelName(level: number): string {
    let name = ''
    for (let remaining = level + 1; remaining > 0; remaining = Math.floor((remaining - 1) / 26))
        name = String.fromCharCode(65 + ((remaining - 1) % 26)) + name
    return name
}

export function leagueGroupName(shape: LeagueShape, level: number, index: number): string {
    const levelName = leagueLevelName(level)
    return leagueGroupsAtLevel(shape, level) === 1 ? levelName : `${levelName}${index + 1}`
}

export function leagueMinimumEntrants(shape: LeagueShape, sizes: LeagueGroupSizes): number {
    return sizes.groupSize * (leagueGroupsAtLevel(shape, 0) + leagueGroupsAtLevel(shape, 1))
}

export const LeagueId = Type.String({ pattern: '^[a-zA-Z0-9_-]{1,128}$' })

export const LeagueRules = Type.Object(
    {
        titleId: LeagueId,
        tableSize: Type.Integer({ minimum: 2, maximum: 16 }),
        gamesPerEntrant: Type.Integer({ minimum: 1, maximum: 256 }),
        concurrency: Type.Integer({ minimum: 1, maximum: 256 }),
        gameConfig: GameConfig,
        scoring: Type.Literal('splitWinsV1'),
        sizes: LeagueGroupSizes
    },
    { additionalProperties: false }
)
export type LeagueRules = Type.Static<typeof LeagueRules>

export const leagueSignUpDays = { minimum: 1, maximum: 60 } as const

export const LeagueSignUpPolicy = Type.Object(
    {
        opensAutomatically: Type.Boolean(),
        days: Type.Integer(leagueSignUpDays)
    },
    { additionalProperties: false }
)
export type LeagueSignUpPolicy = Type.Static<typeof LeagueSignUpPolicy>

export const LeagueDraftRules = Type.Omit(LeagueRules, ['sizes'])
export type LeagueDraftRules = Type.Static<typeof LeagueDraftRules>

export const LeagueDraft = Type.Object(
    {
        name: Type.String({ minLength: 1, maxLength: 120 }),
        description: Type.String({ maxLength: 2000 }),
        shape: LeagueShape,
        rules: LeagueDraftRules,
        signUp: LeagueSignUpPolicy
    },
    { additionalProperties: false }
)
export type LeagueDraft = Type.Static<typeof LeagueDraft>

export const League = Type.Object(
    {
        ...LeagueDraft.properties,
        rules: LeagueRules,
        id: LeagueId,
        organizerId: Type.String(),
        status: Type.Union([Type.Literal('draft'), Type.Literal('active')]),
        currentSeason: Type.Optional(Type.Integer({ minimum: 0 })),
        revision: Type.Integer({ minimum: 1 }),
        createdAt: Type.Integer(),
        updatedAt: Type.Integer(),
        publishedAt: Type.Optional(Type.Integer())
    },
    { additionalProperties: false }
)
export type League = Type.Static<typeof League>

export const LeagueHeldPlace = Type.Object(
    {
        userId: Type.String(),
        level: Type.Integer({ minimum: 0 }),
        // Relegated into this Level last Season, so not moved down again when a Level is added.
        relegated: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type LeagueHeldPlace = Type.Static<typeof LeagueHeldPlace>

export const LeagueNewEntrant = Type.Object(
    { userId: Type.String(), joinedAt: Type.Integer() },
    { additionalProperties: false }
)
export type LeagueNewEntrant = Type.Static<typeof LeagueNewEntrant>

export const LeagueSeasonGroup = Type.Object(
    {
        groupId: Type.String(),
        level: Type.Integer({ minimum: 0 }),
        tournamentId: Type.String(),
        entrantIds: Type.Array(Type.String(), { maxItems: 256 }),
        // The accounts playing the Group now, once a Substitute or a Withdrawal changes them.
        accounts: Type.Optional(Type.Array(Type.String(), { maxItems: 256 }))
    },
    { additionalProperties: false }
)
export type LeagueSeasonGroup = Type.Static<typeof LeagueSeasonGroup>

export const LeagueMovement = Type.Union([
    Type.Literal('promoted'),
    Type.Literal('relegated'),
    Type.Literal('stayed'),
    Type.Literal('seeded')
])
export type LeagueMovement = Type.Static<typeof LeagueMovement>

export const LeagueSeasonPlacement = Type.Object(
    {
        userId: Type.String(),
        groupId: Type.String(),
        level: Type.Integer({ minimum: 0 }),
        place: Type.Integer({ minimum: 1 }),
        movement: LeagueMovement,
        nextLevel: Type.Integer({ minimum: 0 }),
        // A Substitute finished this place: its movement goes to nobody, and the Substitute
        // holds a place at the Bottom Level next Season.
        substituteId: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)
export type LeagueSeasonPlacement = Type.Static<typeof LeagueSeasonPlacement>

export const LeagueFinalPlacement = Type.Object(
    {
        ...LeagueSeasonPlacement.properties,
        wins: Type.Integer({ minimum: 0 }),
        score: Type.Number({ minimum: 0 }),
        completed: Type.Integer({ minimum: 0 }),
        tiebreak: Type.Optional(Type.Number())
    },
    { additionalProperties: false }
)
export type LeagueFinalPlacement = Type.Static<typeof LeagueFinalPlacement>

export const LeagueSeason = Type.Object(
    {
        leagueId: LeagueId,
        number: Type.Integer({ minimum: 0 }),
        status: Type.Union([
            Type.Literal('signUp'),
            Type.Literal('starting'),
            Type.Literal('inProgress'),
            Type.Literal('finished'),
            Type.Literal('cancelled')
        ]),
        seeding: Type.Boolean(),
        shape: LeagueShape,
        rules: LeagueRules,
        seed: Type.Integer({ minimum: 0 }),
        signUpClosesAt: Type.Integer(),
        heldPlaces: Type.Array(LeagueHeldPlace),
        heldFrom: Type.Optional(Type.Integer({ minimum: 0 })),
        confirmedIds: Type.Array(Type.String()),
        newEntrants: Type.Array(LeagueNewEntrant),
        undersubscribed: Type.Optional(Type.Boolean()),
        groups: Type.Optional(Type.Array(LeagueSeasonGroup)),
        placements: Type.Optional(Type.Array(LeagueFinalPlacement)),
        nextTaskAt: Type.Optional(Type.Integer()),
        error: Type.Optional(Type.String({ maxLength: 512 })),
        revision: Type.Integer({ minimum: 1 }),
        createdAt: Type.Integer(),
        updatedAt: Type.Integer(),
        startedAt: Type.Optional(Type.Integer()),
        finishedAt: Type.Optional(Type.Integer()),
        cancelledAt: Type.Optional(Type.Integer()),
        announcedAt: Type.Optional(Type.Integer()),
        remindedFor: Type.Optional(Type.Integer()),
        startAnnouncedAt: Type.Optional(Type.Integer()),
        resultsEmailedAt: Type.Optional(Type.Integer())
    },
    { additionalProperties: false }
)
export type LeagueSeason = Type.Static<typeof LeagueSeason>

export const LeagueGroupStanding = Type.Object({
    userId: Type.String(),
    // The Substitute playing or who finished the place, when it is not the Entrant.
    playedBy: Type.Optional(Type.String()),
    withdrawn: Type.Optional(Type.Literal(true)),
    place: Type.Integer({ minimum: 1 }),
    wins: Type.Integer({ minimum: 0 }),
    score: Type.Number({ minimum: 0 }),
    completed: Type.Integer({ minimum: 0 }),
    tiebreak: Type.Optional(Type.Number()),
    active: Type.Integer({ minimum: 0 }),
    // Games that will never count because a player was withdrawn or the game was abandoned.
    voided: Type.Optional(Type.Integer({ minimum: 0 })),
    movement: Type.Optional(LeagueMovement),
    nextLevel: Type.Optional(Type.Integer({ minimum: 0 }))
})
export type LeagueGroupStanding = Type.Static<typeof LeagueGroupStanding>

export const LeagueGroupDetail = Type.Object({
    ...LeagueSeasonGroup.properties,
    tournamentStatus: Tournament.properties.status,
    finishedGames: Type.Integer({ minimum: 0 }),
    activeGames: Type.Integer({ minimum: 0 }),
    totalGames: Type.Integer({ minimum: 0 }),
    standings: Type.Array(LeagueGroupStanding)
})
export type LeagueGroupDetail = Type.Static<typeof LeagueGroupDetail>

export const LeagueMyPlace = Type.Union([
    Type.Object({
        status: Type.Literal('signedUp'),
        level: Type.Optional(Type.Integer({ minimum: 0 }))
    }),
    Type.Object({ status: Type.Literal('held'), level: Type.Integer({ minimum: 0 }) }),
    Type.Object({
        status: Type.Literal('inGroup'),
        level: Type.Integer({ minimum: 0 }),
        groupId: Type.String()
    })
])
export type LeagueMyPlace = Type.Static<typeof LeagueMyPlace>

export const LeagueSeasonSummary = Type.Object({
    number: Type.Integer({ minimum: 0 }),
    seeding: Type.Boolean(),
    status: LeagueSeason.properties.status,
    signUpClosesAt: Type.Integer(),
    undersubscribed: Type.Optional(Type.Boolean()),
    players: Type.Integer({ minimum: 0 }),
    minimumPlayers: Type.Integer({ minimum: 0 }),
    myPlace: Type.Optional(LeagueMyPlace)
})
export type LeagueSeasonSummary = Type.Static<typeof LeagueSeasonSummary>

export const LeagueSeasonDetail = Type.Object({
    league: League,
    season: Type.Optional(LeagueSeason),
    summary: Type.Optional(LeagueSeasonSummary),
    groups: Type.Array(LeagueGroupDetail),
    usernames: Type.Record(Type.String(), Type.String())
})
export type LeagueSeasonDetail = Type.Static<typeof LeagueSeasonDetail>

export const LeagueListEntry = Type.Object({
    league: League,
    season: Type.Optional(LeagueSeasonSummary)
})
export type LeagueListEntry = Type.Static<typeof LeagueListEntry>

export const LeagueList = Type.Object({ leagues: Type.Array(LeagueListEntry) })
export type LeagueList = Type.Static<typeof LeagueList>

export const LeagueParams = Type.Object({ id: LeagueId }, { additionalProperties: false })
export const LeagueSeasonParams = Type.Object(
    { id: LeagueId, season: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export const CreateLeagueRequest = Type.Object(
    { id: LeagueId, draft: LeagueDraft },
    { additionalProperties: false }
)
export const UpdateLeagueRequest = Type.Object(
    { draft: LeagueDraft, revision: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export const leagueSignUpOperations = ['publish', 'seasons/next', 'signUp/close'] as const
export type LeagueSignUpOperation = (typeof leagueSignUpOperations)[number]

export const leagueEntrantOperations = ['signUp', 'withdraw'] as const
export type LeagueEntrantOperation = (typeof leagueEntrantOperations)[number]

export const LeagueSignUpCloseRequest = Type.Object(
    { closesAt: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type LeagueSignUpCloseRequest = Type.Static<typeof LeagueSignUpCloseRequest>

export const LeagueState = Type.Object({ league: League, season: Type.Optional(LeagueSeason) })
export type LeagueState = Type.Static<typeof LeagueState>

export const LeagueAllocatedGroup = Type.Omit(LeagueSeasonGroup, ['tournamentId'])
export type LeagueAllocatedGroup = Type.Static<typeof LeagueAllocatedGroup>

export const LeagueAllocationPreview = Type.Object({
    groups: Type.Union([Type.Array(LeagueAllocatedGroup), Type.Null()])
})
export type LeagueAllocationPreview = Type.Static<typeof LeagueAllocationPreview>
