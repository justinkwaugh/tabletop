import {
    GaribaldiId,
    messinaEarthquakeOf,
    type Earthquake1849,
    type State1849
} from '@tabletop/1849'
import type { TitleActionDescription, TitleCallout } from '@tabletop/18xx-ui'
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

/** 1849's own history: the shared rows, with the Messina earthquake called out. */
export function describe1849Action(stations: () => State1849['stations']): TitleActionDescription {
    return (action, { companyName }, shared) => {
        const earthquake = messinaEarthquakeOf(action)
        return earthquake
            ? { ...shared(), callouts: [earthquakeCallout(earthquake, stations(), companyName)] }
            : undefined
    }
}
