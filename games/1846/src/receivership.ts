import { inReceivership, marketReceivership, type ReceivershipRules } from '@tabletop/18xx'
import { Market1846 } from './stock.js'

/** GMT §8. */
export const ReceivershipRules1846: ReceivershipRules = marketReceivership({
    market: Market1846,
    marketPoolId: 'open-market'
})
export { inReceivership }
