import {
    BidBoxIds1822,
    LocalTrainId,
    LondonLocationId,
    TrainDepot1822,
    boxStack1822,
    sharedStack1822,
    LotKinds1822,
    MetropolitanId,
    concessionId,
    concessionMajorId,
    lotKind1822,
    major1822,
    minor1822,
    private1822,
    type LotKind1822,
    type State1822
} from '@tabletop/1822'
import { placeReference } from '@tabletop/18xx'
import type { BidBoxGroup } from '@tabletop/18xx-ui'
import { assertExists } from '@tabletop/common'

const KindLabels: Readonly<Record<LotKind1822, string>> = {
    minor: 'Minor companies',
    concession: 'Concessions',
    private: 'Private companies'
}

type LotState = Pick<
    State1822,
    'bidBoxes' | 'removedPrivateIds' | 'removedCompanyIds' | 'trainInventory'
>

/**
 * What an unsold minor's box costs at the round's end (§4.10.3): an L-train for each minor no one
 * bid on while any are left, and the minor in box 1 leaves the game with the next train as well.
 */
function minorUnsoldNotes(state: LotState, boxCount: number): (string | undefined)[] {
    const localTrainsLeft = TrainDepot1822.remaining(state.trainInventory, LocalTrainId) !== 0
    return Array.from({ length: boxCount }, (_, index) =>
        index === 0
            ? `If unsold, it leaves the game and removes ${localTrainsLeft ? 'two trains' : 'one train'}`
            : localTrainsLeft
              ? 'If unsold, it removes one train'
              : undefined
    )
}

/** The certificates of a kind a game plays without, as its boxes name them (§2.1.7, §6.2.1). */
function removedLots(state: LotState, kind: LotKind1822): string[] {
    if (kind === 'private') return [...(state.removedPrivateIds ?? [])]
    const companies = state.removedCompanyIds ?? []
    return kind === 'minor'
        ? companies.filter((id) => !!minor1822(id))
        : companies.filter((id) => !!major1822(id)).map(concessionId)
}

/** The boxes of each kind with the stack, or in 1822+ the stacks, they fill from (§4.9.1, §2.1.7). */
export function bidBoxGroups(state: LotState): BidBoxGroup[] {
    const { bidBoxes } = state
    return LotKinds1822.map((kind) => {
        const boxIds = BidBoxIds1822.filter((boxId) => boxId.startsWith(`${kind}:`))
        const shared = sharedStack1822(bidBoxes, kind)
        const removed = removedLots(state, kind)
        const group = {
            id: kind,
            label: KindLabels[kind],
            boxIds,
            ...(removed.length ? { removed } : {}),
            ...(kind === 'minor' ? { unsoldNotes: minorUnsoldNotes(state, boxIds.length) } : {})
        }
        if (shared) return { ...group, upcoming: shared.lotIds }
        const boxStacks = boxIds.map((boxId) => boxStack1822(bidBoxes, boxId).lotIds)
        return { ...group, upcoming: boxStacks.flat(), boxStacks }
    })
}

/** Each stack of certificates still to come, as P17 moves one within its own (Table 3). */
export function lotStacks(state: LotState): { id: string; label: string; lotIds: string[] }[] {
    return bidBoxGroups(state).flatMap((group) =>
        group.boxStacks
            ? group.boxStacks.map((lotIds, index) => ({
                  id: group.boxIds[index],
                  label: `${group.label}, box ${index + 1}`,
                  lotIds: [...lotIds]
              }))
            : [{ id: group.id, label: group.label, lotIds: [...group.upcoming] }]
    )
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
                    ? `Beside a ${placeReference(LondonLocationId)} station`
                    : placeReference(minor.home.locationId)
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
            detail: `${placeReference(major.home.locationId)} to ${placeReference(major.destination.locationId)}`
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
