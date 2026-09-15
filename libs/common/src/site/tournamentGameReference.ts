import * as Type from 'typebox'

export const TournamentGameReference = Type.Object(
    {
        tournamentId: Type.String(),
        stageId: Type.String(),
        tableId: Type.String(),
        scheduleId: Type.String()
    },
    { additionalProperties: false }
)
export type TournamentGameReference = Type.Static<typeof TournamentGameReference>
