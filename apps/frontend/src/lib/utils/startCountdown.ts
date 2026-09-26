export function startCountdownText(startsAt: number, now: number): string {
    const seconds = Math.max(0, Math.ceil((startsAt - now) / 1000))
    return seconds > 0 ? `Starting in ${seconds}s` : 'Starting…'
}
