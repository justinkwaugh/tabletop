// A consumed polyp shows with a parrotfish bite out of its top-right corner: a scoop edged with
// tooth marks, so it reads as bitten rather than as a corner that failed to draw. Sized for the
// 20- to 22-pixel chips; the mask layers intersect, each cutting one circle away.
export const BiteMask = [
    'radial-gradient(circle at 100% 0, transparent 5.5px, black 6px)',
    'radial-gradient(circle at calc(100% - 6.5px) 1px, transparent 2.8px, black 3.2px)',
    'radial-gradient(circle at calc(100% - 4.6px) 4.6px, transparent 2.8px, black 3.2px)',
    'radial-gradient(circle at calc(100% - 1px) 6.5px, transparent 2.8px, black 3.2px)'
].join(', ')
