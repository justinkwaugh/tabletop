export function titled(line: string): string {
    return `${line.charAt(0).toUpperCase()}${line.slice(1)}`
}

export function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`
}

/** R-4.2 An id's words: a medium's or a guild function's. */
export function spaced(id: string): string {
    return id.replaceAll('-', ' ')
}
