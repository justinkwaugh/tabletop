import {
    resolveShippingStyleByCompanyId,
    type HydratedIndonesiaGameState,
    type ShippingStyle
} from '@tabletop/indonesia'

export type { ShippingStyle } from '@tabletop/indonesia'

export function shippingStyleByCompanyId(
    gameState: HydratedIndonesiaGameState
): Map<string, ShippingStyle> {
    return resolveShippingStyleByCompanyId(gameState)
}
