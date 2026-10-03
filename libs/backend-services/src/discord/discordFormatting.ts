export function siteUrl(pathOrUrl: string, frontendHost: string): string {
    return new URL(pathOrUrl, frontendHost).href
}

export function truncate(text: string, maxLength: number): string {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}
