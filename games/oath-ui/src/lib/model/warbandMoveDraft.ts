import { ActionType, HydratedMoveWarbands, type WarbandMoveOption } from '@tabletop/oath'
import type { OathGameSession } from './session.svelte.js'

/** R-6.5 — each move the engine allows, and the count that sends it from the panel. */
export class WarbandMoveDraft {
    constructor(private readonly session: OathGameSession) {}

    get options(): WarbandMoveOption[] {
        const playerId = this.session.liveTurnSeatId
        if (!playerId || this.session.selection.action !== ActionType.MoveWarbands) return []
        return HydratedMoveWarbands.legalMoves(this.session.gameState, playerId)
    }

    /** A menu row's count is the whole choice, so it sends the move it names. */
    async sendNow(option: WarbandMoveOption, count: number): Promise<void> {
        if (!this.options.some((offered) => this.same(offered, option))) return
        if (count < 1 || count > option.max) return
        this.session.selection.set('warbandMove', option)
        await this.session.moveWarbands(option, count)
    }

    private same(a: WarbandMoveOption, b: WarbandMoveOption): boolean {
        return a.owner === b.owner && JSON.stringify(a.move) === JSON.stringify(b.move)
    }
}
