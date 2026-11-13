import {
    BidBoxIds1822,
    LotKinds1822,
    Map1822,
    MetropolitanId,
    concessionMajorId,
    lotKind1822,
    major1822,
    minor1822,
    private1822,
    type LotKind1822
} from '@tabletop/1822'
import type { BidBoxes } from '@tabletop/18xx'
import type { BidBoxGroup } from '@tabletop/18xx-ui'
import { assertExists } from '@tabletop/common'

const KindLabels: Readonly<Record<LotKind1822, string>> = {
    minor: 'Minor companies',
    concession: 'Concessions',
    private: 'Private companies'
}

export function placeName(locationId: string): string {
    return Map1822.location(locationId).name ?? locationId
}

/** The boxes of each kind with the stack they fill from (§4.9.1). */
export function bidBoxGroups(bidBoxes: BidBoxes): BidBoxGroup[] {
    return LotKinds1822.map((kind) => ({
        id: kind,
        label: KindLabels[kind],
        boxIds: BidBoxIds1822.filter((boxId) => boxId.startsWith(`${kind}:`)),
        upcoming: bidBoxes.stacks.find((stack) => stack.id === kind)?.lotIds ?? []
    }))
}

export type Lot1822 =
    | { kind: 'minor'; id: string; markId: string; initials: string; name: string; detail: string }
    | {
          kind: 'concession'
          id: string
          markId: string
          initials: string
          name: string
          detail: string
      }
    | {
          kind: 'private'
          id: string
          name: string
          power: string
          income: string
          description: string
      }

/** What a certificate in a bidding box is, as the box shows it (Tables 3, 4 and 6). */
export function lot1822(lotId: string, money: (amount: number) => string): Lot1822 {
    const kind = lotKind1822(lotId)
    if (kind === 'minor') {
        const minor = minor1822(lotId)
        assertExists(minor, `Minor company ${lotId} is in the game`)
        return {
            kind,
            id: lotId,
            markId: lotId,
            initials: minor.initials,
            name: minor.name,
            detail:
                lotId === MetropolitanId || !minor.home
                    ? 'Beside a London station'
                    : placeName(minor.home.locationId)
        }
    }
    if (kind === 'concession') {
        const major = major1822(concessionMajorId(lotId) ?? '')
        assertExists(major, `Concession ${lotId} belongs to a major company`)
        return {
            kind,
            id: lotId,
            markId: major.id,
            initials: major.initials,
            name: major.name,
            detail: `${placeName(major.home.locationId)} to ${placeName(major.destination.locationId)}`
        }
    }
    const company = private1822(lotId)
    assertExists(company, `Private company ${lotId} is in the game`)
    return {
        kind,
        id: lotId,
        name: company.name,
        power: company.power,
        income: company.revenuePerPhase
            ? `${money(company.revenue)} a phase`
            : `${money(company.revenue)} a round`,
        description: company.description
    }
}

export function lotName(lotId: string): string {
    const kind = lotKind1822(lotId)
    if (kind === 'minor') return `${lotId} ${minor1822(lotId)?.name ?? ''}`.trim()
    if (kind === 'concession') {
        const major = major1822(concessionMajorId(lotId) ?? '')
        return major ? `${major.initials} concession` : lotId
    }
    const company = private1822(lotId)
    return company ? `${lotId} ${company.name} (${company.power})` : lotId
}
