/** The words with their first letter a capital, as they begin a label or a sentence. */
export function capitalized(words: string): string {
    return words.charAt(0).toUpperCase() + words.slice(1)
}
