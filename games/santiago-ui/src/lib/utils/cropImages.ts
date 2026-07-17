import { cropImageUrls } from './imageUrls.js'

const CROP_IMAGE_KEY: Record<string, string> = {
    bananas: 'bananas',
    coconut: 'coconut',
    grapes: 'grapes',
    watermelon: 'watermelon',
    chili: 'chili',
    // legacy names from before rename
    sugarcane: 'bananas',
    cotton: 'coconut',
    corn: 'grapes',
    indigo: 'watermelon',
    tobacco: 'chili'
}

export function fieldImageUrl(crop: string, farmerCount: number): string {
    const imageKey = CROP_IMAGE_KEY[crop] ?? crop
    const images = cropImageUrls[imageKey]

    if (!images) {
        throw new Error(`Missing field image for crop "${crop}"`)
    }

    return images[farmerCount >= 2 ? 1 : 0]
}
