export function challengeExpiryText(expiresAt: Date): string {
    const time = expiresAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `It works until ${time}, and only the most recent one works.`
}
