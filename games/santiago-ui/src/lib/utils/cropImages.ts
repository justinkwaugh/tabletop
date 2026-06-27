const CROP_IMAGE: Record<string, string> = {
    bananas: 'bananas', coconut: 'coconut', grapes: 'grapes',
    watermelon: 'watermelon', chili: 'chili',
    // legacy names from before rename
    sugarcane: 'bananas', cotton: 'coconut', corn: 'grapes',
    indigo: 'watermelon', tobacco: 'chili',
}

export function fieldImageUrl(crop: string, farmerCount: number): string {
    const n = farmerCount >= 2 ? 2 : 1
    return `/${CROP_IMAGE[crop] ?? crop}${n}.png`
}
