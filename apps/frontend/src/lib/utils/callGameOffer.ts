import {
    callRequestIneligibility,
    findPlayerForUserId,
    GameClientCapability,
    isTwoPlayerGame,
    type Game
} from '@tabletop/common'

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
    return { concession, label: concession ? 'Concede' : 'Call the game' }
}
