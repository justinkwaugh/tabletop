import { describe, expect, it } from 'vitest'
import { TitleStockPanels } from './titleStockPanels.svelte.js'

function panels(options: { company: boolean; short: boolean; acting?: boolean }) {
    const picks = { company: 1, short: 1 }
    const stock = {
        openMenu: undefined as 'buy' | 'sell' | undefined,
        chooseMenu(menu: 'buy' | 'sell' | undefined) {
            stock.openMenu = menu
        }
    }
    const model = new TitleStockPanels<'company' | 'short'>(stock, [
        {
            id: 'company',
            label: 'Company action',
            available: () => options.company,
            held: () => !!options.acting,
            selection: { clear: () => (picks.company = 0) }
        },
        {
            id: 'short',
            label: 'Short',
            available: () => options.short,
            selection: { clear: () => (picks.short = 0) }
        }
    ])
    return { stock, model, picks }
}

describe('title stock panels', () => {
    it('opens a chosen available panel, closing the stock menu', () => {
        const { stock, model } = panels({ company: true, short: true })
        stock.openMenu = 'buy'
        model.choose('short')
        expect(stock.openMenu).toBeUndefined()
        expect(model.open).toBe('short')
    })

    it('keeps a held panel open and lets Undo clear a choice', () => {
        const { model } = panels({ company: true, short: true, acting: true })
        model.choose('short')
        expect(model.open).toBe('company')
        expect(model.hasManual()).toBe(true)
        expect(model.undo()).toBe(true)
        expect(model.undo()).toBe(false)
    })

    it('opens nothing that has nothing to offer', () => {
        const { model } = panels({ company: false, short: false })
        model.choose('company')
        expect(model.open).toBeUndefined()
    })

    it('drops what was picked in a panel the player leaves', () => {
        const { model, picks } = panels({ company: true, short: true })
        model.choose('company')
        Object.assign(picks, { company: 1, short: 1 })
        model.choose('short')
        expect(picks).toEqual({ company: 0, short: 1 })
    })

    it('keeps what was picked when the open panel is chosen again', () => {
        const { model, picks } = panels({ company: true, short: true })
        model.choose('short')
        picks.short = 1
        model.choose('short')
        expect(picks.short).toBe(1)
    })

    it('keeps what was picked in a held panel, which stays open', () => {
        const { model, picks } = panels({ company: true, short: true, acting: true })
        model.choose('short')
        model.clear()
        expect(picks).toEqual({ company: 1, short: 0 })
    })

    it('drops what was picked when the panel is closed', () => {
        const { model, picks } = panels({ company: true, short: true })
        model.choose('short')
        picks.short = 1
        model.clear()
        expect(picks.short).toBe(0)
        picks.short = 1
        model.choose('short')
        model.undo()
        expect(picks.short).toBe(0)
    })

    it('lists the available panels as stock menu entries', () => {
        const { model } = panels({ company: true, short: false })
        expect(model.menuOptions.map((option) => [option.label, option.selected])).toEqual([
            ['Company action', false]
        ])
        model.menuOptions[0].onSelect()
        expect(model.open).toBe('company')
        model.clear()
        expect(model.open).toBeUndefined()
        expect(model.hasManual()).toBe(false)
    })
})
