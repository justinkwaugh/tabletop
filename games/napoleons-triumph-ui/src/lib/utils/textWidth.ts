/** Glyphs by their advance, in one font at one size, as the browser reports them. */
export interface GlyphAdvances {
    listed: Record<number, string>
    unlisted: number
}

// Workaround: no text can be measured where layout needs its width, so it is summed from advances.
export function textWidth(text: string, advances: GlyphAdvances): number {
    const listed = Object.entries(advances.listed)
    return [...text].reduce((width, glyph) => {
        const advance = listed.find(([, glyphs]) => glyphs.includes(glyph))
        return width + (advance ? Number(advance[0]) : advances.unlisted)
    }, 0)
}
