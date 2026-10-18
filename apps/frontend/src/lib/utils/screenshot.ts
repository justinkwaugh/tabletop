import { BUG_REPORT_SCREENSHOT_MAX_BYTES } from '@tabletop/common'

const MAX_EDGE_PX = 2560
const JPEG_QUALITY = 0.9
const SHRINK_STEP = 0.8
const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,'

export type Screenshot = {
    base64: string
    previewUrl: string
}

export function imageFiles(files: Iterable<File>): File[] {
    return [...files].filter((file) => file.type.startsWith('image/'))
}

export async function screenshotFromImage(file: File): Promise<Screenshot> {
    const bitmap = await createImageBitmap(file)
    try {
        const jpeg = await shrinkUntilFits(
            (scale) => encodeJpeg(bitmap, scale),
            Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height))
        )
        return { base64: await base64Of(jpeg), previewUrl: URL.createObjectURL(jpeg) }
    } finally {
        bitmap.close()
    }
}

export async function shrinkUntilFits(
    encodeAt: (scale: number) => Promise<Blob>,
    startScale: number
): Promise<Blob> {
    let scale = startScale
    let encoded = await encodeAt(scale)
    while (encoded.size > BUG_REPORT_SCREENSHOT_MAX_BYTES) {
        scale *= SHRINK_STEP
        encoded = await encodeAt(scale)
    }
    return encoded
}

// JPEG has no transparency, so a transparent pixel would otherwise turn black.
async function encodeJpeg(bitmap: ImageBitmap, scale: number): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
        throw new Error('Canvas 2D is unavailable')
    }
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the screenshot'))),
            'image/jpeg',
            JPEG_QUALITY
        )
    )
}

async function base64Of(jpeg: Blob): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () =>
            typeof reader.result === 'string'
                ? resolve(reader.result)
                : reject(new Error('Expected a data URL'))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(jpeg)
    })
    if (!dataUrl.startsWith(JPEG_DATA_URL_PREFIX)) {
        throw new Error('Expected a JPEG data URL')
    }
    return dataUrl.slice(JPEG_DATA_URL_PREFIX.length)
}
