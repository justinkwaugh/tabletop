import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import {
    RecordedHistory,
    type GameAction,
    type GameDefinition,
    type HydratedGameState
} from '@tabletop/common'
import {
    presidentCertificate,
    presidentOf,
    type EighteenXXState,
    type HydratedEighteenXXState
} from '@tabletop/18xx'

/** A recorded company's president, where its president's certificate now gives it. */
function recordedPresidents(state: Readonly<EighteenXXState>) {
    return state.companies.flatMap((company) =>
        company.president && presidentCertificate(state, company.id)
            ? [{ companyId: company.id, recorded: company.president }]
            : []
    )
}

/**
 * Checks a game stored by an earlier logic: its State and every State before each recorded
 * Action validate and hydrate, and the president each recorded company names is the one its
 * president's certificate gives. ``check`` adds the title's own comparisons on the stored State.
 */
export function storedGameTests<
    Raw extends EighteenXXState,
    State extends HydratedEighteenXXState & HydratedGameState<Raw>
>(
    definition: GameDefinition<Raw, State>,
    fixture: URL,
    check?: (stored: Raw, hydrated: State) => void
): void {
    const { state, actions = [] }: { state: Raw; actions?: GameAction[] } = JSON.parse(
        readFileSync(fixture, 'utf8')
    )
    const { canonicalStateValidator, hydrator } = definition.runtime

    it('loads every recorded State the earlier logic stored', () => {
        const reached = [
            state,
            ...[
                ...new RecordedHistory(state, actions).select((before) => structuredClone(before))
            ].flatMap(([, transition]) => (transition.before ? [transition.before] : []))
        ]
        expect(reached.length).toBe(actions.length + 1)
        for (const recorded of reached) {
            expect(canonicalStateValidator?.Check(recorded)).toBe(true)
            const hydrated = hydrator.hydrateState(recorded)
            for (const { companyId, recorded: president } of recordedPresidents(recorded))
                expect(presidentOf(hydrated, companyId), companyId).toEqual(president)
        }
        expect(reached.some((recorded) => recordedPresidents(recorded).length > 0)).toBe(true)
    })

    if (check)
        it('reads the title’s rule data from code as the earlier logic stored it', () => {
            check(state, hydrator.hydrateState(state))
        })
}
