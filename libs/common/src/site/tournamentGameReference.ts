import * as Type from 'typebox'

export const TournamentGameReference = Type.Object(
    {
        tournamentId: Type.String(),
        stageId: Type.String(),
        tableId: Type.String(),
        scheduleId: Type.String(),
        // A restarted Table's later Game; absent for its first.
        attempt: Type.Optional(Type.Integer({ minimum: 1 }))
    },
    { additionalProperties: false }
)
export type TournamentGameReference = Type.Static<typeof TournamentGameReference>
