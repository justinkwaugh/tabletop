import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    assert,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import type { HydratedFeudumPlayerState } from '../model/playerState.js'
import { PouchGood } from './finaliseHand.js'

/**
 * R-3.1-H1, R-3.3 One seat's part of the reveal: its hand's size is told, and a committed good
 * leaves its supply for the pouch. Returns that good.
 */
export function revealPouchOf(player: HydratedFeudumPlayerState): PouchGood | undefined {
    player.handCount = player.requireHand().length
    const good = player.committedPouch
    if (good) {
        assert(player.goods[good] > 0, 'R-3.3 A committed pouch good is still held')
        player.goods[good] -= 1
        player.pouch = good
        player.committedPouch = undefined
    }
    return good
}

export type RevealPouchesMetadata = Type.Static<typeof RevealPouchesMetadata>
export const RevealPouchesMetadata = Type.Object({
    /** R-3.1-H1, R-3.3 Every committed pouch good, in turn order; a seat with none is absent. */
    pouches: Type.Array(Type.Object({ playerId: Type.String(), good: PouchGood }))
})

export type RevealPouches = Type.Static<typeof RevealPouches>
export const RevealPouches = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.RevealPouches),
            source: Type.Literal(ActionSource.System),
            /** R-X.2 The pouch goods and the hand counts were hidden until now. */
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(RevealPouchesMetadata)
        })
    ])
)

export const RevealPouchesValidator = Compile(RevealPouches)

export function isRevealPouches(action?: GameAction): action is RevealPouches {
    return action?.type === ActionType.RevealPouches
}

export class HydratedRevealPouches
    extends HydratableAction<typeof RevealPouches>
    implements RevealPouches
{
    declare type: ActionType.RevealPouches
    declare source: ActionSource.System
    declare revealsInfo: true
    declare metadata?: RevealPouchesMetadata

    constructor(data: RevealPouches) {
        super(data, RevealPouchesValidator)
    }

    /**
     * R-3.1-H1, R-3.3 Once every seat has finalised, each committed good leaves its owner's supply
     * for the pouch and each hand's size is told, all at once. Reads every seat's owner-known hand
     * and pouch good, so only the host runs it.
     */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const pouches: RevealPouchesMetadata['pouches'] = []
        for (const playerId of state.turnManager.turnOrder) {
            const good = revealPouchOf(state.getPlayerState(playerId))
            if (good) {
                pouches.push({ playerId, good })
            }
        }
        this.metadata = { pouches }
    }
}
