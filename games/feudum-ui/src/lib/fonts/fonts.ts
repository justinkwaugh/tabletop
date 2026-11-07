/** A font file beside this module, by path. Each ships with its OFL text beside it. */
const files: Record<string, string> = import.meta.glob<string>('./*.woff2', {
    eager: true,
    import: 'default'
})

const Families: Record<string, string> = {
    'MedievalSharp-Latin': 'MedievalSharp',
    'IMFellEnglish-Latin': 'IM Fell English'
}

/** The families the table sets, for `CustomFont`. The title stack falls back to the text family. */
export const FontFaces = Object.entries(files).flatMap(([path, url]) => {
    const family = Families[path.replace('./', '').replace('.woff2', '')]
    return family ? [{ family, url }] : []
})
