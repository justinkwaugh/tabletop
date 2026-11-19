import { AssetIds } from '$lib/art/assetMap.js'

/** The folder with every id present, each file named so a spec can find its url in markup. */
export function everyAssetSupplied(): Record<string, string> {
    return Object.fromEntries(AssetIds.map((id) => [`./supplied/${id}.webp`, `/art/${id}.webp`]))
}
