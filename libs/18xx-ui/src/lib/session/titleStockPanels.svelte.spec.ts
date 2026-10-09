import { describe, expect, it } from 'vitest'
import { TitleStockPanels } from './titleStockPanels.svelte.js'

function panels(options: { company: boolean; short: boolean; acting?: boolean }) {
    const stock = {
        openMenu: undefined as 'buy' | 'sell' | undefined,
        chooseMenu(menu: 'buy' | 'sell' | undefined) {
            stock.openMenu = menu
        }
    }
    const model = new TitleStockPanels<'company' | 'short'>(stock, [
        {
            id: 'company',
            label: 'Act for a company',
            available: () => options.company,
            held: () => !!options.acting
        },
        { id: 'short', label: 'Short', available: () => options.short }
    ])
    return { stock, model }
}

describe('title stock panels', () => {
    it('opens a chosen available panel, closing the stock menu', () => {
        const { stock, model } = panels({ company: true, short: true })
        stock.openMenu = 'buy'
        model.choose('short')
        expect(stock.openMenu).toBeUndefined()
        expect(model.open).toBe('short')
        expect(model.count).toBe(2)
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
        expect(model.count).toBe(0)
    })

    it('lists the available panels as stock menu entries', () => {
        const { model } = panels({ company: true, short: false })
        expect(model.menuOptions.map((option) => [option.label, option.selected])).toEqual([
            ['Act for a company', false]
        ])
        model.menuOptions[0].onSelect()
        expect(model.open).toBe('company')
        model.clear()
        expect(model.open).toBeUndefined()
        expect(model.hasManual()).toBe(false)
    })
})
