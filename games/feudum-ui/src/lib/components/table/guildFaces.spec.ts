// @vitest-environment node
import { existsSync } from 'node:fs'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { GuildIds } from '@tabletop/feudum'
import { GuildBox, uprightTurn } from '$lib/utils/boardGeometry.js'
import { PrintedFaceRadius, PrintedFaces, printedFaceTurn } from '$lib/utils/printedGuilds.js'
import GuildFaces from './GuildFaces.svelte'

const facesHere = existsSync(new URL('../../art/supplied/face.merchant.webp', import.meta.url))

/** Each face drawn, in order: its guild, its file, its alt text and its size. */
function facesIn(markup: string) {
    const attribute = (tag: string, name: string) =>
        tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
    return [...markup.matchAll(/<img([^>]*)>/g)].map(([, img]) => ({
        guild: attribute(img, 'data-guild-face'),
        src: attribute(img, 'src'),
        alt: attribute(img, 'alt'),
        width: attribute(img, 'width'),
        height: attribute(img, 'height')
    }))
}

describe('Contract, Desk layout: a guild button shows its side’s faces, each a small file cut from its print', () => {
    it('each face is cut whole from its print', () => {
        for (const guild of GuildIds) {
            const { x, y } = PrintedFaces[guild]
            expect(x - PrintedFaceRadius).toBeGreaterThanOrEqual(0)
            expect(y - PrintedFaceRadius).toBeGreaterThanOrEqual(0)
            expect(x + PrintedFaceRadius).toBeLessThanOrEqual(GuildBox.width)
            expect(y + PrintedFaceRadius).toBeLessThanOrEqual(GuildBox.height)
        }
    })

    it('each face is cut upright, turned as the open side turns its print', () => {
        for (const guild of GuildIds) {
            expect(printedFaceTurn(guild)).toBe(uprightTurn(guild))
        }
    })

    describe.skipIf(!facesHere)('with the face files', () => {
        it('West: the Alchemist, Merchant and Farmer top to bottom; East: the Knight, Noble and Monk, each its own 36 px face file', () => {
            for (const [side, order] of [
                ['west', ['alchemist', 'merchant', 'farmer']],
                ['east', ['knight', 'noble', 'monk']]
            ] as const) {
                const faces = facesIn(render(GuildFaces, { props: { side } }).body)
                expect(faces.map(({ guild }) => guild)).toEqual(order)
                for (const { guild, src, width, height } of faces) {
                    expect(src).toMatch(new RegExp(`face\\.${guild}\\.webp`))
                    expect([width, height]).toEqual(['36', '36'])
                }
            }
        })

        it('no face draws its whole print, so the prints stay unloaded at rest', () => {
            for (const side of ['west', 'east'] as const) {
                const markup = render(GuildFaces, { props: { side } }).body
                expect(markup).not.toContain('board.guild')
                expect(markup).not.toContain('<image')
            }
        })

        it('the faces are decoration: empty alt text inside a group hidden from assistive technology', () => {
            const markup = render(GuildFaces, { props: { side: 'west' } }).body
            expect(markup).toMatch(
                /^(?:<!--[^>]*-->)*<span[^>]*\saria-hidden="true"[^>]*\sdata-guild-faces="west"/
            )
            expect(markup).not.toMatch(/aria-label|<title|role="img"/)
            expect(facesIn(markup).map(({ alt }) => alt)).toEqual(['', '', ''])
        })
    })
})
