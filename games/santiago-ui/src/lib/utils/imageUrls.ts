import bananas1Url from '$lib/images/bananas1.jpg'
import bananas2Url from '$lib/images/bananas2.jpg'
import chili1Url from '$lib/images/chili1.jpg'
import chili2Url from '$lib/images/chili2.jpg'
import coconut1Url from '$lib/images/coconut1.jpg'
import coconut2Url from '$lib/images/coconut2.jpg'
import desertUrl from '$lib/images/desert.jpg'
import grapes1Url from '$lib/images/grapes1.jpg'
import grapes2Url from '$lib/images/grapes2.jpg'
import palmtreeUrl from '$lib/images/palmtree.png'
import boardUrl from '$lib/images/santiago_board.jpg'
import watermelon1Url from '$lib/images/watermelon1.jpg'
import watermelon2Url from '$lib/images/watermelon2.jpg'

export { boardUrl, desertUrl, palmtreeUrl }

export const cropImageUrls: Record<string, readonly [string, string]> = {
    bananas: [bananas1Url, bananas2Url],
    chili: [chili1Url, chili2Url],
    coconut: [coconut1Url, coconut2Url],
    grapes: [grapes1Url, grapes2Url],
    watermelon: [watermelon1Url, watermelon2Url]
}
