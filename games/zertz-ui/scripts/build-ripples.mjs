// Prints the ripple texture's data URI for .zertz-ripples in ../src/app.css: broad swells spreading
// from the centre, fading out before the edge. Run: node scripts/build-ripples.mjs
const SIZE = 2400
const CENTER = SIZE / 2
const REACH = 1100

const rings = []
let radius = 70
let spacing = 80
while (radius < REACH) {
    const fade = (1 - radius / REACH) ** 1.3
    const band = spacing * 0.32
    rings.push(
        `<circle cx='${CENTER}' cy='${CENTER}' r='${radius.toFixed(1)}' stroke='%23ffffff' stroke-opacity='${(0.06 * fade).toFixed(3)}' stroke-width='${band.toFixed(1)}'/>`,
        `<circle cx='${CENTER}' cy='${CENTER}' r='${(radius + spacing * 0.5).toFixed(1)}' stroke='%23021624' stroke-opacity='${(0.07 * fade).toFixed(3)}' stroke-width='${band.toFixed(1)}'/>`
    )
    radius += spacing
    spacing *= 1.1
}

const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${SIZE}' height='${SIZE}' viewBox='0 0 ${SIZE} ${SIZE}'>` +
    `<filter id='w' x='-10%' y='-10%' width='120%' height='120%'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.006' numOctaves='2' seed='3'/>` +
    `<feDisplacementMap in='SourceGraphic' scale='30'/>` +
    `<feGaussianBlur stdDeviation='11'/>` +
    `</filter>` +
    `<g fill='none' filter='url(%23w)'>${rings.join('')}</g>` +
    `</svg>`

console.log(svg.replaceAll('<', '%3C').replaceAll('>', '%3E'))
