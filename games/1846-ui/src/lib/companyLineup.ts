import {
    Corporations,
    DraftCompanies,
    type Corporation,
    type EighteenFortySixProjectedState
} from '@tabletop/1846'

/** Which companies setup kept and removed for the player count, as the draft shows them. */
export type CompanyLineup = {
    playerCount: number
    corporations: readonly Corporation[]
    removedCorporations: readonly Corporation[]
    privateNames: readonly string[]
    removedPrivateNames: readonly string[]
    /** Pass cards shuffled into the hidden draft deck; none in the public two-player draft. */
    passCards: number
}

type LineupState = Pick<
    EighteenFortySixProjectedState,
    'players' | 'removedCorporationIds' | 'companies' | 'draft'
>

export function companyLineup(state: LineupState, name: (id: string) => string): CompanyLineup {
    const removed = (id: string) => state.removedCorporationIds.includes(id)
    // State records no removed private ids: setup only creates the privates it keeps.
    const kept = (id: string) => state.companies.some((company) => company.id === id)
    return {
        playerCount: state.players.length,
        corporations: Corporations.filter((company) => !removed(company.id)),
        removedCorporations: Corporations.filter((company) => removed(company.id)),
        privateNames: DraftCompanies.filter((company) => kept(company.id)).map((company) =>
            name(company.id)
        ),
        removedPrivateNames: DraftCompanies.filter((company) => !kept(company.id)).map((company) =>
            name(company.id)
        ),
        // createOpening1846 deals one blank card per player into the hidden deck.
        passCards: state.draft?.kind === 'hidden' ? state.players.length : 0
    }
}
