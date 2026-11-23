export function titled(line: string): string {
    return `${line.charAt(0).toUpperCase()}${line.slice(1)}`
}

export function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`
}

/** An id's words: a medium's, a vessel's, a monster's, a landscape's or a guild function's. */
export function spaced(id: string): string {
    return id.replaceAll('-', ' ')
}

export function withArticle(id: string): string {
    return `${/^[aeiou]/i.test(id) ? 'an' : 'a'} ${spaced(id)}`
}
