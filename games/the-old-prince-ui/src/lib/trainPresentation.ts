export const TheOldPrinceTrainColors: Readonly<Record<string, string>> = {
    '2H': '#ffe599',
    '3H': '#f1c232',
    '4H': '#b6d7a8',
    '5H': '#6aa84f',
    '6H': '#38761d',
    '2+': '#3c78d8',
    '3+': '#40bcc6',
    '4+': '#994735',
    '7': '#e06666',
    D: '#cccccc'
}

/**
 * Badge colours from the published player aid: the trains cycle purple, crimson and teal, and
 * the diesel is a two-tone marble of the purple and crimson.
 */
export const TheOldPrincePublishedTrainColors: Readonly<Record<string, string>> = {
    '2H': '#473759',
    '3H': '#912c4b',
    '4H': '#2d4b4c',
    '5H': '#463657',
    '6H': '#912b4b',
    '2+': '#2e4c4c',
    '3+': '#463657',
    '4+': '#912c4c',
    '7': '#2e4c4d',
    D: 'linear-gradient(120deg, #463657 0 42%, #912c4b 58% 100%)'
}

/** Phase colours need a solid value where they are mixed into backgrounds, so the diesel takes the midpoint of its two tones. */
export const TheOldPrincePublishedPhaseColors: Readonly<Record<string, string>> = {
    ...TheOldPrincePublishedTrainColors,
    D: '#6c3151'
}
