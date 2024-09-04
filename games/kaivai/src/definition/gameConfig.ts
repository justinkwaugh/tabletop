import { Type, type Static } from '@sinclair/typebox'

export type KaivaiGameConfig = Static<typeof KaivaiGameConfig>
export const KaivaiGameConfig = Type.Object({
    ruleSet: Type.String(),
    lucklessFishing: Type.Boolean()
})
