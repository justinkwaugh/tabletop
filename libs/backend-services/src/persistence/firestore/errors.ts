import { Type, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

export type FirestoreError = Static<typeof FirestoreError>
export const FirestoreError = Type.Object({
    code: Type.Number(),
    message: Type.String(),
    details: Type.String(),
    metadata: Type.Object({})
})

export function isFirestoreError(error: unknown): error is FirestoreError {
    return Value.Check(FirestoreError, error)
}
