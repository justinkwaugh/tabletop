import { Type, type Static } from 'typebox'

// The State as JSON text, or zstd-compressed (see storedJson.ts); a document holds one of them.
export type StoredState = Static<typeof StoredState>
export const StoredState = Type.Object({
    data: Type.Optional(Type.String()),
    dataZstd: Type.Optional(Type.Unsafe<Uint8Array>({}))
})
