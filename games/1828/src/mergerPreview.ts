import { sharesOwned } from '@tabletop/18xx'
import {
    bankPoolShares,
    mergerDirector,
    mergerTrading,
    pendingSetAside,
    playerShares,
    withDecision,
    withSetAside,
    type MergerTrading
} from './merger.js'
import { setAsideChoices, singleShareChoices } from './mergerOffers.js'
import { IpoPoolId1828, MarketPoolId1828 } from './names.js'
import type { HydratedState1828, Merger1828 } from './state.js'
import { stockPrice } from './stockMarket.js'

export type PreviewSingle = MergerTrading['singles'][number] & {
    decided: boolean
    canTradeUp: boolean
    canSell: boolean
    sellFails: boolean
}

export type MergerHolder = {
    key: string
    playerId?: string
    label?: string
    held: readonly [number, number]
    shares: number
}

export type MergerRow = MergerHolder & { director: boolean; single?: PreviewSingle }

type MergerCompany = { companyId: string; price: number }

export type MergerPreview = {
    companies: readonly [MergerCompany, MergerCompany]
    systemPrice: number
    rows: MergerRow[]
    singles: PreviewSingle[]
    assumesTradeUp: boolean
    failsIfSoldBy: string[]
}

/**
 * The preview's rows: players with most system shares first, then the bank's holdings, then the
 * share the director donates to the system's charter (§7.5.2 step 10).
 */
export function mergerRows(
    players: readonly MergerHolder[],
    bank: readonly MergerHolder[],
    singles: readonly PreviewSingle[],
    directorId: string | undefined
): MergerRow[] {
    const holds = ({ held, shares }: MergerHolder) => shares > 0 || held.some((count) => count > 0)
    return [
        ...players
            .filter((holder) => holds(holder) && holder.playerId)
            .toSorted((first, second) => second.shares - first.shares)
            .map((holder) => {
                const single = singles.find((entry) => entry.playerId === holder.playerId)
                return {
                    ...holder,
                    director: holder.playerId === directorId,
                    ...(single ? { single } : {})
                }
            }),
        ...bank.filter(holds).map((holder) => ({ ...holder, director: false })),
        ...(directorId
            ? [
                  {
                      key: 'charter',
                      label: 'Charter',
                      held: [0, 0] as const,
                      shares: 1,
                      director: false
                  }
              ]
            : [])
    ]
}

/**
 * The merger's outcome if every single share still undecided is traded up where that lets the
 * system form (§7.5.2 steps 4–10).
 */
export function mergerPreview(state: HydratedState1828, merger: Merger1828): MergerPreview {
    let assumed = merger
    for (
        let playerId = pendingSetAside(state, assumed);
        playerId;
        playerId = pendingSetAside(state, assumed)
    ) {
        const [companyId] = setAsideChoices(state, assumed)
        assumed = withSetAside(assumed, playerId, companyId)
    }
    let trading = mergerTrading(state, assumed)
    const choices = new Map<string, ReturnType<typeof singleShareChoices>>()
    while (trading.deciderId) {
        const choice = singleShareChoices(state, assumed)
        choices.set(trading.deciderId, choice)
        assumed = withDecision(assumed, trading.deciderId, choice.tradeUp)
        trading = mergerTrading(state, assumed)
    }
    const director = mergerDirector(state, assumed, trading)
    const shares = 'failure' in director ? playerShares(trading) : director.shares
    const directorId = 'failure' in director ? undefined : director.directorId
    const singles = trading.singles.map((single) => ({
        ...single,
        decided: merger.decisions.some((decision) => decision.playerId === single.playerId),
        canTradeUp: choices.get(single.playerId)?.tradeUp ?? false,
        canSell: choices.get(single.playerId)?.sell ?? false,
        sellFails: choices.get(single.playerId)?.sellFails ?? false
    }))
    const companyIds = [merger.survivorId, merger.absorbedId] as const
    const heldBy = (count: (companyId: string) => number) =>
        [count(companyIds[0]), count(companyIds[1])] as const
    const company = (companyId: string): MergerCompany => ({
        companyId,
        price: stockPrice(state, companyId)
    })
    return {
        companies: [company(companyIds[0]), company(companyIds[1])],
        systemPrice: trading.systemPrice,
        rows: mergerRows(
            Object.entries(shares).map(([playerId, count]) => ({
                key: playerId,
                playerId,
                held: heldBy((companyId) =>
                    sharesOwned(state, companyId, { kind: 'player', playerId })
                ),
                shares: count
            })),
            [
                {
                    key: 'pool',
                    label: 'Bank pool',
                    held: heldBy((companyId) => bankPoolShares(state, companyId, MarketPoolId1828)),
                    shares: trading.poolShares
                },
                {
                    key: 'ipo',
                    label: 'IPO',
                    held: heldBy((companyId) => bankPoolShares(state, companyId, IpoPoolId1828)),
                    shares: trading.ipoShares
                }
            ],
            singles,
            directorId
        ),
        singles,
        assumesTradeUp: singles.some((single) => single.canTradeUp && single.canSell),
        failsIfSoldBy: singles
            .filter((single) => single.canSell && single.sellFails)
            .map((single) => single.playerId)
    }
}
