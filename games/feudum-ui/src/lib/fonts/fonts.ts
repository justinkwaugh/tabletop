/** A font file beside this module, by path. Each ships with its OFL text beside it. */
const files: Record<string, string> = import.meta.glob<string>(['./*.woff2', './*.ttf'], {
    eager: true,
    import: 'default'
})

const Fonts: Record<string, { family: string; format: string }> = {
    './MedievalSharp.ttf': { family: 'MedievalSharp', format: 'truetype' },
    './IMFellEnglish-Latin.woff2': { family: 'IM Fell English', format: 'woff2' }
}

/** The families the table sets, for `CustomFont`. The title stack falls back to the text family. */
export const FontFaces = Object.entries(files).flatMap(([path, url]) => {
    const font = Fonts[path]
    return font ? [{ ...font, url }] : []
})
