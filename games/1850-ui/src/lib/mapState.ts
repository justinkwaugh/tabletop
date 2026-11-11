import { Companies1850, MesabiLocationId, type TitleState1850 } from '@tabletop/1850'
import type { MapStateData } from '@tabletop/18xx'

type MarkerFacts = Pick<TitleState1850, 'edgeTokens' | 'mesabiRights'>

// The Northwest prints its three companies' tokens in a column down both of its hexes.
const EdgeMarkerHexes: Readonly<Record<string, string>> = { NP: 'B1', MILW: 'B1' }

export const edgeAreaKind = (companyId: string) => `edge-area:${companyId}`
export const edgeTokenKind = (companyId: string) => `edge-token:${companyId}`
export const mesabiKind = (index: number, companyId: string) => `mesabi:${index}:${companyId}`

export function edgeMarkers({ edgeTokens }: Pick<MarkerFacts, 'edgeTokens'>) {
    return Companies1850.flatMap((company) =>
        company.edgeArea
            ? [
                  {
                      locationId: EdgeMarkerHexes[company.id] ?? company.edgeArea,
                      kind: (edgeTokens.includes(company.id) ? edgeTokenKind : edgeAreaKind)(
                          company.id
                      )
                  }
              ]
            : []
    )
}

export function mesabiMarkers({ mesabiRights }: Pick<MarkerFacts, 'mesabiRights'>) {
    return mesabiRights.map((companyId, index) => ({
        locationId: MesabiLocationId,
        kind: mesabiKind(index, companyId)
    }))
}

export function mapState1850<State extends MapStateData & MarkerFacts>(state: State) {
    return {
        ...state,
        locationMarkers: [...edgeMarkers(state), ...mesabiMarkers(state)]
    }
}
