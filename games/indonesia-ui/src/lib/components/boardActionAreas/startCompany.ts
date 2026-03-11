import { CompanyType, Era, Good } from '@tabletop/indonesia'

type StartCompanyAvailableDeed =
    | {
          id: string
          type: CompanyType.Production
          era: Era
          region: string
          good: Good
      }
    | {
          id: string
          type: CompanyType.Shipping
          era: Era
          region: string
          sizes: {
              A?: number
              B?: number
              C?: number
          }
      }

export type StartCompanyDeedEntry = {
    deedId: string
    type: CompanyType
    x: number
    y: number
}

export function deriveStartCompanyDeeds(params: {
    enabled: boolean
    availableDeeds: readonly StartCompanyAvailableDeed[]
    positionForDeed(deed: StartCompanyAvailableDeed): { x: number; y: number } | null
}): StartCompanyDeedEntry[] {
    if (!params.enabled) {
        return []
    }

    const deeds: StartCompanyDeedEntry[] = []
    for (const deed of params.availableDeeds) {
        const position = params.positionForDeed(deed)
        if (!position) {
            continue
        }

        deeds.push({
            deedId: deed.id,
            type: deed.type,
            x: position.x,
            y: position.y
        })
    }

    return deeds
}

export function startCompanyDeedById(
    deeds: readonly StartCompanyDeedEntry[]
): Map<string, StartCompanyDeedEntry> {
    return new Map(deeds.map((deed) => [deed.deedId, deed]))
}

export function selectedStartCompanyDeed(
    deedsById: ReadonlyMap<string, StartCompanyDeedEntry>,
    selectedStartCompanyDeedId: string | null
): StartCompanyDeedEntry | null {
    if (!selectedStartCompanyDeedId) {
        return null
    }

    return deedsById.get(selectedStartCompanyDeedId) ?? null
}
