/** An image URL for SVG markup, for art drawn from code rather than shipped as a file. */
export function svgDataUrl(svg: string): string {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
