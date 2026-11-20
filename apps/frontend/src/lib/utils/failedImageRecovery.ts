const RETRY_DELAYS_MS = [1_000, 3_000, 10_000]

type PageImage = HTMLImageElement | SVGImageElement
type PageDocument = EventTarget & Pick<Document, 'hidden'>
type ImageRetryState = {
    source: string
    retriesMade: number
    retryTimer?: ReturnType<typeof setTimeout>
}

function isPageImage(target: EventTarget | null): target is PageImage {
    return target instanceof HTMLImageElement || target instanceof SVGImageElement
}

function sourceAttributeOf(image: PageImage): Attr | null {
    if (image instanceof HTMLImageElement) return image.getAttributeNode('src')
    return image.getAttributeNode('href') ?? image.getAttributeNode('xlink:href')
}

// Writing the same address back leaves a failed image broken in WebKit; removing it first refetches.
function reload(image: PageImage, sourceAttribute: Attr) {
    image.removeAttributeNode(sourceAttribute)
    image.setAttributeNode(sourceAttribute)
}

function isFetchedSource(source: string | undefined): source is string {
    return !!source && !/^(data|blob):/i.test(source)
}

// Containment: why images fail to load when a player returns to the site is not yet known, and a
// failed image otherwise stays broken until the page is refreshed.
export function recoverFailedImages(pageDocument: PageDocument, pageWindow: EventTarget) {
    const failedImages = new Map<PageImage, ImageRetryState>()

    function retry(image: PageImage, retryState: ImageRetryState) {
        retryState.retryTimer = undefined
        const sourceAttribute = sourceAttributeOf(image)
        if (!image.isConnected || sourceAttribute?.value !== retryState.source) {
            failedImages.delete(image)
            return
        }
        if (pageDocument.hidden) return
        retryState.retriesMade += 1
        reload(image, sourceAttribute)
    }

    function retryAllFailedImages() {
        if (pageDocument.hidden) return
        for (const [image, retryState] of failedImages) {
            clearTimeout(retryState.retryTimer)
            retryState.retriesMade = 0
            retry(image, retryState)
        }
    }

    function imageFailed(event: Event) {
        const image = event.target
        if (!isPageImage(image)) return
        const source = sourceAttributeOf(image)?.value
        if (!isFetchedSource(source)) return

        const existingState = failedImages.get(image)
        clearTimeout(existingState?.retryTimer)
        const retryState =
            existingState?.source === source ? existingState : { source, retriesMade: 0 }
        failedImages.set(image, retryState)

        const delay = RETRY_DELAYS_MS[retryState.retriesMade]
        if (delay !== undefined) {
            retryState.retryTimer = setTimeout(() => retry(image, retryState), delay)
        }
    }

    function imageLoaded(event: Event) {
        const image = event.target
        if (!isPageImage(image)) return
        clearTimeout(failedImages.get(image)?.retryTimer)
        failedImages.delete(image)
    }

    // Image load and error events do not bubble, so the document only sees them while capturing.
    pageDocument.addEventListener('error', imageFailed, true)
    pageDocument.addEventListener('load', imageLoaded, true)
    pageDocument.addEventListener('visibilitychange', retryAllFailedImages)
    pageWindow.addEventListener('online', retryAllFailedImages)
}
