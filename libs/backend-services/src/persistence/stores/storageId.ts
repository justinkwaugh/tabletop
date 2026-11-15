export function isValidStorageId(id: string): boolean {
    if (id.length === 0 || id.length > 1500 || id === '.' || id === '..' || id.includes('/')) {
        return false
    }

    // Preserve the original validator's treatment of line terminators.
    const lineEnd = id.search(/[\n\r\u2028\u2029]/)
    const firstLine = lineEnd === -1 ? id : id.slice(0, lineEnd)
    const firstPair = firstLine.indexOf('__')
    return firstPair === -1 || firstLine.indexOf('__', firstPair + 2) === -1
}
