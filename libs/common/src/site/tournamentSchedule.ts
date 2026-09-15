import * as Type from 'typebox'

export const TournamentTable = Type.Object(
    {
        id: Type.String(),
        entrantIds: Type.Array(Type.String(), { minItems: 2, maxItems: 16, uniqueItems: true })
    },
    { additionalProperties: false }
)
export type TournamentTable = Type.Static<typeof TournamentTable>

export const TournamentScheduleQuality = Type.Object({
    opponentCounts: Type.Array(Type.Object({ games: Type.Integer(), pairs: Type.Integer() })),
    repeatedTables: Type.Integer(),
    openingTables: Type.Integer(),
    openingEntrants: Type.Integer()
})
export type TournamentScheduleQuality = Type.Static<typeof TournamentScheduleQuality>

export const TournamentSchedule = Type.Object({
    id: Type.String(),
    version: Type.Literal(1),
    seed: Type.Integer({ minimum: 0, maximum: 0xffffffff }),
    tournamentId: Type.String(),
    stageId: Type.String(),
    rosterRevision: Type.Integer(),
    entrantIds: Type.Array(Type.String(), { minItems: 2, maxItems: 256, uniqueItems: true }),
    tableSize: Type.Integer(),
    gamesPerEntrant: Type.Integer(),
    concurrency: Type.Integer(),
    quality: TournamentScheduleQuality,
    tables: Type.Array(TournamentTable)
})
export type TournamentSchedule = Type.Static<typeof TournamentSchedule>

export const TournamentScheduleRequest = Type.Object(
    {
        revision: Type.Integer({ minimum: 1 }),
        seed: Type.Integer({ minimum: 0, maximum: 0xffffffff }),
        version: Type.Literal(1)
    },
    { additionalProperties: false }
)
export type TournamentScheduleRequest = Type.Static<typeof TournamentScheduleRequest>

export const CommitTournamentScheduleRequest = Type.Object(
    {
        ...TournamentScheduleRequest.properties,
        scheduleId: Type.String({ pattern: '^[0-9a-f]{64}$' })
    },
    { additionalProperties: false }
)
export type CommitTournamentScheduleRequest = Type.Static<typeof CommitTournamentScheduleRequest>

export function tournamentScheduleParticipation(schedule: TournamentSchedule) {
    const players = schedule.entrantIds.map((entrantId) => ({
        entrantId,
        games: 0,
        positions: Array.from({ length: schedule.tableSize }, () => 0),
        opponents: new Map(
            schedule.entrantIds.filter((id) => id !== entrantId).map((id) => [id, 0])
        )
    }))
    const byId = new Map(players.map((player) => [player.entrantId, player]))
    for (const table of schedule.tables) {
        table.entrantIds.forEach((id, position) => {
            const player = byId.get(id)
            if (!player) throw new Error('Scheduled entrant is missing from the roster')
            player.games++
            player.positions[position]++
            for (const opponent of table.entrantIds) {
                if (opponent !== id)
                    player.opponents.set(opponent, (player.opponents.get(opponent) ?? 0) + 1)
            }
        })
    }
    return players
}

export function tournamentTableId(index: number): string {
    return String(index + 1).padStart(5, '0')
}
