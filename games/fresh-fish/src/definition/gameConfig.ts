import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

export type FreshFishGameConfig = Static<typeof FreshFishGameConfig>
export const FreshFishGameConfig = Type.Composite([
    Type.Object({
        numTurnsWithDisksToStart: Type.Optional(Type.Number({ default: 3 }))
    })
])

export const FreshFishGameConfigValidator = TypeCompiler.Compile(FreshFishGameConfig)
