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
