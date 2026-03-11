import { CompanyType, IndonesiaAreaType } from '@tabletop/indonesia'

export type AreaInteractionAction =
    | 'place-city'
    | 'grow-city'
    | 'start-company'
    | 'expand'
    | 'remove-siap-saji-area'
    | 'select-delivery-cultivated'
    | 'select-delivery-city'

export type ActiveAreaInteraction = {
    action: AreaInteractionAction
    validAreaIds: readonly string[]
    outlineColor: string
    maskedAreaType: IndonesiaAreaType
    maskInvalidAreas: boolean
}

type DeriveActiveAreaInteractionInput = {
    myPlayerId: string | null
    isMyTurn: boolean
    suppressBoardEffectsForHistory: boolean
    canRemoveSiapSajiArea: boolean
    siapSajiRemovalAreaIds: readonly string[]
    canGrowCity: boolean
    growCityValidAreaIds: readonly string[]
    canPlaceCity: boolean
    placeCityValidAreaIds: readonly string[]
    shippingExpandValidAreaIds: readonly string[]
    productionExpandValidAreaIds: readonly string[]
    deliverySelectionEnabled: boolean
    deliverySelectionStage: 'cultivated' | 'city' | 'shipping' | 'none'
    deliverySelectableAreaIds: readonly string[]
    deliveryAvailableCityAreaIds: readonly string[]
    selectedStartCompanyDeedType: CompanyType | null
    startCompanyValidAreaIds: readonly string[]
    playerOutlineColor: string | null
}

export function deriveActiveAreaInteraction(
    input: DeriveActiveAreaInteractionInput
): ActiveAreaInteraction | null {
    if (input.suppressBoardEffectsForHistory) {
        return null
    }

    if (input.myPlayerId && input.isMyTurn && input.canRemoveSiapSajiArea) {
        if (input.siapSajiRemovalAreaIds.length === 0) {
            return null
        }

        return {
            action: 'remove-siap-saji-area',
            validAreaIds: input.siapSajiRemovalAreaIds,
            outlineColor: '#fef3c7',
            maskedAreaType: IndonesiaAreaType.Land,
            maskInvalidAreas: true
        }
    }

    if (input.myPlayerId && input.isMyTurn && input.canGrowCity) {
        if (input.growCityValidAreaIds.length === 0 || !input.playerOutlineColor) {
            return null
        }

        return {
            action: 'grow-city',
            validAreaIds: input.growCityValidAreaIds,
            outlineColor: input.playerOutlineColor,
            maskedAreaType: IndonesiaAreaType.Land,
            maskInvalidAreas: true
        }
    }

    if (input.myPlayerId && input.isMyTurn && input.canPlaceCity) {
        if (input.placeCityValidAreaIds.length === 0 || !input.playerOutlineColor) {
            return null
        }

        return {
            action: 'place-city',
            validAreaIds: input.placeCityValidAreaIds,
            outlineColor: input.playerOutlineColor,
            maskedAreaType: IndonesiaAreaType.Land,
            maskInvalidAreas: true
        }
    }

    if (input.myPlayerId && input.shippingExpandValidAreaIds.length > 0 && input.playerOutlineColor) {
        return {
            action: 'expand',
            validAreaIds: input.shippingExpandValidAreaIds,
            outlineColor: input.playerOutlineColor,
            maskedAreaType: IndonesiaAreaType.Sea,
            maskInvalidAreas: false
        }
    }

    if (input.myPlayerId && input.productionExpandValidAreaIds.length > 0 && input.playerOutlineColor) {
        return {
            action: 'expand',
            validAreaIds: input.productionExpandValidAreaIds,
            outlineColor: input.playerOutlineColor,
            maskedAreaType: IndonesiaAreaType.Land,
            maskInvalidAreas: true
        }
    }

    if (input.myPlayerId && input.deliverySelectionEnabled && input.playerOutlineColor) {
        if (input.deliverySelectionStage === 'cultivated') {
            if (input.deliverySelectableAreaIds.length === 0) {
                return null
            }

            return {
                action: 'select-delivery-cultivated',
                validAreaIds: input.deliverySelectableAreaIds,
                outlineColor: input.playerOutlineColor,
                maskedAreaType: IndonesiaAreaType.Land,
                maskInvalidAreas: true
            }
        }

        if (input.deliverySelectionStage === 'city') {
            if (input.deliveryAvailableCityAreaIds.length === 0) {
                return null
            }

            return {
                action: 'select-delivery-city',
                validAreaIds: input.deliveryAvailableCityAreaIds,
                outlineColor: input.playerOutlineColor,
                maskedAreaType: IndonesiaAreaType.Land,
                maskInvalidAreas: false
            }
        }
    }

    if (input.myPlayerId && input.selectedStartCompanyDeedType) {
        if (input.startCompanyValidAreaIds.length === 0 || !input.playerOutlineColor) {
            return null
        }

        return {
            action: 'start-company',
            validAreaIds: input.startCompanyValidAreaIds,
            outlineColor: input.playerOutlineColor,
            maskedAreaType:
                input.selectedStartCompanyDeedType === CompanyType.Shipping
                    ? IndonesiaAreaType.Sea
                    : IndonesiaAreaType.Land,
            maskInvalidAreas: false
        }
    }

    return null
}
