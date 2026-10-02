import type { OathGameSession } from './session.svelte.js'
import { unseenVisionDraws, visionsClearedKey, type VisionDraw } from './visionSeen.js'

/** Browser storage is read once and mirrored in state, since a storage write is not reactive. */
export class VisionsSeen {
    private clearedThrough = $state<Record<string, string | undefined>>({})

    constructor(private readonly session: OathGameSession) {
        this.clearedThrough = Object.fromEntries(
            session.game.players.map((player) => [player.id, this.stored(player.id)])
        )
    }

    get draws(): VisionDraw[] {
        const seatId = this.session.myPlayer?.id
        if (seatId === undefined || this.session.isViewingHistory) return []
        return unseenVisionDraws(this.session.actions, this.clearedThrough[seatId])
    }

    clear(): void {
        const seatId = this.session.myPlayer?.id
        const last = this.draws.at(-1)
        if (seatId === undefined || last === undefined) return
        this.clearedThrough = { ...this.clearedThrough, [seatId]: last.actionId }
        const storage = this.storage()
        storage?.setItem(visionsClearedKey(this.session.game.id, seatId), last.actionId)
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
