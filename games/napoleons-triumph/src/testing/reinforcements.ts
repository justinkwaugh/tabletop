import type { Face } from '../components/pieces.js'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { CommandKind } from '../model/attack.js'
import { cavalry, frenchTurn, infantry, type TestGame } from './harness.js'

export interface WaitingUnit {
    id: string
    face: Face
}

/** Puts a commander off the map with the units given, to come on as reinforcements. */
export function waitOffMap(game: TestGame, commanderId: string, units: readonly WaitingUnit[]) {
    game.arrange((state) => {
        const commander = state.commander(commanderId)
        commander.eliminated = undefined
        state.units.push(
            ...units.map(({ id, face }) => ({
                id,
                playerId: commander.playerId,
                face,
                commanderId
            }))
        )
    })
}

export const RIDDEN_IN = {
    entry: 51,
    taken: 38,
    held: 52,
    corps: { kind: CommandKind.Corps, commanderId: 'bernadotte', unitIds: ['F-off'] }
}

/** Bernadotte's cavalry has come on at 51, taken 38 by road from a screen that fell back to 39, and may ride on in its turn of entry; Allied infantry holds 52. */
export function reinforcementCavalryRiddenIn(): TestGame {
    const { entry, taken, held, corps } = RIDDEN_IN
    const game = frenchTurn([
        { id: 'A-screen', side: Side.Allied, face: cavalry(1), locale: taken },
        { id: 'A-line', side: Side.Allied, face: infantry(2), locale: held }
    ])
    waitOffMap(game, corps.commanderId, [{ id: 'F-off', face: cavalry(2) }])
    const french = game.playerOf(Side.French)
    const map = game.hydrated.map
    const mainRoad = map
        .entries(Side.French)
        .find((candidate) => candidate.locale === entry && candidate.main)
    game.act(ActionType.ThreatenAttack, french, { approach: map.approachBetween(entry, taken).id })
    game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
        losses: {},
        destinations: { 'A-screen': 39 },
        kept: {}
    })
    game.act(ActionType.Occupy, french, {
        orders: [{ ...corps, entryId: mainRoad?.id, road: [entry] }]
    })
    return game
}
