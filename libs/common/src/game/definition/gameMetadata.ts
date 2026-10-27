import * as Type from 'typebox'

export enum GameVisibility {
    Public = 'public',
    Beta = 'beta',
    Alpha = 'alpha'
}

export const GameMetadata = Type.Object({
    name: Type.String(),
    bggId: Type.Optional(Type.Integer({ minimum: 1 })),
    hasScores: Type.Optional(Type.Boolean()),
    designer: Type.String(),
    description: Type.String(),
    year: Type.String(),
    minPlayers: Type.Number(),
    maxPlayers: Type.Number(),
    defaultPlayerCount: Type.Number(),
    version: Type.String(),
    beta: Type.Boolean(),
    visibility: Type.Optional(Type.Enum(GameVisibility))
})
export type GameMetadata = Type.Static<typeof GameMetadata>
