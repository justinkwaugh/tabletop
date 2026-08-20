<script lang="ts">
    // Declares one @font-face for a game's own font, with font-display: swap so text is painted
    // in the fallback rather than held invisible while the font arrives.
    //
    // One instance declares one FACE, not one family. A family with several faces - a regular and
    // an italic, a regular and a bold - needs one instance each, distinguished by fontWeight and
    // fontStyle. Without those two descriptors every face of a family would land on the same
    // family name with identical descriptors, so the last rule would win and the browser would
    // SYNTHESISE the italic or the bold from whichever face survived: the real ones downloaded and
    // then not used. Both default to normal, so a single-face family passes neither.
    let {
        fontFamily,
        url,
        format,
        fontWeight = 'normal',
        fontStyle = 'normal'
    }: {
        fontFamily: string
        url: string
        format: string
        // Anything the CSS descriptor takes: normal, bold, 100-900, or a variable font's range
        // ('100 900').
        fontWeight?: string | number
        // normal, italic, or oblique - including an angle, e.g. 'oblique 14deg'.
        fontStyle?: string
    } = $props()

    // Assembled from a tag name rather than written out, and that is not fussiness. Svelte's
    // preprocessor treats ANY <style> in this file as CSS to compile - including one that exists
    // only inside a string - and hands its contents to postcss. This worked before by luck: every
    // interpolation sat inside quotes or url(), which postcss tolerates. A bare ${...} in a
    // declaration value, which is exactly what font-weight and font-style need, it rejects with
    // "Unknown word". With no literal <style> in the source there is no block for it to find.
    const TAG = 'style'

    // Named for what it is rather than fontStyle, which is now a prop: the collision would have
    // silently shadowed one of them.
    let fontFaceTag = $derived(
        `<${TAG}>@font-face { font-family: '${fontFamily}'; src: url(${url}) format('${format}'); font-weight: ${fontWeight}; font-style: ${fontStyle}; font-display: swap; }</${TAG}>`
    )
</script>

<svelte:head>
    {@html fontFaceTag}
</svelte:head>
