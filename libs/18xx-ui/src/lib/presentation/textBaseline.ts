// Where `dominant-baseline: central` puts the fonts 18xx titles use (0.305-0.355em). iOS misplaces
// central under CSS zoom and WebKit ignores it on a group, so board text uses this dy instead.
export const CentredTextShift = '0.35em'
