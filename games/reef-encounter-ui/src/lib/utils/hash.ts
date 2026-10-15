// FNV-1a: a small, stable hash for picking art and rhythms from a piece's identity, so they look
// the same on every screen and after a reload.
export function fnv1a(text: string): number {
    let hash = 0x811c9dc5
    for (let index = 0; index < text.length; index++) {
        hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0
    }
    return hash
}
