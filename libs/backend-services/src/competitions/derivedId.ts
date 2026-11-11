import { createHash } from 'node:crypto'

// The length of a nanoid, which the site uses for ordinary Game and Tournament ids.
export const DERIVED_ID_LENGTH = 21

/** An id fixed by a record's identifying parts, so deriving it again finds the same record. */
export function derivedId(parts: readonly unknown[]): string {
    return createHash('sha256')
        .update(JSON.stringify(parts))
        .digest('base64url')
        .slice(0, DERIVED_ID_LENGTH)
}
