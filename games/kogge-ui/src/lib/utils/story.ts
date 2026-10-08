import type { GameAction } from '@tabletop/common'
import {
    BonusChit,
    cityInfo,
    goodCounts,
    isBeginRound,
    isBuildOffice,
    isBuyRouteMarkers,
    isChangeRoute,
    isChooseSpoils,
    isChooseStartCity,
    isClaimBonusChit,
    isClaimRaidMarker,
    isDivideSpoils,
    isExchangeGoodForMarker,
    isExchangeMarkerForGood,
    isExpelRaider,
    isMoveGuildMaster,
    isPassBid,
    isPlaceBid,
    isRaidCity,
    isRaidCog,
    isResolveAuction,
    isRevealStartCities,
    isSail,
    isTradeGoods,
    markerGood,
    paymentSize,
    SailRouteKind,
    type GoodCounts,
    type Payment
} from '@tabletop/kogge'

export type StoryPart =
    | { kind: 'text'; text: string }
    | { kind: 'agree'; playerId: string; text: string }
    | { kind: 'player'; playerId: string }
    | { kind: 'city'; city: number }
    | { kind: 'markers'; values: number[] }
    | { kind: 'goods'; goods: GoodCounts }

export type Story = StoryPart[]

export const BONUS_CHIT_NAMES: Record<BonusChit, string> = {
    [BonusChit.ThreeForOne]: '3 : 1 trade',
    [BonusChit.ExtraRouteMarker]: '+1 route marker',
    [BonusChit.MoveTwo]: 'free second move',
    [BonusChit.SecretPassage]: 'secret passage'
}

const text = (value: string): StoryPart => ({ kind: 'text', text: value })
// A phrase that follows a player's name and changes when that player is the reader.
const agree = (playerId: string, value: string): StoryPart => ({
    kind: 'agree',
    playerId,
    text: value
})
const player = (playerId: string): StoryPart => ({ kind: 'player', playerId })
const city = (number: number): StoryPart => ({ kind: 'city', city: number })
const markers = (values: number[]): StoryPart => ({ kind: 'markers', values })
const goods = (counts: GoodCounts): StoryPart => ({ kind: 'goods', goods: counts })

function paymentStory(payment: Payment): Story {
    if (paymentSize(payment) === 0) {
        return []
    }
    const parts: Story = [text(', paying ')]
    if (payment.markers.length > 0) {
        parts.push(markers(payment.markers))
    }
    if (paymentSize(payment) > payment.markers.length) {
        parts.push(goods(payment.goods))
    }
    return parts
}

// Describes an action from its input and metadata alone.
export function describeAction(action: GameAction): Story | undefined {
    const actorId = action.playerId ?? ''
    const actor = player(actorId)
    const act = (phrase: string) => agree(actorId, phrase)
    switch (true) {
        case isChooseStartCity(action):
            return [actor, act(' chooses a start city in secret')]
        case isRevealStartCities(action): {
            const metadata = action.metadata
            if (!metadata) return undefined
            const parts: Story = [text('Start cities revealed: ')]
            Object.entries(metadata.choices).forEach(([playerId, chosen], index) => {
                if (index > 0) parts.push(text(', '))
                parts.push(player(playerId), text(' '), city(chosen))
            })
            if (metadata.contested.length > 0) {
                parts.push(text('. Too many chose '))
                metadata.contested.forEach((contested, index) => {
                    if (index > 0) parts.push(text(' and '))
                    parts.push(city(contested))
                })
                parts.push(text('; they choose again'))
            }
            return parts
        }
        case isBeginRound(action): {
            const metadata = action.metadata
            if (!metadata) return undefined
            const parts: Story = [
                text(`Round ${metadata.round}: route markers on sale `),
                markers(metadata.offer.flat())
            ]
            for (const [playerId, count] of Object.entries(metadata.extraMarkers)) {
                parts.push(
                    text('. '),
                    player(playerId),
                    agree(playerId, ` draws ${count} extra route marker${count === 1 ? '' : 's'}`)
                )
            }
            return parts
        }
        case isPlaceBid(action):
            return [actor, act(' bids '), markers(action.markers)]
        case isPassBid(action):
            return [actor, act(' cannot bid')]
        case isResolveAuction(action): {
            const metadata = action.metadata
            if (!metadata) return undefined
            const parts: Story = [text('Turn order: ')]
            metadata.turnOrder.forEach((playerId, index) => {
                if (index > 0) parts.push(text(', '))
                parts.push(player(playerId))
            })
            for (const delivery of metadata.deliveries) {
                const delivered = delivery.toCity + delivery.toOffices.length
                if (delivered === 0) continue
                parts.push(text('. '), city(delivery.city), text(' receives '))
                parts.push(goods(goodCounts({ [delivery.good]: delivered })))
                if (delivery.toOffices.length > 0) {
                    parts.push(text(`, ${delivery.toOffices.length} into offices`))
                }
            }
            return parts
        }
        case isMoveGuildMaster(action): {
            const metadata = action.metadata
            if (!metadata) return [actor, act(' moves the guild master')]
            const destination = metadata.stops[metadata.stops.length - 1]
            const parts: Story = [actor, act(' moves the guild master to '), city(destination)]
            if (metadata.goodsPlaced > 0) {
                parts.push(
                    text(', who brings '),
                    goods(goodCounts({ [cityInfo(destination).good]: metadata.goodsPlaced }))
                )
            }
            if (metadata.endsGame) {
                parts.push(text('. His second round is complete and the game ends'))
            }
            return parts
        }
        case isSail(action): {
            const metadata = action.metadata
            const via =
                action.route.kind === SailRouteKind.SecretPassage ? ' by the secret passage' : ''
            if (!metadata) return [actor, act(` sails${via}`)]
            const parts: Story = [actor]
            if (metadata.blocked) {
                parts.push(
                    act(' reveals a route to '),
                    city(metadata.destination),
                    act(', a city they raided, and stays in '),
                    city(metadata.from)
                )
            } else {
                parts.push(
                    act(` sails${via} from `),
                    city(metadata.from),
                    text(' to '),
                    city(metadata.destination)
                )
                if (metadata.revealed) parts.push(text(' along a hidden route'))
            }
            parts.push(...paymentStory(action.payment))
            if (metadata.collected > 0) {
                parts.push(act(` and loads ${metadata.collected} from their office`))
            }
            return parts
        }
        case isBuildOffice(action):
            return action.metadata
                ? [actor, act(' founds an office in '), city(action.metadata.city)]
                : [actor, act(' founds an office')]
        case isBuyRouteMarkers(action):
            return [
                actor,
                act(' buys '),
                markers(action.metadata?.markers ?? []),
                text(' for '),
                goods(goodCounts({ [action.good]: 1 }))
            ]
        case isTradeGoods(action):
            return [actor, act(' trades '), goods(action.give), text(' for '), goods(action.take)]
        case isChangeRoute(action): {
            const metadata = action.metadata
            const parts: Story = [actor, act(' lays a hidden route ')]
            if (metadata) {
                parts.push(
                    text('in '),
                    city(metadata.city),
                    text(', taking back '),
                    markers([metadata.replaced])
                )
            }
            return parts
        }
        case isClaimRaidMarker(action):
            return [
                actor,
                act(' gives the guild master '),
                markers([action.value, action.value, action.value]),
                text(' for a second raid marker')
            ]
        case isClaimBonusChit(action):
            return [
                actor,
                act(' sells '),
                goods(goodCounts({ [action.good]: 6 })),
                text(` to the guild master for the ${BONUS_CHIT_NAMES[action.chit]} bonus`)
            ]
        case isExchangeGoodForMarker(action):
            return [
                actor,
                act(' trades '),
                goods(goodCounts({ [markerGood(action.value)]: 1 })),
                text(' to the guild master for '),
                markers([action.value])
            ]
        case isExchangeMarkerForGood(action):
            return [
                actor,
                act(' trades '),
                markers([action.value]),
                text(' to the guild master for '),
                goods(goodCounts({ [markerGood(action.value)]: 1 }))
            ]
        case isRaidCity(action):
            return action.metadata
                ? [
                      actor,
                      act(' raids '),
                      city(action.metadata.city),
                      text(', seizing '),
                      goods(action.metadata.loot)
                  ]
                : [actor, act(' raids the city')]
        case isRaidCog(action):
            return [actor, act(' raids the cog of '), player(action.victimId)]
        case isDivideSpoils(action):
            return [actor, act(' splits their cargo, setting aside '), goods(action.pile)]
        case isChooseSpoils(action):
            return action.metadata
                ? [
                      actor,
                      act(' takes '),
                      goods(action.metadata.taken),
                      text(' from '),
                      player(action.metadata.victimId)
                  ]
                : [actor, act(' takes a pile')]
        case isExpelRaider(action): {
            const metadata = action.metadata
            if (!metadata) return undefined
            if (metadata.destination === undefined) {
                return [
                    player(metadata.raiderId),
                    agree(metadata.raiderId, ' has no route out and stays in '),
                    city(metadata.from)
                ]
            }
            if (metadata.blocked) {
                return [
                    actor,
                    act(' reveals a route to '),
                    city(metadata.destination),
                    text(', where '),
                    player(metadata.raiderId),
                    text(' may not go; the cog stays')
                ]
            }
            return [
                actor,
                act(' drives '),
                player(metadata.raiderId),
                text(' out to '),
                city(metadata.destination)
            ]
        }
        default:
            return undefined
    }
}
