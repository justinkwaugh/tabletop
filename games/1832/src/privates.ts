import { PrivateCatalog } from '@tabletop/18xx'
import { EighteenThirtyTwoPhases } from './trains.js'

// The private companies of §16.2; the Southern Bank (P6) belongs to a deferred variant.
export const EighteenThirtyTwoPrivateCatalog = new PrivateCatalog(
    {
        closurePhaseId: '5',
        privates: [
            {
                id: 'P1',
                name: 'Carolina Stage Coach Company',
                faceValue: 20,
                revenue: 5,
                description: 'No special abilities. Closes at phase 5.'
            },
            {
                id: 'P2',
                name: 'Cotton Warehouse',
                faceValue: 40,
                revenue: 10,
                description:
                    'The owning company may place a $10 Cotton token in any non-coastal city as an extra token placement. It adds $10 to that city for the owning company only. Closes at phase 5; the token stays until phase 6.'
            },
            {
                id: 'P3',
                name: 'Atlantic Shipping Company',
                faceValue: 50,
                revenue: 10,
                description:
                    'The owning company may place a Port token on any coastal city (marked with an anchor) as an extra token placement. It adds $20 to that city for the owning company and $10 for others. Closes at phase 5; the token stays until phase 6.'
            },
            {
                id: 'P4',
                name: 'London Investment Company',
                faceValue: 70,
                revenue: 10,
                sale: 'never',
                description:
                    'As a stock purchase, its owner may take a free share of any company whose president’s certificate was bought this stock round. Closes after that company’s first dividend, or at phase 5. Cannot be sold to a company.'
            },
            {
                id: 'P5',
                name: 'West Virginia Coal Fields',
                faceValue: 80,
                revenue: 15,
                description:
                    'Gives its owning company a free WVCF token. Others may buy WVCF tokens for $80, half to the owning company. No company may use the coal fields until it is owned by a company or closed. Companies may buy it in phase 2 for up to face value. Closes at phase 5.'
            },
            {
                id: 'P7',
                name: 'Central Rail Road & Canal Company',
                faceValue: 200,
                revenue: 30,
                sale: 'never',
                description:
                    'Comes with the Central of Georgia president’s certificate; its buyer sets the CoG par. Closes when the CoG buys its first train, or at phase 5. Cannot be sold to a company.'
            }
        ]
    },
    EighteenThirtyTwoPhases
)
export const EighteenThirtyTwoPrivates = EighteenThirtyTwoPrivateCatalog.privates
