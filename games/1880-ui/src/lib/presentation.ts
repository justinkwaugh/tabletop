import {
    BankPoolId1880,
    BcrId,
    ForeignInvestors1880,
    MajorIds1880,
    P2Id,
    P3Id,
    P4Id,
    P5Id,
    P7Id,
    MajorHomes1880,
    Market1880,
    Map1880,
    ReservePoolId1880,
    TitleRules1880,
    communist,
    floatPercent,
    associatedCompany,
    isInvestor,
    requireState1880,
    type HydratedState1880,
    type State1880
} from '@tabletop/1880'
import { getCompany, playerLoan, privateOwner, sameOwner } from '@tabletop/18xx'
import {
    moneyFormat,
    type PhaseNotice,
    type TitlePresentation,
    type UnstartedCompanies
} from '@tabletop/18xx-ui'
import { CompanyNames1880 } from './companyPresentation.js'
import { investorFlag } from './investorFlags.js'
import { operatingOrderList } from './operatingOrder.js'
import { PhaseChart1880 } from './phaseChart.js'
import { PhaseColors1880, TrainColors1880 } from './trainPresentation.js'

const money = moneyFormat(TitleRules1880.currencySymbol)

const PoolNames: Readonly<Record<string, string>> = {
    [BankPoolId1880]: 'Bank',
    [ReservePoolId1880]: 'Reserved'
}

/** Every major starts at its printed home; the BCR only from P6 (§VI, §VIII). */
const Unstarted1880: UnstartedCompanies<State1880> = {
    onOffer: (_state, companyId) => companyId !== BcrId && MajorIds1880.includes(companyId),
    home: (_state, companyId) => ({ locationIds: [MajorHomes1880[companyId]] })
}

const permitsOf = (state: State1880, companyId: string) =>
    requireState1880(state).permits[companyId]

/**
 * The privates whose powers serve all their owner's companies (§VI): foreign investors use all
 * but P5's permit and P7's exchange, which are for majors alone.
 */
const MajorPowerIds: readonly string[] = [P2Id, P3Id, P4Id, P5Id, P7Id]
const InvestorPowerIds: readonly string[] = [P2Id, P3Id, P4Id]

/** The open privates of a company's director that give the company a power. */
function directorPowers(state: HydratedState1880, companyId: string): string[] {
    const director = getCompany(state, companyId).president
    if (!director) return []
    const powerIds = isInvestor(companyId) ? InvestorPowerIds : MajorPowerIds
    return powerIds.filter((privateId) => {
        const owner = privateOwner(state, privateId)
        return (
            !getCompany(state, privateId).closed &&
            owner?.kind === 'player' &&
            sameOwner(owner, director)
        )
    })
}

/** The Communist Takeover's rules, from the first 4-train to the first 6-train (§XIV; R55, R56). */
const CommunistTakeover: PhaseNotice = {
    label: 'Communist Takeover',
    title: 'Communist Takeover',
    summary:
        'In force from the first 4-train until the first 6-train opens the Shanghai Stock Exchange.',
    rules: [
        'Share prices are frozen: no price moves at all, in share rounds or operating rounds, whether a company pays, withholds, has no train or has shares sold.',
        'A director may not sell shares of their own company. This also applies to emergency sales for a train.',
        'Private companies pay nothing, now and for the rest of the game; their special powers remain.',
        'Foreign investors no longer operate, now and for the rest of the game, but still merge with their company when the networks join.',
        'Majors float with 40% held by the director.'
    ]
}

export const Presentation1880: TitlePresentation<State1880> = {
    money,
    phaseChart: PhaseChart1880,
    trainColors: TrainColors1880,
    phaseColors: PhaseColors1880,
    marketPoolId: BankPoolId1880,
    poolName: (poolId) => PoolNames[poolId] ?? poolId,
    companyNames: CompanyNames1880,
    unstartedCompanies: Unstarted1880,
    privatePurchaseHeading: 'Privates',
    marketZones: [
        { color: 'pink', name: 'Par', description: 'A starting price: ¥100, 90, 80 or 70.' },
        {
            color: 'yellow',
            name: '+5',
            description: 'A company starting its turn here adds ¥50 to its income.',
            marksCompanyValue: true,
            marks: ['+5']
        },
        {
            color: 'orange',
            name: '+10',
            description: 'A company starting its turn here adds ¥100 to its income.',
            marksCompanyValue: true,
            marks: ['+10']
        },
        {
            color: 'peach',
            name: '+15',
            description: 'A company starting its turn here adds ¥150 to its income.',
            marksCompanyValue: true,
            fill: { kind: 'solid', color: '#f3c9a8' },
            marks: ['+15']
        },
        {
            color: 'olive',
            name: '+20',
            description: 'A company starting its turn here adds ¥200 to its income.',
            marksCompanyValue: true,
            fill: { kind: 'solid', color: '#c9c98a' },
            marks: ['+20']
        },
        {
            color: 'green',
            name: '+40',
            description: 'The top of the chart: a company starting its turn here adds ¥400.',
            marksCompanyValue: true,
            marks: ['+40']
        }
    ],
    companyColumns: [
        {
            id: 'permits',
            label: 'Permits',
            beforeLastRun: true,
            text: (state, companyId) => permitsOf(state, companyId) ?? ''
        }
    ],
    companyFacts(state, companyId) {
        if (isInvestor(companyId)) {
            const companyIdOf = associatedCompany(requireState1880(state), companyId)
            return companyIdOf
                ? [
                      {
                          label: 'Joins',
                          value: CompanyNames1880[companyIdOf]?.initials ?? companyIdOf
                      }
                  ]
                : []
        }
        const company = getCompany(state, companyId)
        const titleState = requireState1880(state)
        const permits = permitsOf(state, companyId)
        if (!company.started || !permits) return []
        // The par slot shows on the board's operating order list.
        return [
            { label: 'Permits', value: [...permits].join(' '), below: true },
            ...(company.floated
                ? [
                      {
                          label: 'Capital',
                          value: titleState.fullyCapitalized.includes(companyId) ? 'Full' : 'Half'
                      }
                  ]
                : [])
        ]
    },
    // A major's director's certificate is 20, 30 or 40% (§XII), so the mark gives its shares:
    // P2, P3, P4. An investor's owner holds it whole, with a plain P.
    presidentMarkShowsShares: (_state, companyId) => !isInvestor(companyId),
    // The share a director must hold for a major to float, by phase (§XII).
    gameFacts: (state) => [{ label: 'Float', value: `${floatPercent(state.phaseId)}%` }],
    phaseNotice: (state) => (communist(state) ? CommunistTakeover : undefined),
    // The action panel names companies by their initials, as players call them.
    actionCompanyInitials: true,
    // Privates have no value (§XV).
    privatesWithoutValue: true,
    // P4 takes ¥20 off river hexes for its owner's companies, investors too (§VI), so the map
    // shows the operating company the costs it pays.
    terrainDiscounts(state, companyId): Readonly<Record<string, number>> {
        return directorPowers(requireState1880(state), companyId).includes(P4Id)
            ? { water: 20 }
            : {}
    },
    // A start's par slot is picked from its row of the board's operating order list (§XII).
    startChoiceSpaces(state, choiceId, marketSpaceId) {
        if (choiceId !== 'slot') return undefined
        const price = Market1880.space(marketSpaceId).price
        const row = operatingOrderList(state).rows.find((entry) => entry.price === price)
        return row?.slots.map((slot, index) => {
            const place = `${slot.place}`
            if (slot.companyId) {
                const name = CompanyNames1880[slot.companyId]?.initials ?? slot.companyId
                return {
                    label: place,
                    companyId: slot.companyId,
                    description: `${place}. ${money(price)}: ${name}`
                }
            }
            return {
                label: place,
                optionId: String(index),
                description: `${place}. ${money(price)}: free`
            }
        })
    },
    // A company's card lists the powers its director's privates give it (§VI).
    companyPowers: {
        heading: 'Powers',
        privateIds: (state, companyId) => directorPowers(requireState1880(state), companyId)
    },
    // A major's card carries the flag of each investor that will join it (§VII).
    companyTokenBadges(state, companyId) {
        if (isInvestor(companyId)) return []
        const titleState = requireState1880(state)
        return ForeignInvestors1880.filter(
            (investor) =>
                !getCompany(state, investor.id).closed &&
                associatedCompany(titleState, investor.id) === companyId
        ).map((investor) => ({
            imageUrl: investorFlag(investor.id),
            description: `The ${investor.name} joins this company`
        }))
    },
    playerFacts(state, playerId) {
        const debt = playerLoan(requireState1880(state), playerId)
        return debt ? [{ label: 'Debt', value: money(debt) }] : []
    },
    startNotes: (_state, companyId) =>
        Map1880.location(MajorHomes1880[companyId] ?? 'F8').name
            ? [`Home: ${Map1880.location(MajorHomes1880[companyId] ?? 'F8').name}`]
            : []
}
