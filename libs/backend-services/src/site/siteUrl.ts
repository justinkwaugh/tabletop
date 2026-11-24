export function siteUrl(pathOrUrl: string, frontendHost: string): string {
    return new URL(pathOrUrl, frontendHost).href
}
