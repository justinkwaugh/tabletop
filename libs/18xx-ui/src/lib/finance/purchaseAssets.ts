import type { PurchaseAsset } from '@tabletop/18xx'

/** A purchase asset's own id, unique within its kind. */
export function purchaseAssetId(asset: PurchaseAsset): string {
    switch (asset.kind) {
        case 'train':
            return asset.trainId
        case 'private':
            return asset.privateCompanyId
        case 'company':
            return asset.companyId
        case 'station':
            return asset.stationId
    }
}

/** A key for a purchase asset, unique across kinds. */
export function purchaseAssetKey(asset: PurchaseAsset): string {
    return `${asset.kind}:${purchaseAssetId(asset)}`
}

/** A private or a whole company, bought as a company; a station or a train is not. */
export function isCompanyAsset(
    asset: PurchaseAsset
): asset is Extract<PurchaseAsset, { kind: 'private' | 'company' }> {
    return asset.kind === 'private' || asset.kind === 'company'
}

/** How a purchase asset is named, by its kind. */
export type PurchaseAssetNames = {
    company(companyId: string): string
    station(stationId: string): string
    train(trainId: string): string
}

/** A purchase asset's name: a private or company by its own, a station or train as the title words it. */
export function purchaseAssetName(asset: PurchaseAsset, names: PurchaseAssetNames): string {
    switch (asset.kind) {
        case 'private':
            return names.company(asset.privateCompanyId)
        case 'company':
            return names.company(asset.companyId)
        case 'station':
            return names.station(asset.stationId)
        case 'train':
            return names.train(asset.trainId)
    }
}
