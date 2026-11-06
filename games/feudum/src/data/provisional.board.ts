import type { ProvisionalEntry } from './provisional.js'

const SettledBy = 'a clear picture of the board'

/** R-1.2-H1 The routes of the community map aid. The three ferries are read (R-1.2.2). */
export const ProvisionalBoard = {
    roadRoutes: {
        componentId: 'route.road.*',
        value: 'the road routes',
        placeholder: [
            'route.road.forest-1--forest-2',
            'route.road.forest-2--forest-3',
            'route.road.forest-2--badlands-1',
            'route.road.forest-3--badlands-1',
            'route.road.forest-3--desert-4',
            'route.road.badlands-1--badlands-2',
            'route.road.badlands-2--badlands-4',
            'route.road.desert-3--desert-4',
            'route.road.desert-1--desert-3',
            'route.road.desert-2--desert-5',
            'route.road.island-1--island-2',
            'route.road.island-3--island-4',
            'route.road.mountain-1--mountain-2'
        ],
        settledBy: SettledBy,
        ruling: 'R-1.2-H1',
        dataBlockedIn: ['boardMap.spec.ts']
    },
    shipRoutes: {
        componentId: 'route.ship.*',
        value: 'the ship routes',
        placeholder: [
            'route.ship.sea-1--forest-1',
            'route.ship.sea-1--sea-2',
            'route.ship.sea-2--island-3',
            'route.ship.island-3--desert-2',
            'route.ship.desert-1--desert-2',
            'route.ship.desert-1--badlands-3',
            'route.ship.badlands-2--badlands-3',
            'route.ship.badlands-2--mountain-2'
        ],
        settledBy: SettledBy,
        ruling: 'R-1.2-H1',
        dataBlockedIn: ['boardMap.spec.ts']
    },
    submersibleRoutes: {
        componentId: 'route.submersible.*',
        value: 'the submersible routes',
        placeholder: [
            'route.submersible.sea-1--forest-1',
            'route.submersible.island-1--forest-1',
            'route.submersible.sea-1--sea-2',
            'route.submersible.sea-2--island-3',
            'route.submersible.sea-2--island-2',
            'route.submersible.sea-3--island-1',
            'route.submersible.sea-3--desert-1',
            'route.submersible.island-2--desert-1',
            'route.submersible.desert-1--desert-2',
            'route.submersible.island-3--desert-2'
        ],
        settledBy: SettledBy,
        ruling: 'R-1.2-H1',
        dataBlockedIn: ['boardMap.spec.ts']
    },
    flyingMachineRoutes: {
        componentId: 'route.flying-machine.*',
        value: 'the flying-machine routes',
        placeholder: [
            'route.flying-machine.island-2--desert-1',
            'route.flying-machine.island-2--island-4',
            'route.flying-machine.island-4--desert-2',
            'route.flying-machine.desert-2--desert-5',
            'route.flying-machine.desert-5--badlands-5',
            'route.flying-machine.badlands-5--mountain-2',
            'route.flying-machine.mountain-1--mountain-2',
            'route.flying-machine.badlands-2--mountain-1'
        ],
        settledBy: SettledBy,
        ruling: 'R-1.2-H1',
        dataBlockedIn: ['boardMap.spec.ts']
    }
} as const satisfies Record<string, ProvisionalEntry>
