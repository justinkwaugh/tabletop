import type { Point } from '@tabletop/common'
import { usaCity, type CityId } from '@tabletop/ride-the-rails'
import { stationOf } from './boardGeometry.js'
import type { CityBonusMark } from './boardPieces.js'

/**
 * A city's marks are drawn around its station in units laid out for a station of this radius,
 * and scaled to each city's (Chicago's is smaller).
 */
export const DRAWN_STATION_RADIUS = 12

export function cityMarkScale(cityId: CityId): number {
    return stationOf(cityId).radius / DRAWN_STATION_RADIUS
}

function hasNoLimit(cityId: CityId): boolean {
    return usaCity(cityId).capacity === 'unlimited'
}

// An ordinary station has its cubes below it, so its coin sits up and left and its passenger
// right; Chicago's rows of cubes run above and below it, so both sit beside it.
const COIN_OFFSET: Point = { x: -21.2, y: -14 }
const PASSENGER_OFFSET: Point = { x: 26.2, y: 1.2 }
const CHICAGO_COIN_OFFSET: Point = { x: -24, y: 0 }
const CHICAGO_PASSENGER_OFFSET: Point = { x: 24, y: 0 }

/** Where a city's bonus coin sits from its station, in drawn units. */
export function coinOffset(cityId: CityId): Point {
    return hasNoLimit(cityId) ? CHICAGO_COIN_OFFSET : COIN_OFFSET
}

/** Where a city's passenger stands from its station, in drawn units. */
export function passengerOffset(cityId: CityId): Point {
    return hasNoLimit(cityId) ? CHICAGO_PASSENGER_OFFSET : PASSENGER_OFFSET
}

// A coin large enough to read at the phone's zoom, where a hex is about 33 px wide.
export const COIN_RADIUS = 14.8
export const COIN_FONT_SIZE = 16.8

export type BonusCoin = {
    text: string
    fill: string
    rim: string
    ink: string
    /** A $5 a railroad has had: greyed and struck through. */
    used: boolean
}

/** R-4.3.1, R-4.3.2: Chicago's gold $2 pays every placement; a green $5 only the first. */
export function bonusCoin(bonus: CityBonusMark): BonusCoin {
    const text = `$${bonus.amount}`
    if (bonus.kind === 'chicago') {
        return {
            text,
            fill: 'var(--rtr-coin)',
            rim: 'var(--rtr-coin-rim)',
            ink: 'var(--rtr-coin-ink)',
            used: false
        }
    }
    return bonus.taken
        ? {
              text,
              fill: 'var(--rtr-coin-used)',
              rim: 'var(--rtr-coin-used-rim)',
              ink: 'var(--rtr-coin-used-ink)',
              used: true
          }
        : {
              text,
              fill: 'var(--rtr-five)',
              rim: 'var(--rtr-five-rim)',
              ink: 'var(--rtr-five-ink)',
              used: false
          }
}

/** The start ring's radius round the station, in drawn units, and its three strokes. */
export const START_RING_RADIUS = 17.4
export const START_RING_STROKES = { outline: 10.8, ground: 8.4, colour: 6.8 } as const

const RING_GAP = 0.3

function round(value: number): number {
    return Math.round(value * 10) / 10
}

function ringPoint(angle: number): string {
    return `${round(START_RING_RADIUS * Math.cos(angle))} ${round(START_RING_RADIUS * Math.sin(angle))}`
}

/**
 * One arc per start colour round the station, clockwise from the top, with a gap between each;
 * two colours split into a top and a bottom half. A single colour is a whole circle, so no arcs.
 */
export function startRingArcs(count: number): string[] {
    if (count < 2) return []
    const span = (2 * Math.PI) / count
    const turn = count === 2 ? -Math.PI / 2 + span / 2 : 0
    return Array.from({ length: count }, (_, index) => {
        const from = -Math.PI / 2 - span / 2 + index * span + RING_GAP / 2 + turn
        const to = from + span - RING_GAP
        const large = span - RING_GAP > Math.PI ? 1 : 0
        return `M${ringPoint(from)} A${START_RING_RADIUS} ${START_RING_RADIUS} 0 ${large} 1 ${ringPoint(to)}`
    })
}
