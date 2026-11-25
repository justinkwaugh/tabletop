import {
    callRequestIneligibility,
    findPlayerForUserId,
    GameClientCapability,
    isTwoPlayerGame,
    type Game
} from '@tabletop/common'
import { m } from '$lib/paraglide/messages'

export type CallGameOffer = {
    concession: boolean
    label: string
}

export function callGameOffer(
    game: Game,
    userId: string,
    clientCapabilities: readonly string[]
): CallGameOffer | undefined {
    if (
        !clientCapabilities.includes(GameClientCapability.CalledGames) ||
        !findPlayerForUserId(game, userId) ||
        callRequestIneligibility(game) !== undefined
    ) {
        return undefined
    }
    const concession = isTwoPlayerGame(game.players)
    if (!concession && game.vote) return undefined
    return {
        concession,
        label: concession ? m.games_call_offer_concede() : m.games_call_offer_call()
    }
}
