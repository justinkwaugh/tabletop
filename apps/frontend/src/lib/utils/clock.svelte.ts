import { createSubscriber } from 'svelte/reactivity'
import { createTimeAgo } from '@tabletop/frontend-components'

class Clock {
    private readonly subscribe: () => void

    constructor(tickMilliseconds: number) {
        this.subscribe = createSubscriber((update) => {
            const tickWhenVisible = () => {
                if (document.visibilityState === 'visible') update()
            }
            const interval = setInterval(update, tickMilliseconds)
            // Background tabs throttle or suspend timers, so catch up as soon as the tab is shown.
            document.addEventListener('visibilitychange', tickWhenVisible)
            return () => {
                clearInterval(interval)
                document.removeEventListener('visibilitychange', tickWhenVisible)
            }
        })
    }

    get now(): Date {
        this.subscribe()
        return new Date()
    }
}

export const secondClock = new Clock(1_000)
export const minuteClock = new Clock(30_000)

const timeAgo = createTimeAgo()

export function timeSince(date: Date): string {
    return timeAgo.format(date, 'round-minute', { now: minuteClock.now.getTime() })
}
