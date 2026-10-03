import { assert } from '@tabletop/common'
import {
    ActionType,
    HydratedMoveWarbands,
    WarbandMoveKind,
    type WarbandMoveOption
} from '@tabletop/oath'
import type { MenuPointerTarget } from './menuPointer.svelte.js'
import type { OathGameSession } from './session.svelte.js'

/** R-6.5 — each move the engine allows, and the count that sends it from the panel. */
export class WarbandMoveDraft {
    constructor(private readonly session: OathGameSession) {}

    get options(): WarbandMoveOption[] {
        const playerId = this.session.liveTurnSeatId
        if (!playerId || this.session.selection.action !== ActionType.MoveWarbands) return []
        return HydratedMoveWarbands.legalMoves(this.session.gameState, playerId)
    }

    /** Rule 3 — a move onto the seat's site names that site on the board. */
    points(option: WarbandMoveOption): MenuPointerTarget | undefined {
        const playerId = this.session.liveTurnSeatId
        if (!playerId || option.move.kind !== WarbandMoveKind.BoardToSite) return undefined
        const slotId = this.session.gameState.getPlayerState(playerId).siteId
        return slotId ? { kind: 'site', slotId } : undefined
    }

    async sendNow(option: WarbandMoveOption, count: number): Promise<void> {
        assert(
            this.options.some((offered) => this.same(offered, option)),
            'A warband move is sent only from a row the engine offers'
        )
        assert(count >= 1 && count <= option.max, 'A warband move sends a count its row offers')
        this.session.selection.set('warbandMove', option)
        await this.session.moveWarbands(option, count)
    }

    private same(a: WarbandMoveOption, b: WarbandMoveOption): boolean {
        return a.owner === b.owner && JSON.stringify(a.move) === JSON.stringify(b.move)
    }
}
