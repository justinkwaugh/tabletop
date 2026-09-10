import * as Type from 'typebox'

export const GameMetadata = Type.Object({
    name: Type.String(),
    designer: Type.String(),
    description: Type.String(),
    year: Type.String(),
    minPlayers: Type.Number(),
    maxPlayers: Type.Number(),
    defaultPlayerCount: Type.Number(),
    version: Type.String(),
    beta: Type.Boolean()
})
export type GameMetadata = Type.Static<typeof GameMetadata>
