import { RailroadId } from '@tabletop/south-african-railroads'
import type { BoardLayoutSpec } from '../boardLayout.js'
import { southAfricanArtwork } from './southAfricanArt.js'

// Coordinates follow the South African Railroads board.
export const VELD_LAYOUT: BoardLayoutSpec = {
    width: 1584,
    top: 128,
    bottom: 1124,
    legend: { x: 32, y: 330 },
    finalPayoff: { x: 32, y: 190 },
    logo: { x: 492, y: 1036 },
    title: 'Veld Railroads',
    credit: 'John Bohrer · Winsome Games · map redrawn by Stephan Suhar',
    rules: {
        notes: [
            ['Eight rounds: the final payoff takes the place of dividend 8.'],
            [
                'Each railroad’s treasury starts with a die roll, $1–6; the ZASM’s is doubled. Special dividends round up, and a railroad’s first link into Johannesburg pays one.'
            ],
            [
                'Links across a dashed border cannot be built until its dividend has been paid. An arrowed link is built only in the direction of its arrow.'
            ],
            [
                'Round 4, War: one link a build, for $7; no double links or connections, and the ZASM builds nothing. Develop up to three settlements, the first two free.'
            ],
            [
                'Round 5, Recovery: every dividend and special dividend pays income ÷ 10, rounded down.'
            ],
            [
                'The ZASM also opens when Johannesburg’s income reaches $6. Until its track meets another railroad’s it pays double to build; that first meeting pays it a special dividend, unless another railroad already reaches Johannesburg.'
            ]
        ]
    },
    closedBorders: [
        {
            opensAfterDividend: 1,
            points: [
                { x: 937, y: 916 },
                { x: 997.5, y: 916.5 },
                { x: 1046, y: 938.5 },
                { x: 1117, y: 946.5 },
                { x: 1133, y: 965 },
                { x: 1162.5, y: 992.5 },
                { x: 1214.5, y: 1013 },
                { x: 1228, y: 1001.5 }
            ],
            label: { x: 1227.5, y: 1014 }
        },
        {
            opensAfterDividend: 2,
            points: [
                { x: 425.5, y: 514.5 },
                { x: 471, y: 520.5 },
                { x: 568, y: 533.5 },
                { x: 622.5, y: 541 },
                { x: 644.5, y: 541.5 },
                { x: 655, y: 542.5 },
                { x: 668.5, y: 542 },
                { x: 697, y: 542 },
                { x: 765, y: 556 },
                { x: 796.5, y: 570.5 },
                { x: 825, y: 602 },
                { x: 834.5, y: 639 },
                { x: 845.5, y: 672.5 },
                { x: 856, y: 713 },
                { x: 866, y: 748 },
                { x: 892.5, y: 786.5 },
                { x: 924, y: 835 },
                { x: 940, y: 869 },
                { x: 937, y: 916 }
            ],
            label: { x: 498, y: 538, rotate: 6 }
        },
        {
            opensAfterDividend: 3,
            points: [
                { x: 425.5, y: 516 },
                { x: 434.5, y: 427.5 },
                { x: 437.5, y: 411.5 },
                { x: 448.5, y: 394 },
                { x: 460.5, y: 380 },
                { x: 478, y: 371 },
                { x: 504, y: 353.5 },
                { x: 535, y: 325 },
                { x: 661, y: 274 },
                { x: 734.5, y: 262.5 },
                { x: 774.5, y: 259 },
                { x: 810, y: 242 },
                { x: 821, y: 221.5 },
                { x: 822, y: 211 }
            ],
            label: { x: 918, y: 207 }
        }
    ],
    metroGrids: {
        johannesburg: { columns: 3, origin: { x: 878.5, y: 485.5 } },
        bloemfontein: { columns: 2, origin: { x: 285, y: 733 } }
    },
    baseNames: [
        { x: 27, y: 941, railroadId: RailroadId.CMRC },
        { x: 48.5, y: 586.5, railroadId: RailroadId.CTRD },
        { x: 205, y: 1089, railroadId: RailroadId.CSAR },
        { x: 812.5, y: 1106.5, railroadId: RailroadId.NRC },
        { x: 1359, y: 1031.5, railroadId: RailroadId.CdFM }
    ],
    // Names are pinned where the placer first put them, so spacing the map out does not shuffle them.
    printedLabels: {
        airlie: { x: 1241, y: 827.3 },
        'aliwal-north': { x: 114.8, y: 1043.5 },
        arlington: { x: 549.2, y: 791.8 },
        balfour: { x: 967, y: 704 },
        barberton: { x: 1279.3, y: 868 },
        belfast: { x: 1146.6, y: 699.4 },
        bethal: { x: 1035.4, y: 760.5 },
        bethlehem: { x: 717, y: 884.5 },
        boshoek: { x: 946, y: 342.5 },
        breyten: { x: 1214, y: 784.5 },
        bultfontein: { x: 349.7, y: 668 },
        coligny: { x: 693, y: 388 },
        dover: { x: 714.9, y: 683.7 },
        dreunberg: { x: 37.1, y: 971.5 },
        ermelo: { x: 1178.3, y: 898.8 },
        frankfort: { x: 866, y: 772.5 },
        'glencoe-junction': { x: 877.2, y: 1092 },
        graskop: { x: 1331.8, y: 679 },
        gravelotte: { x: 1417, y: 549 },
        harrismith: { x: 699, y: 964 },
        hlobane: { x: 1148.5, y: 1048.5 },
        kaapmuiden: { x: 1359, y: 867.5 },
        kimberley: { x: 219.5, y: 552 },
        klerksdorp: { x: 507.3, y: 508.7 },
        koffiefontein: { x: 44.7, y: 676.5 },
        komatipoort: { x: 1478.7, y: 889.4 },
        kroonstad: { x: 615.8, y: 705.5 },
        ladybrand: { x: 555.5, y: 967.5 },
        ladysmith: { x: 752.1, y: 1050 },
        lichtenburg: { x: 573.4, y: 306 },
        lothair: { x: 1244.6, y: 891.5 },
        'lourenco-marques': { x: 1330.4, y: 997 },
        machadodorp: { x: 1227.7, y: 666.5 },
        mafeking: { x: 581, y: 275.4 },
        magaliesburg: { x: 752.3, y: 404.5 },
        maquassi: { x: 411.5, y: 511.9 },
        'marble-hall': { x: 1271.5, y: 494.5 },
        marquard: { x: 441.2, y: 863 },
        maseru: { x: 389.9, y: 980 },
        modderpoort: { x: 367, y: 908.7 },
        naboomspruit: { x: 1201.4, y: 347 },
        nelspruit: { x: 1253.2, y: 807.2 },
        newcastle: { x: 873.1, y: 981.5 },
        'norvals-point': { x: 67.5, y: 750.6, rotate: 90 },
        nylstroom: { x: 1173, y: 405.9 },
        palmford: { x: 1093.9, y: 884.7, rotate: 90 },
        'petrus-steyn': { x: 634.4, y: 754.8 },
        petrusburg: { x: 252, y: 668.5 },
        pienaarsriver: { x: 996.9, y: 381.6 },
        'piet-retief': { x: 1177.5, y: 956 },
        pietersburg: { x: 1327.2, y: 377.2 },
        plaston: { x: 1403.4, y: 721 },
        potchefstroom: { x: 577.8, y: 450.2 },
        pretoria: { x: 1056, y: 477.1 },
        purdimoe: { x: 350.9, y: 371.2 },
        sanderton: { x: 1012, y: 808.5 },
        springfontein: { x: 178.9, y: 887.2 },
        steelport: { x: 1391.5, y: 590.5 },
        swartruggens: { x: 827.5, y: 311 },
        theunissen: { x: 354.1, y: 715.3 },
        tweeling: { x: 783, y: 830.5 },
        utrecht: { x: 1014.9, y: 959.5 },
        vaalwater: { x: 1178, y: 289 },
        vereeniging: { x: 749.2, y: 559.7 },
        vermaas: { x: 545.9, y: 329.5 },
        vierfontein: { x: 496, y: 562.3 },
        volksrust: { x: 924.6, y: 895 },
        vrede: { x: 921.5, y: 866.5 },
        vredefort: { x: 712, y: 580.5 },
        vryburg: { x: 425.9, y: 314 },
        vryheid: { x: 1016.9, y: 1076 },
        warden: { x: 811.7, y: 852 },
        warrenton: { x: 304.9, y: 490.2 },
        watervliet: { x: 276, y: 858.5 },
        welverdiend: { x: 671.4, y: 526.3 },
        winburg: { x: 411.3, y: 814 },
        witbank: { x: 1151.5, y: 636 },
        zebediela: { x: 1341, y: 456.5 },
        zoekmakaar: { x: 1470, y: 412 }
    },
    regions: [],
    // The South African Railroads art, each drawing moved to open paper on this board.
    artwork: southAfricanArtwork([
        { kind: 'compass', x: 1038, y: 254 },
        { kind: 'acacia', x: 1290, y: 224, scale: 0.9 },
        { kind: 'acacia', x: 1350, y: 242, scale: 0.65 },
        { kind: 'diamond', x: 350, y: 560, scale: 0.85 },
        { kind: 'headframe', x: 1278, y: 1046, scale: 0.8 },
        { kind: 'mountains', x: 718, y: 1012, scale: 0.75 },
        { kind: 'acacia', x: 1182, y: 560, scale: 0.75 },
        { kind: 'ship', x: 1560, y: 1166, scale: 0.42 }
    ])
}
