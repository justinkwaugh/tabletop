import { assertExists } from '@tabletop/common'
import {
    ActionType,
    HydratedMoveWarbands,
    WarbandMoveKind,
    type WarbandMoveOption
} from '@tabletop/oath'
import type { OathGameSession } from './session.svelte.js'

/** R-6.5 — the move is tapped where the warbands go; the count follows unless only one is possible. */
export class WarbandMoveDraft {
    constructor(private readonly session: OathGameSession) {}

    get options(): WarbandMoveOption[] {
        const playerId = this.session.liveTurnSeatId
        if (!playerId || this.session.selection.action !== ActionType.MoveWarbands) return []
        return HydratedMoveWarbands.legalMoves(this.session.gameState, playerId)
    }

    get chosen(): WarbandMoveOption | undefined {
        const chosen = this.session.selection.value('warbandMove')
        return chosen !== undefined && this.options.some((option) => this.same(option, chosen))
            ? chosen
            : undefined
    }

    private ofKind(kind: WarbandMoveKind): WarbandMoveOption[] {
        return this.chosen === undefined ? this.options.filter((o) => o.move.kind === kind) : []
    }

    // A move of one owner's warbands is tapped on the board; a holder of two owners' picks one in the panel.
    get boardToSite(): WarbandMoveOption | undefined {
        const options = this.ofKind(WarbandMoveKind.BoardToSite)
        return options.length === 1 ? options[0] : undefined
    }

    get siteToBoard(): WarbandMoveOption | undefined {
        const options = this.ofKind(WarbandMoveKind.SiteToBoard)
        return options.length === 1 ? options[0] : undefined
    }

    /** R-6.5 — the moves between board and site offered by owner, when there is more than one. */
    get byOwner(): WarbandMoveOption[] {
        return [WarbandMoveKind.BoardToSite, WarbandMoveKind.SiteToBoard].flatMap((kind) => {
            const options = this.ofKind(kind)
            return options.length > 1 ? options : []
        })
    }

    async choose(option: WarbandMoveOption): Promise<void> {
        if (!this.options.some((offered) => this.same(offered, option))) return
        this.session.selection.set('warbandMove', option)
        if (option.max === 1) await this.send(1)
    }

    /** A menu row's count is the whole choice, so it sends the move it names. */
    async sendNow(option: WarbandMoveOption, count: number): Promise<void> {
        if (!this.options.some((offered) => this.same(offered, option))) return
        if (count < 1 || count > option.max) return
        this.session.selection.set('warbandMove', option)
        await this.session.moveWarbands(option, count)
    }

    async send(count: number): Promise<void> {
        const option = this.chosen
        assertExists(option, 'A count is asked only once the move is chosen')
        await this.session.moveWarbands(option, count)
    }

    private same(a: WarbandMoveOption, b: WarbandMoveOption): boolean {
        return a.owner === b.owner && JSON.stringify(a.move) === JSON.stringify(b.move)
    }
}
