// PROTOTYPE: shared read-only facts every player card variant draws from.
import type { Player } from '@tabletop/common'
import {
    MarketColor,
    MaxShopsPerPlayer,
    antiqueSetPayout,
    paidAntiques,
    type HydratedMarracashPlayerState
} from '@tabletop/marracash'
import type { MarracashGameSession } from '$lib/model/session.svelte.js'
import { antiqueProgress } from '$lib/utils/antiqueProgress.js'
import { sortedAntiques } from '$lib/utils/antiqueItems.js'
import { standeeOutline } from '$lib/utils/shopSign.js'

export const DirhamSymbol = 'د.م.'
export const MarketColors = Object.values(MarketColor)

export function cardFacts(
    gameSession: MarracashGameSession,
    player: Player,
    playerState: HydratedMarracashPlayerState
) {
    const state = gameSession.gameState
    const seat = state.players.findIndex((candidate) => candidate.playerId === player.id)
    const customers = state.customersByColor(player.id)
    const revealRank = state.antiqueRevealOrder.indexOf(player.id)
    const revealed = sortedAntiques(playerState.revealedAntiques)
    const paid = paidAntiques(playerState.revealedAntiques, revealRank)
    const isMe = player.id === gameSession.myPlayer?.id
    return {
        name: player.name,
        initial: player.name.charAt(0).toUpperCase(),
        bg: gameSession.colors.getPlayerBgColorValue(player.id),
        ink: gameSession.colors.getPlayerTextColorValue(player.id),
        standee: standeeOutline(seat),
        isTurn: state.activePlayerIds.includes(player.id),
        money: gameSession.visibleMoney(player.id),
        customers,
        totalCustomers: MarketColors.reduce((total, color) => total + customers[color], 0),
        shopCount: state.ownedShopCount(player.id),
        maxShops: MaxShopsPerPlayer,
        antiquesOn: Boolean(state.antiqueCards),
        isMe,
        hand: isMe ? antiqueProgress(sortedAntiques(playerState.antiques), customers) : [],
        revealRank,
        revealedLabel: ['1st', '2nd', '3rd', '4th'][revealRank] ?? '',
        revealed: revealed.map((card) => ({ card, paid: paid.includes(card) })),
        payout: revealRank >= 0 ? antiqueSetPayout(playerState.revealedAntiques, revealRank) : 0
    }
}

export type CardFacts = ReturnType<typeof cardFacts>
