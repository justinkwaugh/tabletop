import { CompanyNames1860 } from './companyPresentation.js'
import { southernFormed, type State1860 } from '@tabletop/1860'
import type { PhaseNotice } from '@tabletop/18xx-ui'

const initials = (companyId: string) => CompanyNames1860[companyId]?.initials ?? companyId

/**
 * The Southern Railway and British Rail, announced under the phase strip once the first 9+5
 * is bought (Formation of the Southern Railway; Railway Nationalisation).
 */
export function endgameNotice(state: State1860): PhaseNotice | undefined {
    const nationalisation = state.nationalisation
    if (nationalisation) {
        const closed = nationalisation.closedCompanyIds
        return {
            label: 'British Rail',
            title: 'British Rail has formed',
            summary: closed.length
                ? `Closed: ${closed.map(initials).join(', ')}`
                : 'Operating rounds until every company closes',
            rules: [
                'No more stock rounds: operating rounds follow one another, and the bank has no limit.',
                'Every company runs for the most it can, each train counting its large-station allowance only, and pays out its whole revenue; one in receivership pays nothing.',
                'Trains come only from the bank: companies no longer sell trains to one another.',
                'After each operating round the companies that paid the least close, all those tied at the lowest; one alone at the lowest closes with those paying the next lowest. The last one or two run once more.',
                'A closed company’s price stands for the rest of the game.'
            ]
        }
    }
    if (!southernFormed(state)) return undefined
    return {
        label: 'Southern Railway',
        title: 'The Southern Railway has formed',
        summary: state.southernStockRound
            ? 'No track, no bases; halts pay nothing'
            : 'From the next stock round: no track, no bases',
        rules: [
            'From the first stock round after the first 9+5 is bought, no track is laid or upgraded, no bases are placed, and halts no longer pay their £10.',
            'British Rail forms at the end of the first stock or operating round in which every company with a director has a train.'
        ]
    }
}
