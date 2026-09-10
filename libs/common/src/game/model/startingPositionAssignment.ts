import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { assert } from '../../util/assertions.js'

export type StartingPositionAssignment = Type.Static<typeof StartingPositionAssignment>
export const StartingPositionAssignment = Type.Object({
    playerIds: Type.Array(Type.String({ minLength: 1 }), { minItems: 2, uniqueItems: true })
})

export function validateStartingPositionAssignment(
    playerIds: readonly string[],
    assignment: StartingPositionAssignment
): void {
    assert(
        Value.Check(StartingPositionAssignment, assignment),
        'Invalid starting position assignment'
    )
    assert(
        new Set(playerIds).size === playerIds.length &&
            assignment.playerIds.length === playerIds.length &&
            playerIds.every((id) => assignment.playerIds.includes(id)),
        'Starting positions must assign every player exactly once'
    )
}
