import * as Type from 'typebox'
import { GameResult } from '../game/model/gameResult.js'
import { GameConfig } from '../game/model/gameConfig.js'
import { TournamentGameReference } from './tournamentGameReference.js'
import { LeagueGroupReference } from './leagueGroupReference.js'
import { assertExists } from '../util/assertions.js'
import type { TournamentTable } from './tournamentSchedule.js'

export const miniTournamentDefaults = {
    2: { capacity: 5, gamesPerEntrant: 4 },
    3: { capacity: 7, gamesPerEntrant: 3 },
    4: { capacity: 7, gamesPerEntrant: 4 },
    5: { capacity: 11, gamesPerEntrant: 5 }
} as const

export function getMiniTournamentDefaults(tableSize: number) {
    switch (tableSize) {
        case 2:
        case 3:
        case 4:
        case 5:
            return miniTournamentDefaults[tableSize]
    }
    return undefined
}

export const TournamentId = Type.String({ pattern: '^[a-zA-Z0-9_-]{1,128}$' })
export const TournamentStagePlan = Type.Object(
    {
        id: TournamentId,
        name: Type.String({ minLength: 1, maxLength: 80 }),
        gamesPerEntrant: Type.Integer({ minimum: 1, maximum: 256 })
    },
    { additionalProperties: false }
)
export type TournamentStagePlan = Type.Static<typeof TournamentStagePlan>

export const TournamentFormat = Type.Union([
    Type.Object(
        { kind: Type.Literal('mini'), stages: Type.Tuple([TournamentStagePlan]) },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            kind: Type.Literal('multiStage'),
            stages: Type.Array(TournamentStagePlan, { minItems: 2, maxItems: 32 })
        },
        { additionalProperties: false }
    )
])
export type TournamentFormat = Type.Static<typeof TournamentFormat>

export const TournamentRegistrationPolicy = Type.Union([
    Type.Object(
        { kind: Type.Literal('whenFull'), capacity: Type.Integer({ minimum: 2, maximum: 256 }) },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            kind: Type.Literal('deadline'),
            minimumEntrants: Type.Integer({ minimum: 2, maximum: 256 }),
            closesAt: Type.Integer({ minimum: 1 }),
            capacity: Type.Optional(Type.Integer({ minimum: 2, maximum: 256 }))
        },
        { additionalProperties: false }
    ),
    Type.Object({ kind: Type.Literal('assigned') }, { additionalProperties: false })
])
export type TournamentRegistrationPolicy = Type.Static<typeof TournamentRegistrationPolicy>

// Registration Policies players join themselves; the public lists show only these Tournaments.
export const selfRegistrationKinds = ['whenFull', 'deadline'] as const satisfies readonly Exclude<
    TournamentRegistrationPolicy['kind'],
    'assigned'
>[]

export function tournamentCapacity(policy: TournamentRegistrationPolicy): number | undefined {
    return policy.kind === 'assigned' ? undefined : policy.capacity
}
export const TournamentRules = Type.Object(
    {
        titleId: TournamentId,
        tableSize: Type.Integer({ minimum: 2, maximum: 16 }),
        registration: TournamentRegistrationPolicy,
        concurrency: Type.Integer({ minimum: 1, maximum: 256 }),
        gameConfig: GameConfig,
        scoring: Type.Literal('splitWinsV1')
    },
    { additionalProperties: false }
)
export type TournamentRules = Type.Static<typeof TournamentRules>

export const TournamentDraft = Type.Object(
    {
        name: Type.String({ minLength: 1, maxLength: 120 }),
        description: Type.String({ maxLength: 2000 }),
        rules: TournamentRules,
        format: TournamentFormat
    },
    { additionalProperties: false }
)
export type TournamentDraft = Type.Static<typeof TournamentDraft>

export const TournamentAdministration = Type.Object(
    { administratorId: Type.String(), createdAt: Type.Integer() },
    { additionalProperties: false }
)
export type TournamentAdministration = Type.Static<typeof TournamentAdministration>

export const TournamentSubstitute = Type.Object(
    { ...TournamentAdministration.properties, userId: Type.String() },
    { additionalProperties: false }
)
export type TournamentSubstitute = Type.Static<typeof TournamentSubstitute>

export const TournamentEntrant = Type.Object(
    {
        // The place's key in schedules and standings; a Substitute plays it under another account.
        userId: Type.String(),
        joinedAt: Type.Integer(),
        substitutes: Type.Optional(Type.Array(TournamentSubstitute, { maxItems: 16 })),
        withdrawn: Type.Optional(TournamentAdministration)
    },
    { additionalProperties: false }
)
export type TournamentEntrant = Type.Static<typeof TournamentEntrant>

/** The account playing an Entrant's place now. */
export function tournamentEntrantAccount(entrant: TournamentEntrant): string {
    return entrant.substitutes?.at(-1)?.userId ?? entrant.userId
}

/** Every account that has played an Entrant's place, first to last. */
export function tournamentEntrantAccounts(entrant: TournamentEntrant): string[] {
    return [entrant.userId, ...(entrant.substitutes ?? []).map((substitute) => substitute.userId)]
}

/** The place an account has played in, or -1. */
export function tournamentEntrantIndex(
    tournament: Pick<Tournament, 'entrants'>,
    userId: string
): number {
    return tournament.entrants.findIndex((entrant) =>
        tournamentEntrantAccounts(entrant).includes(userId)
    )
}

/** The accounts to seat at a Table, from the Entrant keys the Schedule assigned to it. */
export function tournamentSeatAccounts(
    tournament: Pick<Tournament, 'entrants'>,
    entrantIds: string[]
): string[] {
    return entrantIds.map((userId) => {
        const entrant = tournament.entrants.find((value) => value.userId === userId)
        assertExists(entrant, `Scheduled player ${userId} is not an entrant`)
        return tournamentEntrantAccount(entrant)
    })
}

export function tournamentInPlay(status: Tournament['status']): boolean {
    return status === 'locked' || status === 'inProgress'
}

/** Whether a Table's Game has started or will never start. */
export function tournamentTableSettled(
    dispatch: TournamentDispatch | undefined,
    tableId: string
): boolean {
    return (
        !!dispatch &&
        (dispatch.active.includes(tableId) ||
            dispatch.finished.includes(tableId) ||
            !!dispatch.voided?.includes(tableId))
    )
}

/** The reference for a Table's current Game, including a restarted Table's attempt. */
export function tournamentTableReference(
    tournamentId: string,
    stage: Pick<TournamentStage, 'id' | 'scheduleId' | 'dispatch'>,
    tableId: string
): TournamentGameReference {
    assertExists(stage.scheduleId, 'The stage has no schedule')
    const attempt = stage.dispatch?.attempts?.[tableId]
    return {
        tournamentId,
        stageId: stage.id,
        tableId,
        scheduleId: stage.scheduleId,
        ...(attempt ? { attempt } : {})
    }
}

/** The Tables with a Game in progress at which an Entrant's place sits. */
export function tournamentActiveTables(
    tournament: Pick<Tournament, 'stages'>,
    tables: Pick<TournamentTable, 'id' | 'entrantIds'>[],
    entrantId: string
): string[] {
    const active = new Set(tournament.stages[0]?.dispatch?.active ?? [])
    return tables
        .filter((table) => active.has(table.id) && table.entrantIds.includes(entrantId))
        .map((table) => table.id)
}

export function tournamentAccountIds(tournament: Pick<Tournament, 'entrants'>): string[] {
    return tournament.entrants.flatMap((entrant) => tournamentEntrantAccounts(entrant))
}

export const TournamentDispatch = Type.Object({
    reserved: Type.Array(Type.String(), { maxItems: 32768 }),
    active: Type.Array(Type.String(), { maxItems: 32768 }),
    finished: Type.Array(Type.String(), { maxItems: 32768 }),
    // Tables that will never count: their Game was abandoned or a player was withdrawn.
    voided: Type.Optional(Type.Array(Type.String(), { maxItems: 32768 })),
    // Restarted Tables and the attempt their next Game belongs to.
    attempts: Type.Optional(Type.Record(Type.String(), Type.Integer({ minimum: 1 })))
})
export type TournamentDispatch = Type.Static<typeof TournamentDispatch>

export const TournamentScore = Type.Object({
    wins: Type.Integer({ minimum: 0 }),
    score: Type.Number({ minimum: 0 }),
    completed: Type.Integer({ minimum: 0 }),
    tiebreak: Type.Optional(Type.Number())
})
export type TournamentScore = Type.Static<typeof TournamentScore>

export const TournamentStanding = Type.Object({
    ...TournamentScore.properties,
    userId: Type.String(),
    // The Substitute now playing the place, when it is not the Entrant.
    playedBy: Type.Optional(Type.String()),
    withdrawn: Type.Optional(Type.Literal(true)),
    // Wins the finished Tournament: the best place no Substitute played.
    champion: Type.Optional(Type.Literal(true)),
    rank: Type.Integer({ minimum: 1 }),
    active: Type.Integer({ minimum: 0 }),
    remaining: Type.Integer({ minimum: 0 })
})
export type TournamentStanding = Type.Static<typeof TournamentStanding>

export const TournamentResultCorrection = Type.Object({
    tableId: TournamentId,
    winningUserIds: Type.Array(Type.String(), { minItems: 1, maxItems: 16 }),
    administratorId: Type.String(),
    reason: Type.String({ minLength: 1, maxLength: 1000 }),
    createdAt: Type.Integer(),
    gameActionCount: Type.Integer({ minimum: 0 })
})
export type TournamentResultCorrection = Type.Static<typeof TournamentResultCorrection>

export const CorrectTournamentResultRequest = Type.Object(
    {
        revision: Type.Integer({ minimum: 1 }),
        tableId: TournamentId,
        winningUserIds: Type.Array(Type.String(), { minItems: 1, maxItems: 16 }),
        reason: Type.String({ minLength: 1, maxLength: 1000 })
    },
    { additionalProperties: false }
)
export type CorrectTournamentResultRequest = Type.Static<typeof CorrectTournamentResultRequest>

export const WithdrawTournamentEntrantRequest = Type.Object(
    { revision: Type.Integer({ minimum: 1 }), userId: Type.String() },
    { additionalProperties: false }
)
export type WithdrawTournamentEntrantRequest = Type.Static<typeof WithdrawTournamentEntrantRequest>

export const TournamentTableHandover = Type.Union([
    Type.Literal('takeOver'),
    Type.Literal('restart')
])
export type TournamentTableHandover = Type.Static<typeof TournamentTableHandover>

export const SubstituteTournamentEntrantRequest = Type.Object(
    {
        revision: Type.Integer({ minimum: 1 }),
        // The account playing the place now.
        userId: Type.String(),
        substituteUsername: Type.String({ minLength: 1, maxLength: 64 }),
        // How each Table the place is playing passes to the Substitute; take over by default.
        tables: Type.Record(Type.String(), TournamentTableHandover)
    },
    { additionalProperties: false }
)
export type SubstituteTournamentEntrantRequest = Type.Static<
    typeof SubstituteTournamentEntrantRequest
>

export const TournamentStage = Type.Object(
    {
        id: TournamentId,
        status: Type.Union([Type.Literal('awaitingSchedule'), Type.Literal('scheduled')]),
        scheduleId: Type.Optional(Type.String()),
        scheduledAt: Type.Optional(Type.Integer()),
        dispatch: Type.Optional(TournamentDispatch),
        corrections: Type.Optional(Type.Array(TournamentResultCorrection)),
        standings: Type.Optional(Type.Array(TournamentScore, { maxItems: 256 })),
        rosterRevision: Type.Integer(),
        createdAt: Type.Integer()
    },
    { additionalProperties: false }
)
export type TournamentStage = Type.Static<typeof TournamentStage>

export const Tournament = Type.Object(
    {
        ...TournamentDraft.properties,
        id: TournamentId,
        organizerId: Type.String(),
        league: Type.Optional(LeagueGroupReference),
        status: Type.Union([
            Type.Literal('draft'),
            Type.Literal('open'),
            Type.Literal('locked'),
            Type.Literal('inProgress'),
            Type.Literal('finished'),
            Type.Literal('cancelled')
        ]),
        revision: Type.Integer({ minimum: 1 }),
        entrants: Type.Array(TournamentEntrant, { maxItems: 256 }),
        stages: Type.Array(TournamentStage, { maxItems: 32 }),
        createdAt: Type.Integer(),
        updatedAt: Type.Integer(),
        publishedAt: Type.Optional(Type.Integer()),
        lockedAt: Type.Optional(Type.Integer()),
        startsAt: Type.Optional(Type.Integer()),
        startId: Type.Optional(Type.String()),
        nextTaskAt: Type.Optional(Type.Integer()),
        paused: Type.Optional(Type.Boolean()),
        schedulingError: Type.Optional(Type.String({ maxLength: 512 })),
        finishedAt: Type.Optional(Type.Integer()),
        resultsEmailedAt: Type.Optional(Type.Integer()),
        cancelledAt: Type.Optional(Type.Integer()),
        cancellationReason: Type.Optional(
            Type.Union([Type.Literal('undersubscribed'), Type.Literal('administrator')])
        )
    },
    { additionalProperties: false }
)
export type Tournament = Type.Static<typeof Tournament>

export const TournamentGameLink = Type.Object({
    ...Type.Pick(TournamentGameReference, ['stageId', 'tableId', 'attempt']).properties,
    gameId: Type.String(),
    // The accounts seated at the Game, by position.
    userIds: Type.Optional(Type.Array(Type.String())),
    result: Type.Optional(Type.Enum(GameResult)),
    winningUserIds: Type.Optional(Type.Array(Type.String()))
})
export type TournamentGameLink = Type.Static<typeof TournamentGameLink>

export const TournamentDetail = Type.Object({
    tournament: Tournament,
    usernames: Type.Record(Type.String(), Type.String()),
    games: Type.Optional(Type.Array(TournamentGameLink)),
    standings: Type.Optional(Type.Array(TournamentStanding))
})
export type TournamentDetail = Type.Static<typeof TournamentDetail>

export const TournamentList = Type.Object({
    tournaments: Type.Array(Tournament),
    nextCursor: Type.Optional(Type.String())
})
export type TournamentList = Type.Static<typeof TournamentList>

export const TournamentTitles = Type.Object({
    titleIds: Type.Array(Type.String())
})
export type TournamentTitles = Type.Static<typeof TournamentTitles>

export const TournamentListQuery = Type.Object(
    {
        scope: Type.Union([
            Type.Literal('open'),
            Type.Literal('mine'),
            Type.Literal('inProgress'),
            Type.Literal('finished'),
            Type.Literal('draft')
        ]),
        after: Type.Optional(TournamentId),
        titleId: Type.Optional(Type.String({ minLength: 1, maxLength: 128 }))
    },
    { additionalProperties: false }
)
export type TournamentListQuery = Type.Static<typeof TournamentListQuery>

export const CreateTournamentRequest = Type.Object(
    { id: TournamentId, draft: TournamentDraft },
    { additionalProperties: false }
)
export const UpdateTournamentRequest = Type.Object(
    { draft: TournamentDraft, revision: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export const JoinTournamentRequest = Type.Object({}, { additionalProperties: false })
export const TournamentParams = Type.Object({ id: TournamentId }, { additionalProperties: false })
