import type { OathGameSession } from './session.svelte.js'
import {
    drawIdsClearedBy,
    readClearedDrawIds,
    unseenVisionDraws,
    saveClearedDrawIds,
    visionsClearedKey,
    type VisionDraw
} from './visionSeen.js'

/** Browser storage is read once and mirrored in state, since a storage write is not reactive. */
export class VisionsSeen {
    private cleared = $state<Record<string, readonly string[]>>({})

    constructor(private readonly session: OathGameSession) {
        this.cleared = Object.fromEntries(
            session.game.players.map((player) => [
                player.id,
                readClearedDrawIds(this.stored(player.id))
            ])
        )
    }

    get draws(): VisionDraw[] {
        const seatId = this.session.myPlayer?.id
        if (seatId === undefined || this.session.isViewingHistory) return []
        return unseenVisionDraws(this.session.actions, this.cleared[seatId] ?? [])
    }

    clear(): void {
        const seatId = this.session.myPlayer?.id
        if (seatId === undefined || this.draws.length === 0) return
        const cleared = drawIdsClearedBy(this.session.actions, this.cleared[seatId] ?? [])
        this.cleared = { ...this.cleared, [seatId]: cleared }
        saveClearedDrawIds(this.storage(), visionsClearedKey(this.session.game.id, seatId), cleared)
    }

    private stored(playerId: string): string | undefined {
        const storage = this.storage()
        return storage?.getItem(visionsClearedKey(this.session.game.id, playerId)) ?? undefined
    }

    // A server render has no storage, and a browser blocking site data throws on reaching it.
    private storage(): Storage | undefined {
        try {
            return typeof localStorage === 'undefined' ? undefined : localStorage
        } catch {
            return undefined
        }
    }
}
