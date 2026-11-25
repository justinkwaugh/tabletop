import { expect, it } from 'vitest'
import { render } from 'svelte/server'
import { moneyFormat, type OperatingResult, type RouteResult, type Train } from '@tabletop/18xx'
import TrainRunTable from '../lib/routes/TrainRunTable.svelte'
import { titleRunNames } from '../lib/routes/routePresentation.js'

const train = (id: string): Train => ({
    id,
    definitionId: '2',
    status: 'owned',
    owner: { kind: 'company', companyId: 'R' }
})
const route = (trainId: string, revenue: number): RouteResult => ({
    trainId,
    definitionId: '2',
    start: { locationId: 'A1', nodeId: 'city' },
    paths: [{ locationId: 'A1', pathId: 'edge-0' }],
    visits: [],
    payments: [],
    distance: 2,
    revenue
})

function table(result: OperatingResult, runBonusName?: string): string {
    return render(TrainRunTable, {
        props: {
            money: moneyFormat('¥'),
            result,
            trains: [train('a'), train('b'), train('c')],
            trainName: (id) => id,
            trainColors: {},
            runNames: titleRunNames({ runBonusName })
        }
    }).body.replace(/<!--[^]*?-->/g, '')
}

it('lists the run’s bonus beside its routes so the trains and bonus add up to the total', () => {
    const body = table(
        { companyId: 'R', routes: [route('a', 40), route('b', 40)], revenue: 130, bonus: 50 },
        'share price bonus'
    )
    expect(body).toMatch(/<th scope="row"[^>]*>Share price bonus<\/th><td class="income[^>]*>¥50</)
    expect(body.indexOf('Share price bonus')).toBeLessThan(body.indexOf('Total'))
})

it('lists no bonus row for a run without one', () => {
    const body = table(
        { companyId: 'R', routes: [route('a', 40)], revenue: 40 },
        'share price bonus'
    )
    expect(body).not.toContain('Share price bonus')
})
