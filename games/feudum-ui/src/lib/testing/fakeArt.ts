import { AssetIds } from '$lib/art/assetMap.js'

export function everyAssetSupplied(): Record<string, string> {
    return Object.fromEntries(AssetIds.map((id) => [`./supplied/${id}.webp`, `/art/${id}.webp`]))
}
