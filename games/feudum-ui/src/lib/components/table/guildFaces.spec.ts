// @vitest-environment node
import { existsSync } from 'node:fs'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { GuildIds } from '@tabletop/feudum'
import { GuildBox, uprightTurn } from '$lib/utils/boardGeometry.js'
import { PrintedFaceRadius, PrintedFaces, printedFaceTurn } from '$lib/utils/printedGuilds.js'
import GuildFaces from './GuildFaces.svelte'

const printsHere = existsSync(
    new URL('../../art/supplied/board.guild.merchant.webp', import.meta.url)
)

/** Each face drawn, in order: its guild and box, and the print under it with its place and turn. */
function facesIn(markup: string) {
    const attribute = (tag: string, name: string) =>
        tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
    return [...markup.matchAll(/<svg([^>]*)>\s*<image([^>]*)>/g)].map(([, svg, image]) => ({
        guild: attribute(svg, 'data-guild-face'),
        size: [attribute(svg, 'width'), attribute(svg, 'height')],
        viewBox: attribute(svg, 'viewBox'),
        href: attribute(image, 'href'),
        place: [attribute(image, 'x'), attribute(image, 'y')].map(Number),
        printSize: [attribute(image, 'width'), attribute(image, 'height')].map(Number),
        transform: attribute(image, 'transform')
    }))
}

describe('Contract, Desk layout: a guild button shows its side’s faces, each cropped from its guild’s print', () => {
    it('each face lies whole inside its print', () => {
        for (const guild of GuildIds) {
            const { x, y } = PrintedFaces[guild]
            expect(x - PrintedFaceRadius).toBeGreaterThanOrEqual(0)
            expect(y - PrintedFaceRadius).toBeGreaterThanOrEqual(0)
            expect(x + PrintedFaceRadius).toBeLessThanOrEqual(GuildBox.width)
            expect(y + PrintedFaceRadius).toBeLessThanOrEqual(GuildBox.height)
        }
    })

    it('each face is turned upright, as the open side turns its print', () => {
        for (const guild of GuildIds) {
            expect(printedFaceTurn(guild)).toBe(uprightTurn(guild))
        }
    })

    describe.skipIf(!printsHere)('with the prints', () => {
        it('West: the Alchemist, Merchant and Farmer top to bottom; East: the Knight, Noble and Monk, each a 36 px window on its own print, centred on its face and turned upright', () => {
            const R = PrintedFaceRadius
            for (const [side, order] of [
                ['west', ['alchemist', 'merchant', 'farmer']],
                ['east', ['knight', 'noble', 'monk']]
            ] as const) {
                const faces = facesIn(render(GuildFaces, { props: { side } }).body)
                expect(faces.map(({ guild }) => guild)).toEqual(order)
                for (const face of faces) {
                    const guild = order.find((name) => name === face.guild) ?? order[0]
                    const { x, y } = PrintedFaces[guild]
                    expect(face.size).toEqual(['36', '36'])
                    expect(face.viewBox).toBe(`${-R} ${-R} ${2 * R} ${2 * R}`)
                    expect(face.href).toMatch(new RegExp(`board\\.guild\\.${guild}\\.webp`))
                    expect(face.place).toEqual([-x, -y])
                    expect(face.printSize).toEqual([GuildBox.width, GuildBox.height])
                    expect(face.transform).toBe(`rotate(${printedFaceTurn(guild)})`)
                }
            }
        })

        it('no face has a file of its own: the faces draw the prints the guild areas draw', () => {
            for (const side of ['west', 'east'] as const) {
                const markup = render(GuildFaces, { props: { side } }).body
                expect(markup).not.toContain('<img')
                expect(markup).not.toMatch(/face\.[a-z]+\.webp/)
            }
        })

        it('the faces are decoration: a group hidden from assistive technology, with no label of its own', () => {
            const markup = render(GuildFaces, { props: { side: 'west' } }).body
            expect(markup).toMatch(
                /^(?:<!--[^>]*-->)*<span[^>]*\saria-hidden="true"[^>]*\sdata-guild-faces="west"/
            )
            expect(markup).not.toMatch(/aria-label|<title|role="img"/)
            expect(facesIn(markup)).toHaveLength(3)
        })
    })
})
