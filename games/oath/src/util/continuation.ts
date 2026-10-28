import {
    assert,
    assertExists,
    shuffle,
    type Color,
    type Player,
    type RandomFunction
} from '@tabletop/common'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import {
    BoardSide,
    OpeningChancellor,
    type OpeningBoard,
    type OpeningSeats
} from '../model/chronicle.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { OathExileColors } from '../definition/colors.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'
import type { CarriedMap } from './setup.js'

// A continued game (R-8.7, R-1): the people at the new table matched to the finished game's, the
// Chancellor and the boards settled from its final state (R-1.7-H1, R-1.9-H1), and the map it saved.

/** The people of a continued game, matched to the finished game's; player ids are never compared. */
export interface ContinuedPlayers {
    /** Each returning player's id in this game, to the id they had in the finished game. */
    returning: Record<string, string>
    /** This game's players who did not play the finished game. */
    newcomers: string[]
    /** The finished game's players who are not at this table. */
    left: string[]
}

/**
 * Who is who across the two games, in three passes, each over the players the earlier passes left:
 * an account (`userId`) held by exactly one player on each side (hosted games); then the same name,
 * in list order; then list order (hotseat and local games, whose seats share the owner's account,
 * and a hotseat seat renamed). Two players on different accounts are never the same person.
 */
export function matchContinuedPlayers(
    previousPlayers: readonly Player[],
    players: readonly Player[]
): ContinuedPlayers {
    const returning = new Map<Player, Player>()
    const taken = new Set<Player>()
    const unmatched = () => players.filter((player) => !returning.has(player))
    const free = () => previousPlayers.filter((player) => !taken.has(player))
    const pair = (player: Player, previous: Player) => {
        returning.set(player, previous)
        taken.add(previous)
    }
    const accountOnce = (list: readonly Player[], userId: string | undefined) =>
        userId !== undefined && list.filter((player) => player.userId === userId).length === 1
    const otherAccounts = (a: Player, b: Player) =>
        a.userId !== undefined && b.userId !== undefined && a.userId !== b.userId

    for (const player of players) {
        if (!accountOnce(players, player.userId) || !accountOnce(previousPlayers, player.userId))
            continue
        const previous = previousPlayers.find((p) => p.userId === player.userId)
        if (previous) pair(player, previous)
    }
    for (const player of unmatched()) {
        const previous = free().find((p) => p.name === player.name && !otherAccounts(p, player))
        if (previous) pair(player, previous)
    }
    for (const player of unmatched()) {
        const previous = free().find((p) => !otherAccounts(p, player))
        if (previous) pair(player, previous)
    }
    return {
        returning: Object.fromEntries(
            [...returning].map(([player, previous]) => [player.id, previous.id])
        ),
        newcomers: unmatched().map((player) => player.id),
        left: free().map((player) => player.id)
    }
}

/**
 * The finished game a continuation hands over, refused in plain words unless its chronicle ran to
 * the end. The platform continues only a game whose result is set and `canContinue` true, which
 * only the chronicle revision sets; these refusals guard a direct call.
 */
export function readFinishedGame(
    previousState: Readonly<OathProjectedState>
): HydratedOathGameState {
    const previous = new HydratedOathGameState(structuredClone(previousState))
    assert(
        isAtLeastOathRevision(previous, OathRevision.Chronicle),
        'The finished game predates the chronicle, so it has no world to carry into another game'
    )
    const chronicle = previous.chronicle
    assert(
        chronicle?.vowedOath !== undefined && chronicle.rebuilt === true,
        'The finished game has no chronicle that vowed an Oath and rebuilt the world deck'
    )
    assert(
        chronicle.step === undefined,
        `The finished game's chronicle is still at its ${chronicle.step} step`
    )
    assert(previous.vault, 'The finished game was handed over without its hidden cards')
    return previous
}

/** R-8.7.1 — the eight slots as the finished game saved them; the facedown sites stay in its vault. */
export function carriedMapOf(previous: HydratedOathGameState): CarriedMap {
    return {
        map: previous.map,
        siteCards: previous.siteCards,
        denizensBySite: previous.denizensBySite,
        relicsBySite: previous.relicsBySite,
        ...(previous.ruinedEdificeIds ? { ruinedEdificeIds: previous.ruinedEdificeIds } : {}),
        siteCapacityOverrides: previous.siteCapacityOverrides
    }
}

/**
 * R-1.7-H1 — the last winner if they play; else a returning player whose board was on its Citizen
 * side, at random among them; else a player at random. A draw is made only when there is a choice.
 */
export function chooseChancellor(
    previous: HydratedOathGameState,
    people: ContinuedPlayers,
    playerIds: readonly string[],
    random: RandomFunction
): OpeningSeats['chancellor'] {
    const winner = previous.chronicle?.ending.winnerPlayerId
    const returningWinner = playerIds.find((id) => people.returning[id] === winner)
    if (returningWinner !== undefined) {
        const gameNumber = previous.chronicleRecord?.at(-1)?.gameNumber
        assertExists(gameNumber, 'A finished chronicle has written its entry')
        return { playerId: returningWinner, chosen: OpeningChancellor.Winner, gameNumber }
    }
    const citizens = playerIds.filter((id) => {
        const previousId = people.returning[id]
        return (
            previousId !== undefined &&
            previous.getPlayerState(previousId).status === PlayerStatus.Citizen
        )
    })
    if (citizens.length > 0)
        return { playerId: drawOne(citizens, random), chosen: OpeningChancellor.Citizen }
    return { playerId: drawOne(playerIds, random), chosen: OpeningChancellor.Random }
}

function drawOne(ids: readonly string[], random: RandomFunction): string {
    return ids.length === 1 ? ids[0] : ids[Math.floor(random() * ids.length)]
}

/**
 * R-8.7.2 — each Exile colour's saved side: Citizen when a seated player of that colour ended the
 * game a Citizen (after R-8.2), or its board is in the box on its Citizen side.
 */
export function savedBoardSides(previous: HydratedOathGameState): Map<Color, BoardSide> {
    const citizens = new Set<Color>([
        ...previous.players
            .filter((player) => player.status === PlayerStatus.Citizen)
            .map((player) => player.color),
        ...(previous.boxedCitizenColors ?? [])
    ])
    return new Map(
        OathExileColors.map((color) => [
            color,
            citizens.has(color) ? BoardSide.Citizen : BoardSide.Exile
        ])
    )
}

/**
 * R-1.9-H1 — each returning non-Chancellor keeps the colour they played, on its saved side; every
 * other one, in turn order, is dealt a free board at random, on its saved side. The Citizen boards
 * no one takes stay in the box.
 */
export function settleBoards(
    previous: HydratedOathGameState,
    people: ContinuedPlayers,
    seatsInTurnOrder: readonly string[],
    random: RandomFunction
): { boards: OpeningBoard[]; boxedCitizenColors: Color[] } {
    const sides = savedBoardSides(previous)
    const kept = new Map<string, Color>()
    for (const playerId of seatsInTurnOrder) {
        const previousId = people.returning[playerId]
        if (previousId === undefined) continue
        const color = previous.getPlayerState(previousId).color
        if (sides.has(color) && ![...kept.values()].includes(color)) kept.set(playerId, color)
    }
    const free = OathExileColors.filter((color) => ![...kept.values()].includes(color))
    shuffle(free, random)
    const boards = seatsInTurnOrder.map((playerId): OpeningBoard => {
        const keptColor = kept.get(playerId)
        const color = keptColor ?? free.shift()
        if (color === undefined) {
            throw Error(
                `R-1.9 seats at most ${OathExileColors.length} Exiles and Citizens beside the ` +
                    `Chancellor; this game has ${seatsInTurnOrder.length}`
            )
        }
        const side = sides.get(color)
        assertExists(side, `${color} is an Exile colour`)
        return { playerId, color, side, kept: keptColor !== undefined }
    })
    const taken = new Set(boards.map((board) => board.color))
    const boxedCitizenColors = OathExileColors.filter(
        (color) => sides.get(color) === BoardSide.Citizen && !taken.has(color)
    )
    return { boards, boxedCitizenColors }
}
