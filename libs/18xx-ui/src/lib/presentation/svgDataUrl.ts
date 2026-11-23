/** An image URL for SVG markup, for art drawn from code rather than shipped as a file. */
export function svgDataUrl(svg: string): string {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Text set inside SVG markup, with the characters XML reserves escaped, as B&O's ampersand. */
export function svgText(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
