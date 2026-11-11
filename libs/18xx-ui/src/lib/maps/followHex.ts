import type { Point } from '@tabletop/common'

/** Where a map hex sits within the overlay drawn over the map. */
export interface HexPlacement {
    readonly center: Point
    readonly width: number
    readonly height: number
    readonly hexHeight: number
    /** Screen pixels per map unit, when the map is drawn. */
    readonly mapScale?: number
}

/**
 * A Svelte action, used on an anchor inside the overlay, that measures where its location's hex
 * sits in the viewport and measures again whenever the viewport resizes or the map moves.
 */
export function followHex(
    viewport: () => HTMLElement,
    measured: (placement: HexPlacement) => void,
    scheduled?: () => void
) {
    return (_anchor: HTMLElement, initialLocationId: string | undefined) => {
        let followedId = initialLocationId
        let frame: number | undefined
        function measure() {
            frame = undefined
            const view = viewport()
            const hex = [...view.querySelectorAll('[data-map-location]')].find(
                (element) => element.getAttribute('data-map-location') === followedId
            )
            if (!hex) return
            const bounds = view.getBoundingClientRect()
            const rect = hex.getBoundingClientRect()
            const svg = view.querySelector('svg.map-scene')
            measured({
                center: {
                    x: rect.x + rect.width / 2 - bounds.x,
                    y: rect.y + rect.height / 2 - bounds.y
                },
                width: bounds.width,
                height: bounds.height,
                hexHeight: rect.height,
                // WebKit's getScreenCTM omits the CSS scale on the map wrapper.
                mapScale:
                    svg instanceof SVGSVGElement
                        ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width
                        : undefined
            })
        }
        function scheduleMeasure() {
            if (frame === undefined) frame = requestAnimationFrame(measure)
            scheduled?.()
        }
        const resized = new ResizeObserver(scheduleMeasure)
        resized.observe(viewport())
        const viewMoved = new MutationObserver(scheduleMeasure)
        viewMoved.observe(viewport(), {
            subtree: true,
            attributes: true,
            attributeFilter: ['style']
        })
        measure()
        return {
            update(locationId: string | undefined) {
                followedId = locationId
                measure()
            },
            destroy() {
                resized.disconnect()
                viewMoved.disconnect()
                if (frame !== undefined) cancelAnimationFrame(frame)
            }
        }
    }
}
