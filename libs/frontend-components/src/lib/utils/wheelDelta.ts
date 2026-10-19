const wheelLinePixels = 16

export function wheelDeltaUnit(event: WheelEvent, pagePixels: number) {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return wheelLinePixels
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return pagePixels
    return 1
}
