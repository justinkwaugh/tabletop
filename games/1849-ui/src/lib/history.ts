import {
    GaribaldiId,
    lastCertificateId,
    messinaEarthquakeOf,
    StationTokenCount1849,
    TokenFees1849,
    type Earthquake1849,
    type State1849
} from '@tabletop/1849'
import {
    isChoosePresidencyExchange,
    isFloatCompany,
    isStartCompany,
    type FloatCompany
} from '@tabletop/18xx'
import type { TitleActionDescription, TitleCallout } from '@tabletop/18xx-ui'
import { Presentation1849 } from './presentation.js'
import { assertExists } from '@tabletop/common'

const names = new Intl.ListFormat('en', { type: 'conjunction' })

/** The Messina earthquake, called out under the phase change that set it off (§12). */
export function earthquakeCallout(
    earthquake: Earthquake1849,
    stations: State1849['stations'],
    companyName: (companyId: string) => string
): TitleCallout {
    const losers = earthquake.lostStationIds.map((stationId) => {
        const station = stations.find((candidate) => candidate.id === stationId)
        assertExists(station, 'A station lost at Messina stays on record')
        return companyName(station.companyId)
    })
    const closed = earthquake.closedCorporation ? companyName(GaribaldiId) : undefined
    const effects = [
        ...(earthquake.removedTile ? ['It is downgraded to yellow.'] : []),
        ...(losers.length
            ? [
                  `${names.format(losers)} ${losers.length === 1 ? 'loses its station' : 'lose their stations'} there for good.`
              ]
            : []),
        ...(closed ? [`${closed} has no other station and closes.`] : []),
        ...(!earthquake.removedTile && !losers.length && !closed
            ? ['It had no upgrade or station to lose.']
            : []),
        `It cannot be upgraded${earthquake.removedTile ? ' again' : ''} until after the next stock round.`
    ]
    return { title: 'Earthquake at Messina', text: effects.join(' ') }
}

/**
 * The station tokens a corporation bought as it floated (§9.4). The Garibaldi pays with the home
 * it chooses as it starts, unless it came with the Reale Società d'Affari, which the bank funds
 * as it floats (§8.1, §9.4.1).
 */
export function floatTokenFee(action: FloatCompany): number | undefined {
    const fee = TokenFees1849[action.companyId]
    if (action.companyId !== GaribaldiId) return fee
    const funded = action.metadata?.payments.some((payment) => payment.from.kind === 'bank')
    return funded ? fee : undefined
}

/**
 * 1849's own history: the shared rows, with the station tokens a corporation buys as it floats,
 * or the Garibaldi with the home it chooses, and the Messina earthquake called out.
 */
export function describe1849Action(stations: () => State1849['stations']): TitleActionDescription {
    return (action, { companyName }, shared) => {
        // The outgoing president took the last certificate or two single ones (§9.5).
        if (isChoosePresidencyExchange(action))
            return {
                ...shared(),
                text: `Took ${action.certificateIds.includes(lastCertificateId(action.companyId)) ? 'the last certificate' : 'two single certificates'} for ${companyName(action.companyId)}’s president’s certificate`
            }
        const earthquake = messinaEarthquakeOf(action)
        if (earthquake)
            return {
                ...shared(),
                callouts: [earthquakeCallout(earthquake, stations(), companyName)]
            }
        const fee = isFloatCompany(action)
            ? floatTokenFee(action)
            : isStartCompany(action)
              ? action.metadata?.home?.cost || undefined
              : undefined
        if (fee === undefined) return undefined
        const row = shared()
        const tokens = `${Presentation1849.money(fee)} for its ${StationTokenCount1849} station tokens`
        return { ...row, detail: row.detail ? `${row.detail} · ${tokens}` : tokens }
    }
}
