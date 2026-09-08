import { assert } from '@tabletop/common'
import { PoliticsCardType, type PoliticsCard } from '../definition/politicsCards.js'
import type { LowenherzProjectedState } from '../model/gameState.js'

export function normalizePoliticsCards(data: LowenherzProjectedState): LowenherzProjectedState {
    const hasCopyId = (card: PoliticsCard) => Object.hasOwn(card, 'id')
    if (
        !data.politicsCardPileA?.some(hasCopyId) &&
        !data.politicsCardPileB?.some(hasCopyId) &&
        !data.players.some((player) => player.politicsCards?.some(hasCopyId)) &&
        !data.duel?.bids.some((bid) => Object.hasOwn(bid, 'treasureCardIds'))
    )
        return data

    const withoutCopyId = (card: PoliticsCard): PoliticsCard => {
        const normalized = { ...card }
        Reflect.deleteProperty(normalized, 'id')
        return normalized
    }
    const duel = data.duel && {
        ...data.duel,
        bids: data.duel.bids.map((bid) => {
            const legacyIds: unknown = Reflect.get(bid, 'treasureCardIds')
            if (legacyIds === undefined) return bid
            assert(Array.isArray(legacyIds), 'Invalid legacy duel treasure cards')
            const remaining = [
                ...(data.players.find((player) => player.playerId === bid.playerId)
                    ?.politicsCards ?? [])
            ]
            const treasureValues = legacyIds.map((id) => {
                assert(typeof id === 'string', 'Invalid legacy duel treasure card ID')
                const index = remaining.findIndex((card) => Reflect.get(card, 'id') === id)
                const card = remaining[index]
                assert(
                    card?.type === PoliticsCardType.Treasure && typeof card.value === 'number',
                    'Cannot migrate a duel treasure card missing from its owner’s hand'
                )
                remaining.splice(index, 1)
                return card.value
            })
            assert(
                bid.treasureValues === undefined ||
                    JSON.stringify(bid.treasureValues) === JSON.stringify(treasureValues),
                'Conflicting legacy duel treasure cards'
            )
            const normalized = { ...bid, treasureValues }
            Reflect.deleteProperty(normalized, 'treasureCardIds')
            return normalized
        })
    }
    return {
        ...data,
        players: data.players.map((player) =>
            player.politicsCards?.some(hasCopyId)
                ? {
                      ...player,
                      politicsCards: player.politicsCards.map(withoutCopyId)
                  }
                : player
        ),
        politicsCardPileA: data.politicsCardPileA?.map(withoutCopyId),
        politicsCardPileB: data.politicsCardPileB?.map(withoutCopyId),
        ...(duel ? { duel } : {})
    }
}

export function normalizeLowenherzState(data: LowenherzProjectedState): LowenherzProjectedState {
    const normalized = normalizePoliticsCards(data)
    return {
        ...normalized,
        actionDeckBacks:
            normalized.actionDeckBacks ?? normalized.actionDeck?.map((card) => card.back),
        politicsPileACount: normalized.politicsPileACount ?? normalized.politicsCardPileA?.length,
        politicsPileBCount: normalized.politicsPileBCount ?? normalized.politicsCardPileB?.length,
        players: normalized.players.map((player) => {
            const pile = normalized.openedPoliticsPile
            const cards = pile === 'A' ? normalized.politicsCardPileA : normalized.politicsCardPileB
            const inspection =
                player.politicsInspection ??
                (!normalized.privateInformation &&
                pile &&
                cards &&
                normalized.politicsTakingPlayerId === player.playerId
                    ? { pile, cards: cards.map((card) => ({ ...card })) }
                    : undefined)
            if (player.politicsCardCount !== undefined && inspection === player.politicsInspection)
                return player
            return {
                ...player,
                politicsCardCount: player.politicsCardCount ?? player.politicsCards?.length,
                ...(inspection ? { politicsInspection: inspection } : {})
            }
        })
    }
}
