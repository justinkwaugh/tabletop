/** One lasting listener: WebKit restyles the page whenever a wheel listener comes or goes. */
export function keepWheelIn(selector: string): (event: WheelEvent) => void {
    return (event) => {
        if (event.target instanceof Element && event.target.closest(selector)) {
            event.stopPropagation()
        }
    }
}
