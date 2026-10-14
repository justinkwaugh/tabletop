/** The words of a text, lower-cased and joined by hyphens, as a file name: "Austerlitz, round 2" is `austerlitz-round-2`. */
export function fileSlug(text: string): string {
    return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).join('-')
}
