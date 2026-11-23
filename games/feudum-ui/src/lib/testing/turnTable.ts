import { assertExists } from '@tabletop/common'
import {
    type ActionCardKind,
    ActionCards,
    ActionType,
    cardTurnSeat,
    type Character,
    type Good,
    Goods,
    handSizeFor,
    type HydratedFeudumGameState,
    type LocationKind,
    locationKindOf,
    placeMarker,
    type PouchGood,
    replaceLocationDisc,
    returnGoodToHaversack,
    type SpaceId,
    Spaces,
    takeGoodFromHaversack
} from '@tabletop/feudum'
import { FeudumHost } from './sessionHarness.js'

export interface TurnTable {
    readonly host: FeudumHost
    readonly seat: string
    readonly other: string
}

/** R-3.1, R-3.2 The real game up to `PlayingCards`: the seat asked holds `cards`, the others `otherCards`. */
export async function atPlayingCards(
    cards: readonly ActionCardKind[],
    { pouchGood, otherCards }: { pouchGood?: PouchGood; otherCards?: ActionCardKind[] } = {},
    numPlayers = 3
): Promise<TurnTable> {
    const host = new FeudumHost(numPlayers)
    await host.playStartingGoods()
    await host.playStartingPawns()
    const { order } = host
    for (const _ of order) {
        const [playerId] = host.state.activePlayerIds
        assertExists(playerId, 'R-3.1-H1 A seat is yet to finalise')
        await host.send(playerId, {
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: ActionCards.map(({ kind }) => kind).slice(0, handSizeFor(pouchGood)),
            ...(pouchGood ? { pouchGood } : {})
        })
    }
    const seat = cardTurnSeat(host.state)
    assertExists(seat, 'R-3.2 A seat is asked for a card')
    const other = order[(order.indexOf(seat) + 1) % order.length]
    host.edit((state) => {
        for (const playerId of order) {
            const player = state.getPlayerState(playerId)
            player.hand = [...(playerId === seat ? cards : (otherCards ?? ['tax', 'guild']))]
            player.handCount = player.hand.length
        }
    })
    return { host, seat, other }
}

/** R-1.1 This seat's goods go back to the haversack, keeping the totals. */
export function returnGoods(state: HydratedFeudumGameState, playerId: string): void {
    const { goods } = state.getPlayerState(playerId)
    for (const good of Goods) {
        returnGoodToHaversack(state, good, goods[good])
        goods[good] = 0
    }
}

export function giveGood(state: HydratedFeudumGameState, playerId: string, good: Good): void {
    state.getPlayerState(playerId).goods[good] += takeGoodFromHaversack(state, good)
}

/** R-1.1 A supply pawn stands on the space. */
export function addPawn(
    state: HydratedFeudumGameState,
    playerId: string,
    character: Character,
    spaceId: SpaceId
): void {
    const pawn = state.getPlayerState(playerId).pawns.find(({ spaceId: on }) => !on)
    assertExists(pawn, 'R-1.1 A pawn is in supply')
    pawn.spaceId = spaceId
    pawn.character = character
}

/** R-3.11 A bead off the seal pile, in the seat's hands. */
export function giveBead(state: HydratedFeudumGameState, playerId: string): void {
    const sealId = state.requireVault().sealPile.pop()
    assertExists(sealId, 'R-3.11 The pile has a seal')
    state.supply.sealPileCount -= 1
    state.getPlayerState(playerId).beads.push(sealId)
}

/** R-4.1 The seat's markers out on free outposts, other than those named, till this many are left. */
export function spendMarkers(
    state: HydratedFeudumGameState,
    playerId: string,
    left: number,
    spared: readonly SpaceId[] = []
): void {
    const free = emptySpaces(state, 'outpost').filter((id) => !spared.includes(id))
    const player = state.getPlayerState(playerId)
    while (player.influenceSupply > left) {
        const spaceId = free.pop()
        assertExists(spaceId, 'R-1.4 An outpost is free')
        placeMarker(state, playerId, spaceId)
    }
}

/** R-3.12.1 The seat's marker rules a free town. */
export function ruleTown(state: HydratedFeudumGameState, playerId: string): SpaceId {
    const spaceId = emptySpace(state, 'town')
    placeMarker(state, playerId, spaceId)
    state.recomputeRanks()
    return spaceId
}

/** R-3.10.1 The seat's marker rules a free outpost. */
export function ruleOutpost(state: HydratedFeudumGameState, playerId: string): SpaceId {
    const spaceId = emptySpace(state, 'outpost')
    placeMarker(state, playerId, spaceId)
    state.recomputeRanks()
    return spaceId
}

export function emptySpaces(state: HydratedFeudumGameState, kind: LocationKind): SpaceId[] {
    const taken = state.players.flatMap(({ pawns }) => pawns.map(({ spaceId }) => spaceId))
    return Spaces.map(({ id }) => id).filter((id) => {
        const { location, ruler, serf } = state.spaces[id]
        return locationKindOf(location) === kind && !ruler && !serf && !taken.includes(id)
    })
}

export function emptySpace(state: HydratedFeudumGameState, kind: LocationKind): SpaceId {
    const [spaceId] = emptySpaces(state, kind)
    assertExists(spaceId, `R-1.4 A ${kind} is free`)
    return spaceId
}

/** R-3.9.1 The space shows a feudum this seat's marker rules. */
export function buildFeudum(
    state: HydratedFeudumGameState,
    rulerId: string,
    spaceId: SpaceId
): void {
    replaceLocationDisc(state, spaceId, 'disc.feudum.knight-1', 'feudum', 'knight')
    placeMarker(state, rulerId, spaceId)
}
