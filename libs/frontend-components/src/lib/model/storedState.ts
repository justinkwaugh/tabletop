import { createPatch } from '@tabletop/common'

// States are stored and sent as JSON: a field cleared to undefined arrives removed, and an
// undefined array slot arrives as null.
export function sameStoredState(left: unknown, right: unknown): boolean {
    return createPatch(asJson(left), asJson(right)).length === 0
}

function asJson(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value))
}
