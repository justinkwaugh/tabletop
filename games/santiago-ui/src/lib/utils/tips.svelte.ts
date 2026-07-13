import { untrack } from 'svelte'

const STORAGE_KEY = 'santiago-seen-tips'

function loadSeenTips(): Record<string, boolean> {
    if (typeof localStorage === 'undefined') return {}
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    } catch {
        return {}
    }
}

class TipTracker {
    private seen = $state<Record<string, boolean>>(loadSeenTips())

    hasSeen(id: string): boolean {
        return !!this.seen[id]
    }

    markSeen(id: string) {
        if (this.seen[id]) return
        this.seen = { ...this.seen, [id]: true }
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.seen))
        }
    }
}

const tracker = new TipTracker()

// Shows a one-time tip for whatever span `id()` is active (i.e. `active()` is true and
// resolves to that specific id), as long as that id hadn't already been marked seen before
// the span began. It's marked seen immediately (so future spans — e.g. a later round's
// bidding turn — won't show it again), but stays visible for the rest of THIS span so the
// player actually gets a chance to read it, rather than vanishing the instant it's marked
// seen.
//
// The show/hide decision is made exactly once, at the moment a given id first becomes
// active (a "rising edge" keyed on the id itself, not just on active()'s boolean value) —
// every other re-run for the SAME id while it's still active is ignored. Keying on the id
// rather than the boolean matters in hotseat games: active() (e.g. "it's someone's bidding
// turn") can stay continuously true across several different players' turns in a row, since
// session.isMyTurn is unconditionally true there and the phase itself doesn't change between
// them — only id() (which reads the current player) actually changes. Keying on the boolean
// alone would only ever re-evaluate for the first player in that span; everyone after them
// would be stuck with whatever was decided for that first player.
export function useOneTimeTip(id: () => string, active: () => boolean) {
    let visible = $state(false)
    let lastActiveId: string | null = null

    $effect(() => {
        const currentId = active() ? id() : null

        if (currentId !== null && currentId !== lastActiveId) {
            const alreadySeen = untrack(() => tracker.hasSeen(currentId))
            visible = !alreadySeen
            if (!alreadySeen) tracker.markSeen(currentId)
        } else if (currentId === null) {
            visible = false
        }
        lastActiveId = currentId
    })

    return {
        get visible() {
            return visible
        }
    }
}
