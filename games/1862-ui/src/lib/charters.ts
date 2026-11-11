import { assertExists } from '@tabletop/common'
import {
    Companies1862,
    Phases1862,
    outOfPlayCompanyIds,
    type Availability,
    type State1862
} from '@tabletop/1862'

/** A dealt charter: its company, that company's home, and whether it has started. */
export type Charter = { companyId: string; name: string; home: string; started: boolean }
export type CharterRow = {
    label: string
    note?: string
    charters: readonly Charter[]
    out?: true
}

/**
 * The board's charter areas (§2.4.1): the companies dealt to start at once, those that arrive
 * with the first B and C trains, and those out of the game, each in its dealt order.
 */
export function charterRows(state: State1862): CharterRow[] {
    const dealt = (wave: Availability) =>
        Object.entries(state.availability)
            .filter(([, arrives]) => arrives === wave)
            .map(([companyId]) => charter(state, companyId))
    const arrival = (wave: Availability, train: string) =>
        Phases1862.isAtLeast(state.phaseId, wave) ? 'available' : `first ${train} train`
    const now = dealt('A')
    return [
        { label: 'Now', note: `${now.length} dealt`, charters: now },
        { label: 'Phase B', note: arrival('B', 'B'), charters: dealt('B') },
        { label: 'Phase C', note: arrival('C', 'C'), charters: dealt('C') },
        {
            label: 'Out of play',
            charters: outOfPlayCompanyIds(state).map((companyId) => charter(state, companyId)),
            out: true
        }
    ]
}

// A company out of play has no place in the game's companies, so its name comes from the title.
function charter(state: State1862, companyId: string): Charter {
    const company = Companies1862.find((candidate) => candidate.id === companyId)
    assertExists(company, `Unknown 1862 company ${companyId}`)
    const played = state.companies.find((candidate) => candidate.id === companyId)
    return {
        companyId,
        name: company.name,
        home: company.home,
        started: !!played && (played.started || !!played.closed)
    }
}
