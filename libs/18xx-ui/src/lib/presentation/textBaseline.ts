// Where `dominant-baseline: central` puts the fonts 18xx titles use (0.305-0.355em). iOS misplaces
// central under CSS zoom and WebKit ignores it on a group, so board text sits on its alphabetic
// baseline lowered by this share of its font size.
const CentredTextShiftEm = 0.35

/**
 * The dy, in user units, that centres text of this font size on its y. Not an em length: Safari
 * 27.0 divides SVG em lengths by the CSS zoom of the outer svg, which moves text as the board zooms.
 */
export function centredTextShift(fontSize: number): number {
    return fontSize * CentredTextShiftEm
}
