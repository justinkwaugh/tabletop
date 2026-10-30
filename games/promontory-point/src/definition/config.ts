import * as Type from 'typebox'

export type PromontoryPointGameConfig = Type.Static<typeof PromontoryPointGameConfig>
export const PromontoryPointGameConfig = Type.Object({
    // R-6.3-H1
    fourPieceVariant: Type.Optional(Type.Boolean())
})
