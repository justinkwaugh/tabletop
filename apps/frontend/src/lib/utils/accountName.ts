/** An account's username, or a placeholder when the account is gone or inactive. */
export function accountName(usernames: Record<string, string>, userId: string): string {
    return usernames[userId] ?? 'Unavailable account'
}
