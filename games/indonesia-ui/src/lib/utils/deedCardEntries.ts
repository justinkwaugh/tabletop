import { deedCardKindFor } from '$lib/components/CompanyDeed.svelte'
import { DEED_CARD_POSITIONS } from '$lib/definitions/deedCardPositions.js'
import {
    deedTextLayoutForKeys,
    type CompanyDeedTextLayout
} from '$lib/definitions/deedTextLayout.js'
import {
    deedPositionLookupKeys,
    shippingSizeEntriesFromRecord,
    type ShippingSizeEntry
} from '$lib/utils/deeds.js'
import type { CompanyCardType } from '$lib/types/companyCard.js'
import {
    type AnyDeed,
    CompanyType,
    type HydratedIndonesiaGameState
} from '@tabletop/indonesia'
import { getRegionName } from '$lib/definitions/regions.js'

export type DeedCardEntry = {
    key: string
    deedId: string
    isShipping: boolean
    text: string
    textLayout: CompanyDeedTextLayout | null
    cardKind: CompanyCardType
    shippingSizes: readonly ShippingSizeEntry[] | null
    cardX: number
    cardY: number
}

export function deedCardEntryForDeed(deed: AnyDeed): DeedCardEntry | null {
    const positionKeys = deedPositionLookupKeys(deed)
    const isShipping = deed.type === CompanyType.Shipping
    if (!isShipping && deed.type !== CompanyType.Production) {
        return null
    }

    const regionName = getRegionName(deed.region)
    const cardKind = deedCardKindFor(deed)
    const cardPosition = positionKeys
        .map((key) => DEED_CARD_POSITIONS[key])
        .find((point) => point !== undefined)
    if (!cardPosition) {
        return null
    }

    return {
        key: deed.id,
        deedId: deed.id,
        isShipping,
        text: regionName,
        textLayout: deedTextLayoutForKeys(positionKeys),
        cardKind,
        shippingSizes: isShipping ? shippingSizeEntriesFromRecord(deed.sizes) : null,
        cardX: cardPosition.x,
        cardY: cardPosition.y
    }
}

export function availableDeedCardEntriesForState(
    gameState: HydratedIndonesiaGameState
): DeedCardEntry[] {
    const cards: DeedCardEntry[] = []
    for (const deed of gameState.availableDeeds) {
        const entry = deedCardEntryForDeed(deed)
        if (entry) {
            cards.push(entry)
        }
    }
    return cards
}
