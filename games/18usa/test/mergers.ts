import { activeConversionRound, addCompanyStations } from '@tabletop/18xx'
import { EighteenUSAConversionRounds } from '../src/companyRounds.js'
import { EighteenUSAMap } from '../src/map.js'
import { EighteenUSAStations, StationLimit } from '../src/owedStations.js'
import { MexicoLocationIds } from '../src/mapFeatures.js'
import { ExpressFreightMarker } from '../src/resourceMarkers.js'
import { botMove, Random } from './bot.js'
import { edit, kit, type Table } from './kit.js'
import { givePrivate } from './positions.js'

/** A seeded game's first merger round in which the deciding company may merge with another. */
export function mergerChoice(): { game: Table; companyId: string; targetId: string } {
    for (let seed = 1; seed < 40; seed++) {
        const game = kit.table(4, seed)
        const random = new Random(seed)
        for (let count = 0; count < 8000; count++) {
            const state = game.state
            if (state.machineState === 'GameOver') break
            const round = activeConversionRound(state)
            const companyId = EighteenUSAConversionRounds.companyId(state)
            if (state.machineState === 'MergerRound' && round && companyId) {
                const conversions = EighteenUSAConversionRounds.rules.conversions
                const [targetId] = conversions.mergeTargetIds(state, companyId, round.convertedIds)
                if (targetId) return { game, companyId, targetId }
            }
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
    }
    throw new Error('No merger came')
}

/** The company holds P8 with its marker in Mexico and as many placed stations as the limit allows. */
export function atLimitWithExpressFreight(game: Table, companyId: string, targetId: string) {
    edit(game, (state) => {
        givePrivate(state, 'P8', companyId)
        state.locationMarkers = [
            ...(state.locationMarkers ?? []),
            { locationId: MexicoLocationIds[0], kind: ExpressFreightMarker, privateCompanyId: 'P8' }
        ]
        const taken = new Set(
            state.stations.flatMap((station) =>
                station.status === 'placed' &&
                (station.companyId === companyId || station.companyId === targetId)
                    ? [station.position.locationId]
                    : []
            )
        )
        const free = EighteenUSAMap.definition.locations
            .filter(
                (location) =>
                    !taken.has(location.id) &&
                    location.preprintedTile.nodes.some(
                        (node) => node.kind === 'city' && node.stationSlots > 0
                    )
            )
            .map((location) => location.id)
        const missing = StationLimit - EighteenUSAStations.limitedStations(state, companyId)
        addCompanyStations(state, companyId, missing)
        state.stations = state.stations.map((station) => {
            if (station.companyId !== companyId || station.status !== 'available') return station
            const locationId = free.shift()
            if (!locationId) throw new Error('No free city')
            return {
                ...station,
                status: 'placed',
                position: { locationId, nodeId: 'city', slot: 0 }
            }
        })
    })
}
