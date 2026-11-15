import * as Type from 'typebox'

export const LeagueGroupReference = Type.Object(
    {
        leagueId: Type.String(),
        leagueName: Type.String(),
        seasonId: Type.String(),
        groupId: Type.String()
    },
    { additionalProperties: false }
)
export type LeagueGroupReference = Type.Static<typeof LeagueGroupReference>
