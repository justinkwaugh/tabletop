import * as Type from 'typebox'
import { PriceProtectionFields, ShareRedemptionFields } from '@tabletop/18xx'

const Id = Type.String({ minLength: 1 })

export const TitleFields1850 = {
    ...PriceProtectionFields,
    ...ShareRedemptionFields,
    /** The variants chosen before the game began (§16). */
    variants: Type.Object(
        {
            finish400: Type.Optional(Type.Literal(true)),
            diesels: Type.Optional(Type.Literal(true)),
            reducedTokens: Type.Optional(Type.Literal(true))
        },
        { additionalProperties: false }
    ),
    /** The companies whose token stands in their red edge area (§7.4). */
    edgeTokens: Type.Array(Id, { uniqueItems: true }),
    /** The companies holding a Mesabi Range token (§6.5.1). */
    mesabiRights: Type.Array(Id, { uniqueItems: true }),
    /** The Western Land Grant's lays so far, and whether one went east of the Mississippi (§15.2). */
    landGrant: Type.Object(
        { lays: Type.Integer({ minimum: 0 }), usedAnywhere: Type.Boolean() },
        { additionalProperties: false }
    ),
    /** This turn's construction: a Mesabi token bought counts as a yellow tile lay (§6.5.1). */
    mesabiBought: Type.Optional(Type.Literal(true)),
    /** The privates that have made their lay this turn; each lays once a turn (§15.2). */
    privateLaysThisTurn: Type.Optional(Type.Array(Id, { uniqueItems: true })),
    /** The Bridge Company laid its tile this turn, which may not be upgraded in it (§15.2). */
    bridgeLaid: Type.Optional(Type.Literal(true)),
    /** This turn's token: an edge token counts as the turn's token placement (§7.4). */
    edgeTokenPlaced: Type.Optional(Type.Literal(true))
}
export type TitleState1850 = Type.Static<Type.TObject<typeof TitleFields1850>>
