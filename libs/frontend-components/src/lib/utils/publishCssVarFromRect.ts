type RectDimension = 'height' | 'width'

export function attachGlobalCssVarFromRect(
    cssVarName: string,
    options: { dimension?: RectDimension } = {}
): (node: HTMLElement) => () => void {
    return (node: HTMLElement) => {
        if (typeof document === 'undefined' || typeof ResizeObserver === 'undefined') {
            return () => {}
        }

        const { dimension = 'height' } = options
        const rootStyle = document.documentElement.style

        const updateCssVar = () => {
            const rect = node.getBoundingClientRect()
            const value = dimension === 'width' ? rect.width : rect.height
            rootStyle.setProperty(cssVarName, `${value}px`)
        }

        const observer = new ResizeObserver(updateCssVar)
        observer.observe(node)
        updateCssVar()

        return () => {
            observer.disconnect()
            rootStyle.removeProperty(cssVarName)
        }
    }
}
