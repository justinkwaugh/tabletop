import type { GameAction } from '@tabletop/common'
import {
    hasNoResources,
    isBuildCities,
    isBuyResources,
    isChoosePlant,
    isCloseAuctions,
    isPassAuction,
    isPassBid,
    isPowerCities,
    isRaiseBid,
    isReplacePlant,
    isRestock,
    isScrapPlant,
    isStartStep2,
    isStep3Card,
    isPlaceTrustHouse,
    isTrustBuysResources,
    isTrustTakesPlant,
    totalResources,
    type AuctionResult,
    type MarketChange,
    type ResourceAmounts
} from '@tabletop/power-grid'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'player'; playerId: string }
    | { kind: 'plant'; plant: number }
    | { kind: 'money'; amount: number }
    | { kind: 'resources'; amounts: ResourceAmounts }
    | { kind: 'city'; cityId: string }
    | { kind: 'verb'; playerId: string; third: string; second: string }

export type Line = Segment[]

const text = (value: string): Segment => ({ kind: 'text', text: value })
const player = (playerId: string): Segment => ({ kind: 'player', playerId })
/** A player and their verb, which agrees with "You" when the player is the viewer. */
export const acts = (playerId: string, third: string, second: string): Segment[] => [
    player(playerId),
    { kind: 'verb', playerId, third, second }
]
const plant = (number: number): Segment => ({ kind: 'plant', plant: number })
const money = (amount: number): Segment => ({ kind: 'money', amount })

function list(segments: Segment[][]): Segment[] {
    return segments.flatMap((item, index) => [
        ...(index === 0 ? [] : [text(index === segments.length - 1 ? ' and ' : ', ')]),
        ...item
    ])
}

function auctionOutcome(result: AuctionResult | undefined): Line[] {
    if (!result) {
        return []
    }
    const lines: Line[] = []
    if (result.withdrawn.length > 0) {
        lines.push([
            ...list(result.withdrawn.map((id) => [player(id)])),
            {
                kind: 'verb',
                playerId: result.withdrawn[0],
                third: ' cannot bid higher',
                second: ' cannot bid higher'
            }
        ])
    }
    if (result.winner) {
        lines.push([
            ...acts(result.winner.playerId, ' buys', ' buy'),
            text(' plant '),
            plant(result.plant),
            text(' for '),
            money(result.winner.amount)
        ])
    }
    return lines
}

export function describeMarket(change: MarketChange): Line[] {
    const lines: Line[] = []
    const drawnPlants = change.drawn.filter((card): card is number => !isStep3Card(card))
    if (drawnPlants.length > 0) {
        lines.push([
            text(drawnPlants.length === 1 ? 'Plant ' : 'Plants '),
            ...list(drawnPlants.map((number) => [plant(number)])),
            text(' drawn')
        ])
    }
    if (change.drawn.some(isStep3Card)) {
        lines.push([text('The Step 3 card is drawn')])
    }
    if (change.removed.length > 0) {
        lines.push([
            text(change.removed.length === 1 ? 'Plant ' : 'Plants '),
            ...list(change.removed.map((number) => [plant(number)])),
            text(' removed from the game')
        ])
    }
    return lines
}

/** What an action did, from its input and metadata; an empty list means nothing worth saying. */
export function describeAction(action: GameAction): Line[] {
    if (isChoosePlant(action)) {
        return [
            [
                ...acts(action.playerId, ' opens', ' open'),
                text(' plant '),
                plant(action.plant),
                text(' at '),
                money(action.bid)
            ],
            ...auctionOutcome(action.metadata)
        ]
    }
    if (isRaiseBid(action)) {
        return [
            [...acts(action.playerId, ' bids', ' bid'), text(' '), money(action.amount)],
            ...auctionOutcome(action.metadata)
        ]
    }
    if (isPassBid(action)) {
        return [[...acts(action.playerId, ' passes', ' pass')], ...auctionOutcome(action.metadata)]
    }
    if (isPassAuction(action)) {
        return [[...acts(action.playerId, ' buys', ' buy'), text(' no plant this round')]]
    }
    if (isScrapPlant(action)) {
        return [
            [
                ...acts(action.playerId, ' scraps', ' scrap'),
                text(' plant '),
                plant(action.plant),
                ...(hasNoResources(action.returned)
                    ? []
                    : [
                          text(', returning '),
                          { kind: 'resources', amounts: action.returned } satisfies Segment
                      ])
            ]
        ]
    }
    if (isReplacePlant(action) && action.metadata) {
        return describeMarket(action.metadata)
    }
    if (isCloseAuctions(action) && action.metadata) {
        const [unsold, ...rest] = action.metadata.market.removed
        const unsoldLines: Line[] = action.metadata.unsoldDiscount
            ? [
                  [
                      text('Nobody bought the discounted plant '),
                      plant(unsold),
                      text(', so it leaves the game')
                  ]
              ]
            : []
        return [
            ...unsoldLines,
            ...describeMarket(
                action.metadata.unsoldDiscount
                    ? { ...action.metadata.market, removed: rest }
                    : action.metadata.market
            ),
            ...(action.metadata.step2Began ? [[text('Step 2 begins')]] : []),
            ...(action.metadata.step3Began ? [[text('Step 3 begins')]] : []),
            ...(action.metadata.playerOrder
                ? [[text('The player order is set by the plants bought')]]
                : [])
        ]
    }
    if (isBuyResources(action)) {
        return totalResources(action.resources) === 0
            ? [[...acts(action.playerId, ' buys', ' buy'), text(' no resources')]]
            : [
                  [
                      ...acts(action.playerId, ' buys', ' buy'),
                      text(' '),
                      { kind: 'resources', amounts: action.resources },
                      text(' for '),
                      money(action.metadata?.cost ?? 0)
                  ]
              ]
    }
    if (isBuildCities(action)) {
        return action.cityIds.length === 0
            ? [[...acts(action.playerId, ' builds', ' build'), text(' nothing')]]
            : [
                  [
                      ...acts(action.playerId, ' connects', ' connect'),
                      text(' '),
                      ...list(
                          (
                              action.metadata?.built.map((built) => built.cityId) ?? action.cityIds
                          ).map((cityId) => [{ kind: 'city', cityId } satisfies Segment])
                      ),
                      text(' for '),
                      money(action.metadata?.total ?? 0)
                  ]
              ]
    }
    if (isStartStep2(action) && action.metadata) {
        return [[text('Step 2 begins')], ...describeMarket(action.metadata)]
    }
    if (isPowerCities(action) && action.metadata) {
        const { powered, earned } = action.metadata
        return [
            [
                ...acts(action.playerId, ' powers', ' power'),
                text(` ${powered} ${powered === 1 ? 'city' : 'cities'} and `),
                { kind: 'verb', playerId: action.playerId, third: 'earns ', second: 'earn ' },
                money(earned)
            ]
        ]
    }
    if (isRestock(action) && action.metadata) {
        const { resupplied, placedUnder, market, step3Began } = action.metadata
        return [
            ...(hasNoResources(resupplied)
                ? []
                : [
                      [
                          text('The market is resupplied with '),
                          { kind: 'resources', amounts: resupplied } satisfies Segment
                      ]
                  ]),
            ...(placedUnder !== undefined
                ? [[text('Plant '), plant(placedUnder), text(' goes under the stack')]]
                : []),
            ...describeMarket(market),
            ...(step3Began ? [[text('Step 3 begins')]] : [])
        ]
    }
    if (isPlaceTrustHouse(action)) {
        return [
            [
                ...acts(action.playerId, ' places', ' place'),
                text(' a Trust house in '),
                { kind: 'city', cityId: action.cityId }
            ]
        ]
    }
    if (isTrustTakesPlant(action) && action.metadata) {
        const { taken, scrapped, market } = action.metadata
        return [
            ...(taken !== undefined
                ? [
                      [
                          text('The Trust takes plant '),
                          plant(taken),
                          ...(scrapped !== undefined ? [text(' and scraps '), plant(scrapped)] : [])
                      ]
                  ]
                : [[text('The Trust passes on the market')]]),
            ...describeMarket(market)
        ]
    }
    if (isTrustBuysResources(action) && action.metadata) {
        return hasNoResources(action.metadata.taken)
            ? []
            : [[text('The Trust takes '), { kind: 'resources', amounts: action.metadata.taken }]]
    }
    return []
}
