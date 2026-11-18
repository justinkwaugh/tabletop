// @vitest-environment node
import { existsSync } from 'node:fs'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { GuildIds } from '@tabletop/feudum'
import { GuildBox } from '$lib/utils/boardGeometry.js'
import { PrintedFaceRadius, PrintedFaces } from '$lib/utils/printedGuilds.js'
import GuildFaces from './GuildFaces.svelte'

const suppliedHere = existsSync(
    new URL('../../art/supplied/board.guild.merchant.webp', import.meta.url)
)

/** Each face drawn, in order: its guild, its view box and its print's turn. */
function facesIn(markup: string) {
    const attribute = (tag: string, name: string) =>
        tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
    return [...markup.matchAll(/<svg([^>]*)>(.*?)<\/svg>/gs)].map(([, svg, inside]) => {
        const image = inside.match(/<image([^>]*)>/)?.[1] ?? ''
        return {
            guild: attribute(svg, 'data-guild-face'),
            viewBox: attribute(svg, 'viewBox'),
            href: attribute(image, 'href'),
            turn: attribute(image, 'transform')?.match(/^rotate\(([^)]+)\)$/)?.[1]
        }
    })
}

describe('Contract, Desk layout: a guild button shows the faces off its side’s prints', () => {
    it('each face is cut whole from its print', () => {
        for (const guild of GuildIds) {
            const { x, y } = PrintedFaces[guild]
            expect(x - PrintedFaceRadius).toBeGreaterThanOrEqual(0)
            expect(y - PrintedFaceRadius).toBeGreaterThanOrEqual(0)
            expect(x + PrintedFaceRadius).toBeLessThanOrEqual(GuildBox.width)
            expect(y + PrintedFaceRadius).toBeLessThanOrEqual(GuildBox.height)
        }
    })

    describe.skipIf(!suppliedHere)('with the guild prints', () => {
        it('West: the Alchemist, Merchant and Farmer top to bottom, each print turned a quarter clockwise about its face', () => {
            const faces = facesIn(render(GuildFaces, { props: { side: 'west' } }).body)
            expect(faces.map(({ guild }) => guild)).toEqual(['alchemist', 'merchant', 'farmer'])
            for (const { guild, viewBox, href, turn } of faces) {
                const { x, y } = PrintedFaces[guild as keyof typeof PrintedFaces]
                const r = PrintedFaceRadius
                expect(viewBox).toBe(`${x - r} ${y - r} ${2 * r} ${2 * r}`)
                expect(href).toContain(`board.guild.${guild}`)
                expect(turn).toBe(`90 ${x} ${y}`)
            }
        })

        it('East: the Knight, Noble and Monk top to bottom, each turned a quarter counter-clockwise', () => {
            const faces = facesIn(render(GuildFaces, { props: { side: 'east' } }).body)
            expect(faces.map(({ guild }) => guild)).toEqual(['knight', 'noble', 'monk'])
            for (const { guild, href, turn } of faces) {
                const { x, y } = PrintedFaces[guild as keyof typeof PrintedFaces]
                expect(href).toContain(`board.guild.${guild}`)
                expect(turn).toBe(`-90 ${x} ${y}`)
            }
        })

        it('the faces are decoration: hidden from assistive technology, with no name of their own', () => {
            const markup = render(GuildFaces, { props: { side: 'west' } }).body
            expect(markup).toMatch(
                /^(?:<!--[^>]*-->)*<span[^>]*\saria-hidden="true"[^>]*\sdata-guild-faces="west"/
            )
            expect(markup).not.toMatch(/aria-label|<title|role="img"/)
            expect(markup.match(/<image/g)).toHaveLength(3)
        })
    })
})
