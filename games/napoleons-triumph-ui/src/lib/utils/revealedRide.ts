import {
    Side,
    commanderDefinition,
    type HydratedNapoleonsTriumphGameState
} from '@tabletop/napoleons-triumph'
import { faceName } from './faceName.js'
import { byFaceRank } from './unitTypeOrder.js'

type RevealedGame = Pick<
    HydratedNapoleonsTriumphGameState,
    'map' | 'revealedRide' | 'findUnit' | 'findPlayerState'
>

export interface RevealedRideLines {
    riding: string
    revealed: string
}

/** Where the enemy cavalry still riding when the last turn ended stands, and what it showed, for the player whose turn it opens. */
export function revealedRideLines(game: RevealedGame): RevealedRideLines | undefined {
    const riders = (game.revealedRide?.unitIds ?? []).flatMap((id) => game.findUnit(id) ?? [])
    const [first] = riders
    if (!first) {
        return undefined
    }
    const faces = riders.flatMap((unit) => unit.shown ?? []).toSorted(byFaceRank)
    const army = game.findPlayerState(first.playerId)?.side === Side.French ? 'French' : 'Allied'
    const whose = first.commanderId
        ? `${commanderDefinition(first.commanderId).name}’s cavalry`
        : 'Detached cavalry'
    const where = first.position ? ` in ${game.map.label(first.position.locale)}` : ''
    // Only cavalry rides by road, so every face named takes 'a'.
    const revealed = faces.map((face) => `a ${faceName(face)}`).join(' and ')
    return {
        riding: `${whose} was still riding${where} when the ${army} turn ended.`,
        revealed: `It was revealed as ${revealed}.`
    }
}
