// Writes the cover's artwork, cover.svg, from the logic package's map: Great Britain as the
// board draws it, under the title. Render it at 513 by 657 and save it as src/lib/images/cover.webp.
import { writeFileSync } from 'node:fs'
import { Map1822 } from '@tabletop/1822'
import { calculateHexGeometry, HexOrientation } from '@tabletop/common'

const Width = 1026
const Height = 1314
const Scale = 0.48
const cells = Map1822.definition.locations.map((location) => ({
    location,
    center: calculateHexGeometry(
        { orientation: HexOrientation.Flat, dimensions: { radius: 50 } },
        location.coordinates
    ).center
}))
const xs = cells.map((cell) => cell.center.x)
const top = Math.min(...cells.map((cell) => cell.center.y))
const left = Width / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * Scale + 150
const x = (cell) => left + cell.center.x * Scale
const y = (cell) => 384 + (cell.center.y - top) * Scale
const hexagon = (cell) =>
    Array.from({ length: 6 }, (_, corner) => {
        const angle = (corner * Math.PI) / 3
        return `${(x(cell) + 50 * Scale * Math.cos(angle)).toFixed(1)},${(y(cell) + 50 * Scale * Math.sin(angle)).toFixed(1)}`
    }).join(' ')
const hasCity = ({ location }) =>
    location.preprintedTile?.nodes?.some((node) => node.kind === 'city')
const Fills = { gray: '#8f8a80', yellow: '#e3c75a', blue: '#7fa3b5' }
const fill = (cell) =>
    Fills[cell.location.preprintedTile?.color] ?? (hasCity(cell) ? '#e9dfc6' : '#dfe3c4')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Width / 2}" height="${Height / 2}" viewBox="0 0 ${Width} ${Height}">
<rect width="${Width}" height="${Height}" fill="#2f4858"/>
${cells.map((cell) => `<polygon points="${hexagon(cell)}" fill="${fill(cell)}" stroke="#40382e" stroke-width="1.6"/>`).join('')}
${cells
    .filter(hasCity)
    .map(
        (cell) =>
            `<circle cx="${x(cell).toFixed(1)}" cy="${y(cell).toFixed(1)}" r="6" fill="#fbf6ea" stroke="#40382e" stroke-width="2.2"/>`
    )
    .join('')}
<text x="70" y="208" font-family="Liberation Serif, Georgia, serif" font-weight="700" font-size="210" letter-spacing="6" fill="#f3ead6">1822</text>
<rect x="74" y="238" width="430" height="5" fill="#c9a24a"/>
<text x="74" y="290" font-family="Liberation Serif, Georgia, serif" font-size="43" letter-spacing="3" fill="#f3ead6">THE RAILWAYS OF</text>
<text x="74" y="342" font-family="Liberation Serif, Georgia, serif" font-size="43" letter-spacing="3" fill="#f3ead6">GREAT BRITAIN</text>
</svg>`
writeFileSync(new URL('../cover.svg', import.meta.url), svg)
