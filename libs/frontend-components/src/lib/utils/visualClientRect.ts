let rectsLeaveOutZoom: boolean | undefined

/**
 * Whether this browser reports the rect of an element inside CSS `zoom` divided by that zoom,
 * as Safari 26.0 and older do; Chromium, Firefox and later WebKit report it as drawn.
 */
function leavesOutZoom(): boolean {
    if (rectsLeaveOutZoom !== undefined) return rectsLeaveOutZoom
    const zoomed = document.createElement('div')
    zoomed.style.cssText =
        'position: absolute; left: 0; top: 0; visibility: hidden; pointer-events: none; zoom: 0.5'
    const probe = document.createElement('div')
    probe.style.cssText = 'width: 100px; height: 1px'
    zoomed.append(probe)
    document.body.append(zoomed)
    rectsLeaveOutZoom = Math.round(probe.getBoundingClientRect().width) === 100
    zoomed.remove()
    return rectsLeaveOutZoom
}

/**
 * The element's bounding rect in viewport pixels as drawn, including any CSS `zoom` above it,
 * such as a ScalingWrapper's `renderAtViewScale`. Use it in place of `getBoundingClientRect` to
 * measure anything inside zoomed content.
 */
export function visualClientRect(element: Element): DOMRect {
    const rect = element.getBoundingClientRect()
    if (!leavesOutZoom()) return rect
    let zoom = 1
    for (let node: Element | null = element; node; node = node.parentElement)
        zoom *= Number.parseFloat(getComputedStyle(node).zoom) || 1
    if (zoom === 1) return rect
    return new DOMRect(rect.x * zoom, rect.y * zoom, rect.width * zoom, rect.height * zoom)
}
