import * as Type from 'typebox'

export type GameProgress = Type.Static<typeof GameProgress>
export const GameProgress = Type.Object(
    {
        fraction: Type.Number({ minimum: 0, maximum: 1 }),
        label: Type.String({ minLength: 1, maxLength: 64 }),
        final: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)

export function sameGameProgress(a?: GameProgress, b?: GameProgress): boolean {
    return a?.fraction === b?.fraction && a?.label === b?.label && a?.final === b?.final
}
