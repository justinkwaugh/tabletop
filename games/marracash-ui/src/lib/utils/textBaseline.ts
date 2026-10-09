// Board text sits on its alphabetic baseline, lowered by the shift `dominant-baseline: central`
// would apply, half of the font's ascent less its descent. iOS Safari works that shift out at the
// zoomed font size but applies it unzoomed, so with the board drawn at its view scale centred
// letters rode up their signs when zoomed out and sank when zoomed in.
export const ElMessiriCentralShift = 0.2375
// Chromium and WebKit read Baskerville's metrics from different tables, 0.3375 and 0.3515.
export const BaskervilleCentralShift = 0.3445

// The baseline that centres a line of text on `y`, as `dominant-baseline: central` would.
export function centredBaseline(y: number, fontSize: number, centralShift: number): number {
    return y + fontSize * centralShift
}
