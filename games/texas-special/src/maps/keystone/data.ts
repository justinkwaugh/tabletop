import {
    SettlementKind,
    type ExternalConnectionDefinition,
    type LinkDefinition,
    type SettlementDefinition
} from '../types.js'

export const SETTLEMENTS: readonly SettlementDefinition[] = [
    {
        id: 'resource-1',
        name: 'Natural Resource 1',
        kind: SettlementKind.NaturalResource,
        x: 1680,
        y: 260.5
    },
    {
        id: 'resource-2',
        name: 'Natural Resource 2',
        kind: SettlementKind.NaturalResource,
        x: 1611,
        y: 289.5
    },
    {
        id: 'resource-3',
        name: 'Natural Resource 3',
        kind: SettlementKind.NaturalResource,
        x: 1536,
        y: 349.5
    },
    {
        id: 'station-1',
        name: 'Station 1',
        kind: SettlementKind.RailroadStation,
        x: 1369.5,
        y: 351.5
    },
    {
        id: 'station-2',
        name: 'Station 2',
        kind: SettlementKind.RailroadStation,
        x: 1679.5,
        y: 357.5
    },
    {
        id: 'resource-4',
        name: 'Natural Resource 4',
        kind: SettlementKind.NaturalResource,
        x: 1243,
        y: 399.5
    },
    {
        id: 'resource-5',
        name: 'Natural Resource 5',
        kind: SettlementKind.NaturalResource,
        x: 1510.5,
        y: 401.5
    },
    {
        id: 'resource-6',
        name: 'Natural Resource 6',
        kind: SettlementKind.NaturalResource,
        x: 410.5,
        y: 406
    },
    {
        id: 'resource-7',
        name: 'Natural Resource 7',
        kind: SettlementKind.NaturalResource,
        x: 1165.5,
        y: 407.5
    },
    {
        id: 'resource-8',
        name: 'Natural Resource 8',
        kind: SettlementKind.NaturalResource,
        x: 505,
        y: 416
    },
    {
        id: 'resource-9',
        name: 'Natural Resource 9',
        kind: SettlementKind.NaturalResource,
        x: 1301.5,
        y: 422.5
    },
    { id: 'station-3', name: 'Station 3', kind: SettlementKind.RailroadStation, x: 1601.5, y: 426 },
    { id: 'station-4', name: 'Station 4', kind: SettlementKind.RailroadStation, x: 1416, y: 469.5 },
    {
        id: 'resource-10',
        name: 'Natural Resource 10',
        kind: SettlementKind.NaturalResource,
        x: 594,
        y: 477
    },
    { id: 'station-5', name: 'Station 5', kind: SettlementKind.RailroadStation, x: 1065.5, y: 478 },
    { id: 'station-6', name: 'Station 6', kind: SettlementKind.RailroadStation, x: 1478, y: 484.5 },
    { id: 'station-7', name: 'Station 7', kind: SettlementKind.RailroadStation, x: 1236, y: 491 },
    {
        id: 'market-1',
        name: 'Mercantile Center 1',
        kind: SettlementKind.MercantileCenter,
        x: 1149,
        y: 497.5
    },
    { id: 'station-8', name: 'Station 8', kind: SettlementKind.RailroadStation, x: 415.5, y: 501 },
    {
        id: 'market-2',
        name: 'Mercantile Center 2',
        kind: SettlementKind.MercantileCenter,
        x: 945.5,
        y: 514
    },
    {
        id: 'market-3',
        name: 'Mercantile Center 3',
        kind: SettlementKind.MercantileCenter,
        x: 510.5,
        y: 530.5
    },
    {
        id: 'market-4',
        name: 'Mercantile Center 4',
        kind: SettlementKind.MercantileCenter,
        x: 1347.5,
        y: 536
    },
    { id: 'green-base', name: 'Green Base', kind: SettlementKind.RailroadBase, x: 1563, y: 543.5 },
    { id: 'works', name: 'The Works', kind: SettlementKind.MetroArea, x: 629.5, y: 563.5 },
    {
        id: 'station-9',
        name: 'Station 9',
        kind: SettlementKind.RailroadStation,
        x: 1204.5,
        y: 571.5
    },
    { id: 'station-10', name: 'Station 10', kind: SettlementKind.RailroadStation, x: 993, y: 596 },
    { id: 'station-11', name: 'Station 11', kind: SettlementKind.RailroadStation, x: 1106, y: 592 },
    {
        id: 'market-5',
        name: 'Mercantile Center 5',
        kind: SettlementKind.MercantileCenter,
        x: 1450,
        y: 590
    },
    {
        id: 'station-12',
        name: 'Station 12',
        kind: SettlementKind.RailroadStation,
        x: 858.5,
        y: 595.5
    },
    {
        id: 'resource-11',
        name: 'Natural Resource 11',
        kind: SettlementKind.NaturalResource,
        x: 904.5,
        y: 605
    },
    { id: 'crossroads', name: 'The Crossroads', kind: SettlementKind.MetroArea, x: 274, y: 618 },
    { id: 'station-13', name: 'Station 13', kind: SettlementKind.RailroadStation, x: 409, y: 619 },
    {
        id: 'station-14',
        name: 'Station 14',
        kind: SettlementKind.RailroadStation,
        x: 1540,
        y: 630.5
    },
    {
        id: 'market-6',
        name: 'Mercantile Center 6',
        kind: SettlementKind.MercantileCenter,
        x: 577,
        y: 647
    },
    {
        id: 'market-7',
        name: 'Mercantile Center 7',
        kind: SettlementKind.MercantileCenter,
        x: 713,
        y: 655.5
    },
    {
        id: 'station-15',
        name: 'Station 15',
        kind: SettlementKind.RailroadStation,
        x: 1217.5,
        y: 663
    },
    {
        id: 'resource-12',
        name: 'Natural Resource 12',
        kind: SettlementKind.NaturalResource,
        x: 1175,
        y: 677
    },
    {
        id: 'resource-13',
        name: 'Natural Resource 13',
        kind: SettlementKind.NaturalResource,
        x: 1014.5,
        y: 671.5
    },
    {
        id: 'market-8',
        name: 'Mercantile Center 8',
        kind: SettlementKind.MercantileCenter,
        x: 1429,
        y: 680.5
    },
    { id: 'station-16', name: 'Station 16', kind: SettlementKind.RailroadStation, x: 1099, y: 689 },
    {
        id: 'station-17',
        name: 'Station 17',
        kind: SettlementKind.RailroadStation,
        x: 798,
        y: 682.5
    },
    {
        id: 'resource-14',
        name: 'Natural Resource 14',
        kind: SettlementKind.NaturalResource,
        x: 971,
        y: 681
    },
    {
        id: 'market-9',
        name: 'Mercantile Center 9',
        kind: SettlementKind.MercantileCenter,
        x: 466.5,
        y: 699
    },
    {
        id: 'station-18',
        name: 'Station 18',
        kind: SettlementKind.RailroadStation,
        x: 557,
        y: 729.5
    },
    { id: 'black-base', name: 'Black Base', kind: SettlementKind.RailroadBase, x: 1344, y: 729.5 },
    {
        id: 'station-19',
        name: 'Station 19',
        kind: SettlementKind.RailroadStation,
        x: 997,
        y: 763.5
    },
    {
        id: 'station-20',
        name: 'Station 20',
        kind: SettlementKind.RailroadStation,
        x: 753,
        y: 757.5
    },
    { id: 'keystone', name: 'The Keystone', kind: SettlementKind.MetroArea, x: 876, y: 759 },
    {
        id: 'market-10',
        name: 'Mercantile Center 10',
        kind: SettlementKind.MercantileCenter,
        x: 1117,
        y: 782.5
    },
    {
        id: 'resource-15',
        name: 'Natural Resource 15',
        kind: SettlementKind.NaturalResource,
        x: 1041.5,
        y: 799
    },
    {
        id: 'station-21',
        name: 'Station 21',
        kind: SettlementKind.RailroadStation,
        x: 262.5,
        y: 802.5
    },
    {
        id: 'market-11',
        name: 'Mercantile Center 11',
        kind: SettlementKind.MercantileCenter,
        x: 784,
        y: 805
    },
    { id: 'red-base', name: 'Red Base', kind: SettlementKind.RailroadBase, x: 1267.5, y: 812 },
    { id: 'station-22', name: 'Station 22', kind: SettlementKind.RailroadStation, x: 641, y: 804 },
    {
        id: 'station-23',
        name: 'Station 23',
        kind: SettlementKind.RailroadStation,
        x: 521,
        y: 810.5
    },
    {
        id: 'station-24',
        name: 'Station 24',
        kind: SettlementKind.RailroadStation,
        x: 958.5,
        y: 829.5
    },
    {
        id: 'market-12',
        name: 'Mercantile Center 12',
        kind: SettlementKind.MercantileCenter,
        x: 98.5,
        y: 836
    },
    {
        id: 'market-13',
        name: 'Mercantile Center 13',
        kind: SettlementKind.MercantileCenter,
        x: 391,
        y: 841
    },
    {
        id: 'resource-16',
        name: 'Natural Resource 16',
        kind: SettlementKind.NaturalResource,
        x: 719,
        y: 858.5
    },
    { id: 'station-25', name: 'Station 25', kind: SettlementKind.RailroadStation, x: 1038, y: 867 },
    { id: 'blue-base', name: 'Blue Base', kind: SettlementKind.RailroadBase, x: 1171, y: 865 },
    {
        id: 'station-26',
        name: 'Station 26',
        kind: SettlementKind.RailroadStation,
        x: 286.5,
        y: 870
    },
    {
        id: 'station-27',
        name: 'Station 27',
        kind: SettlementKind.RailroadStation,
        x: 652.5,
        y: 889.5
    },
    {
        id: 'station-28',
        name: 'Station 28',
        kind: SettlementKind.RailroadStation,
        x: 850,
        y: 887.5
    },
    { id: 'bend', name: 'The Bend', kind: SettlementKind.MetroArea, x: 511, y: 906.5 },
    {
        id: 'resource-17',
        name: 'Natural Resource 17',
        kind: SettlementKind.NaturalResource,
        x: 944,
        y: 916.5
    },
    {
        id: 'station-29',
        name: 'Station 29',
        kind: SettlementKind.RailroadStation,
        x: 1113.5,
        y: 937
    },
    {
        id: 'station-30',
        name: 'Station 30',
        kind: SettlementKind.RailroadStation,
        x: 987.5,
        y: 940.5
    },
    { id: 'landing', name: 'The Landing', kind: SettlementKind.MetroArea, x: 60.5, y: 949.5 },
    {
        id: 'resource-18',
        name: 'Natural Resource 18',
        kind: SettlementKind.NaturalResource,
        x: 918,
        y: 955
    },
    {
        id: 'market-14',
        name: 'Mercantile Center 14',
        kind: SettlementKind.MercantileCenter,
        x: 742.5,
        y: 962
    },
    {
        id: 'resource-19',
        name: 'Natural Resource 19',
        kind: SettlementKind.NaturalResource,
        x: 824.5,
        y: 971.5
    },
    {
        id: 'market-15',
        name: 'Mercantile Center 15',
        kind: SettlementKind.MercantileCenter,
        x: 417.5,
        y: 995.5
    },
    {
        id: 'station-31',
        name: 'Station 31',
        kind: SettlementKind.RailroadStation,
        x: 1016.5,
        y: 1005
    },
    {
        id: 'station-32',
        name: 'Station 32',
        kind: SettlementKind.RailroadStation,
        x: 274.5,
        y: 1013.5
    },
    {
        id: 'station-33',
        name: 'Station 33',
        kind: SettlementKind.RailroadStation,
        x: 533,
        y: 1013.5
    },
    {
        id: 'station-34',
        name: 'Station 34',
        kind: SettlementKind.RailroadStation,
        x: 929,
        y: 1031.5
    },
    {
        id: 'station-35',
        name: 'Station 35',
        kind: SettlementKind.RailroadStation,
        x: 831.5,
        y: 1037.5
    },
    {
        id: 'resource-20',
        name: 'Natural Resource 20',
        kind: SettlementKind.NaturalResource,
        x: 707,
        y: 1044
    },
    { id: 'brown-base', name: 'Brown Base', kind: SettlementKind.RailroadBase, x: 1082, y: 1063 },
    {
        id: 'resource-21',
        name: 'Natural Resource 21',
        kind: SettlementKind.NaturalResource,
        x: 907.5,
        y: 1084
    },
    {
        id: 'resource-22',
        name: 'Natural Resource 22',
        kind: SettlementKind.NaturalResource,
        x: 755.5,
        y: 1085
    },
    {
        id: 'resource-23',
        name: 'Natural Resource 23',
        kind: SettlementKind.NaturalResource,
        x: 996.5,
        y: 1094
    }
]

export const LINKS: readonly LinkDefinition[] = [
    { id: 'bend~market-13', ends: ['bend', 'market-13'], box: { x: 451, y: 871 } },
    { id: 'bend~market-14', ends: ['bend', 'market-14'], box: { x: 630, y: 933.5 } },
    { id: 'bend~station-22', ends: ['bend', 'station-22'], box: { x: 579, y: 857.5 } },
    { id: 'bend~station-23', ends: ['bend', 'station-23'], box: { x: 535, y: 850 } },
    { id: 'bend~station-27', ends: ['bend', 'station-27'], box: { x: 597.5, y: 895.5 } },
    { id: 'bend~station-33', ends: ['bend', 'station-33'], box: { x: 527.5, y: 968.5 } },
    { id: 'black-base~market-4', ends: ['black-base', 'market-4'], box: { x: 1346.5, y: 632 } },
    { id: 'black-base~market-8', ends: ['black-base', 'market-8'], box: { x: 1388, y: 709 } },
    { id: 'black-base~red-base', ends: ['black-base', 'red-base'], box: { x: 1310, y: 778 } },
    {
        id: 'black-base~station-15',
        ends: ['black-base', 'station-15'],
        box: { x: 1271.5, y: 697.5 }
    },
    { id: 'black-base~station-9', ends: ['black-base', 'station-9'], box: { x: 1275, y: 651.5 } },
    { id: 'blue-base~market-10', ends: ['blue-base', 'market-10'], box: { x: 1144, y: 824 } },
    { id: 'blue-base~red-base', ends: ['blue-base', 'red-base'], box: { x: 1215.5, y: 844.5 } },
    { id: 'blue-base~station-25', ends: ['blue-base', 'station-25'], box: { x: 1106.5, y: 870.5 } },
    { id: 'blue-base~station-29', ends: ['blue-base', 'station-29'], box: { x: 1143.5, y: 904.5 } },
    {
        id: 'brown-base~station-29',
        ends: ['brown-base', 'station-29'],
        box: { x: 1102.5, y: 995.5 }
    },
    {
        id: 'brown-base~station-34',
        ends: ['brown-base', 'station-34'],
        box: { x: 1010.5, y: 1051.5 }
    },
    { id: 'crossroads~market-12', ends: ['crossroads', 'market-12'], box: { x: 189.5, y: 719.5 } },
    { id: 'crossroads~market-9', ends: ['crossroads', 'market-9'], box: { x: 383.5, y: 663.5 } },
    { id: 'crossroads~station-13', ends: ['crossroads', 'station-13'], box: { x: 351, y: 616.5 } },
    { id: 'crossroads~station-21', ends: ['crossroads', 'station-21'], box: { x: 272, y: 719.5 } },
    { id: 'green-base~market-5', ends: ['green-base', 'market-5'], box: { x: 1504.5, y: 572.5 } },
    {
        id: 'green-base~station-14',
        ends: ['green-base', 'station-14'],
        box: { x: 1557.5, y: 590.5 }
    },
    { id: 'green-base~station-3', ends: ['green-base', 'station-3'], box: { x: 1583, y: 493.5 } },
    { id: 'green-base~station-6', ends: ['green-base', 'station-6'], box: { x: 1519, y: 515.5 } },
    { id: 'keystone~market-11', ends: ['keystone', 'market-11'], box: { x: 826, y: 796 } },
    { id: 'keystone~station-10', ends: ['keystone', 'station-10'], box: { x: 931, y: 664 } },
    { id: 'keystone~station-12', ends: ['keystone', 'station-12'], box: { x: 864.5, y: 677 } },
    { id: 'keystone~station-17', ends: ['keystone', 'station-17'], box: { x: 828.5, y: 715.5 } },
    { id: 'keystone~station-19', ends: ['keystone', 'station-19'], box: { x: 942.5, y: 757.5 } },
    { id: 'keystone~station-20', ends: ['keystone', 'station-20'], box: { x: 804, y: 756.5 } },
    { id: 'keystone~station-24', ends: ['keystone', 'station-24'], box: { x: 924, y: 801 } },
    { id: 'landing~market-12', ends: ['landing', 'market-12'], box: { x: 79, y: 882.5 } },
    { id: 'landing~station-21', ends: ['landing', 'station-21'], box: { x: 188, y: 856 } },
    { id: 'landing~station-26', ends: ['landing', 'station-26'], box: { x: 196.5, y: 899.5 } },
    { id: 'landing~station-32', ends: ['landing', 'station-32'], box: { x: 171, y: 982 } },
    { id: 'market-1~station-5', ends: ['market-1', 'station-5'], box: { x: 1107, y: 484.5 } },
    { id: 'market-1~station-7', ends: ['market-1', 'station-7'], box: { x: 1192, y: 490 } },
    { id: 'market-10~red-base', ends: ['market-10', 'red-base'], box: { x: 1188.5, y: 795 } },
    { id: 'market-10~station-16', ends: ['market-10', 'station-16'], box: { x: 1109, y: 732 } },
    { id: 'market-10~station-19', ends: ['market-10', 'station-19'], box: { x: 1065, y: 762 } },
    { id: 'market-10~station-25', ends: ['market-10', 'station-25'], box: { x: 1077.5, y: 826 } },
    { id: 'market-11~resource-16', ends: ['market-11', 'resource-16'], box: { x: 759, y: 840 } },
    { id: 'market-11~station-22', ends: ['market-11', 'station-22'], box: { x: 724.5, y: 814 } },
    { id: 'market-11~station-28', ends: ['market-11', 'station-28'], box: { x: 822, y: 852 } },
    { id: 'market-12~station-21', ends: ['market-12', 'station-21'], box: { x: 182.5, y: 813 } },
    { id: 'market-13~market-15', ends: ['market-13', 'market-15'], box: { x: 405.5, y: 917.5 } },
    { id: 'market-13~market-9', ends: ['market-13', 'market-9'], box: { x: 426, y: 775.5 } },
    { id: 'market-13~station-23', ends: ['market-13', 'station-23'], box: { x: 469, y: 831 } },
    { id: 'market-13~station-26', ends: ['market-13', 'station-26'], box: { x: 338.5, y: 853.5 } },
    { id: 'market-14~resource-20', ends: ['market-14', 'resource-20'], box: { x: 725, y: 1003 } },
    { id: 'market-14~station-27', ends: ['market-14', 'station-27'], box: { x: 693, y: 922.5 } },
    { id: 'market-14~station-33', ends: ['market-14', 'station-33'], box: { x: 641, y: 989 } },
    { id: 'market-14~station-35', ends: ['market-14', 'station-35'], box: { x: 784, y: 1000.5 } },
    { id: 'market-15~station-32', ends: ['market-15', 'station-32'], box: { x: 354.5, y: 1003.5 } },
    { id: 'market-15~station-33', ends: ['market-15', 'station-33'], box: { x: 481, y: 1003.5 } },
    { id: 'market-2~station-10', ends: ['market-2', 'station-10'], box: { x: 975.5, y: 556 } },
    { id: 'market-2~station-11', ends: ['market-2', 'station-11'], box: { x: 1031, y: 558.5 } },
    { id: 'market-2~station-12', ends: ['market-2', 'station-12'], box: { x: 934, y: 557 } },
    { id: 'market-2~station-5', ends: ['market-2', 'station-5'], box: { x: 1003, y: 519.5 } },
    { id: 'market-3~resource-10', ends: ['market-3', 'resource-10'], box: { x: 548, y: 506 } },
    { id: 'market-3~station-8', ends: ['market-3', 'station-8'], box: { x: 467, y: 518.5 } },
    { id: 'market-3~works', ends: ['market-3', 'works'], box: { x: 563, y: 547.5 } },
    { id: 'market-4~market-5', ends: ['market-4', 'market-5'], box: { x: 1396, y: 563 } },
    { id: 'market-4~resource-9', ends: ['market-4', 'resource-9'], box: { x: 1323.5, y: 478 } },
    { id: 'market-4~station-1', ends: ['market-4', 'station-1'], box: { x: 1358, y: 445 } },
    { id: 'market-4~station-7', ends: ['market-4', 'station-7'], box: { x: 1283.5, y: 511 } },
    { id: 'market-4~station-9', ends: ['market-4', 'station-9'], box: { x: 1276.5, y: 554.5 } },
    { id: 'market-5~market-8', ends: ['market-5', 'market-8'], box: { x: 1440, y: 633.5 } },
    { id: 'market-5~station-4', ends: ['market-5', 'station-4'], box: { x: 1426, y: 529.5 } },
    { id: 'market-5~station-6', ends: ['market-5', 'station-6'], box: { x: 1469, y: 533.5 } },
    { id: 'market-6~market-7', ends: ['market-6', 'market-7'], box: { x: 660.5, y: 648 } },
    { id: 'market-6~market-9', ends: ['market-6', 'market-9'], box: { x: 530.5, y: 670 } },
    { id: 'market-6~station-13', ends: ['market-6', 'station-13'], box: { x: 506.5, y: 632 } },
    { id: 'market-6~station-18', ends: ['market-6', 'station-18'], box: { x: 578, y: 690 } },
    { id: 'market-6~works', ends: ['market-6', 'works'], box: { x: 613, y: 623 } },
    { id: 'market-7~station-12', ends: ['market-7', 'station-12'], box: { x: 792.5, y: 622.5 } },
    { id: 'market-7~station-17', ends: ['market-7', 'station-17'], box: { x: 755.5, y: 670 } },
    { id: 'market-7~station-18', ends: ['market-7', 'station-18'], box: { x: 649.5, y: 690 } },
    { id: 'market-8~station-14', ends: ['market-8', 'station-14'], box: { x: 1489.5, y: 652 } },
    { id: 'market-9~station-18', ends: ['market-9', 'station-18'], box: { x: 510, y: 711.5 } },
    { id: 'market-9~station-21', ends: ['market-9', 'station-21'], box: { x: 370.5, y: 746.5 } },
    { id: 'red-base~station-15', ends: ['red-base', 'station-15'], box: { x: 1238.5, y: 737 } },
    { id: 'red-base~station-16', ends: ['red-base', 'station-16'], box: { x: 1174, y: 740.5 } },
    { id: 'resource-1~station-2', ends: ['resource-1', 'station-2'], box: { x: 1680, y: 308 } },
    {
        id: 'resource-11~station-10',
        ends: ['resource-11', 'station-10'],
        box: { x: 948.5, y: 598 }
    },
    {
        id: 'resource-12~station-16',
        ends: ['resource-12', 'station-16'],
        box: { x: 1133.5, y: 665 }
    },
    {
        id: 'resource-13~station-16',
        ends: ['resource-13', 'station-16'],
        box: { x: 1056.5, y: 680 }
    },
    {
        id: 'resource-14~station-19',
        ends: ['resource-14', 'station-19'],
        box: { x: 989.5, y: 720 }
    },
    { id: 'resource-15~station-24', ends: ['resource-15', 'station-24'], box: { x: 999, y: 811 } },
    {
        id: 'resource-17~station-24',
        ends: ['resource-17', 'station-24'],
        box: { x: 955.5, y: 873.5 }
    },
    {
        id: 'resource-18~station-28',
        ends: ['resource-18', 'station-28'],
        box: { x: 886, y: 923.5 }
    },
    { id: 'resource-19~station-28', ends: ['resource-19', 'station-28'], box: { x: 843, y: 931 } },
    { id: 'resource-2~station-2', ends: ['resource-2', 'station-2'], box: { x: 1640, y: 325 } },
    {
        id: 'resource-21~station-35',
        ends: ['resource-21', 'station-35'],
        box: { x: 866.5, y: 1066.5 }
    },
    {
        id: 'resource-22~station-35',
        ends: ['resource-22', 'station-35'],
        box: { x: 794.5, y: 1062.5 }
    },
    {
        id: 'resource-23~station-34',
        ends: ['resource-23', 'station-34'],
        box: { x: 959.5, y: 1064 }
    },
    { id: 'resource-3~station-3', ends: ['resource-3', 'station-3'], box: { x: 1567.5, y: 388 } },
    { id: 'resource-4~station-7', ends: ['resource-4', 'station-7'], box: { x: 1240.5, y: 444 } },
    { id: 'resource-5~station-6', ends: ['resource-5', 'station-6'], box: { x: 1496, y: 443.5 } },
    { id: 'resource-6~station-8', ends: ['resource-6', 'station-8'], box: { x: 415, y: 450.5 } },
    { id: 'resource-7~station-7', ends: ['resource-7', 'station-7'], box: { x: 1197, y: 446.5 } },
    { id: 'resource-8~station-8', ends: ['resource-8', 'station-8'], box: { x: 464, y: 456.5 } },
    { id: 'station-1~station-4', ends: ['station-1', 'station-4'], box: { x: 1395.5, y: 422.5 } },
    { id: 'station-1~station-6', ends: ['station-1', 'station-6'], box: { x: 1438.5, y: 423.5 } },
    { id: 'station-10~station-16', ends: ['station-10', 'station-16'], box: { x: 1046, y: 636.5 } },
    { id: 'station-11~station-15', ends: ['station-11', 'station-15'], box: { x: 1159, y: 628.5 } },
    { id: 'station-11~station-9', ends: ['station-11', 'station-9'], box: { x: 1155, y: 582.5 } },
    { id: 'station-13~station-8', ends: ['station-13', 'station-8'], box: { x: 411.5, y: 560.5 } },
    { id: 'station-13~works', ends: ['station-13', 'works'], box: { x: 521, y: 590 } },
    { id: 'station-15~station-9', ends: ['station-15', 'station-9'], box: { x: 1206.5, y: 619.5 } },
    { id: 'station-18~station-20', ends: ['station-18', 'station-20'], box: { x: 658, y: 740.5 } },
    { id: 'station-18~station-22', ends: ['station-18', 'station-22'], box: { x: 601, y: 769.5 } },
    { id: 'station-18~station-23', ends: ['station-18', 'station-23'], box: { x: 544.5, y: 773 } },
    { id: 'station-2~station-3', ends: ['station-2', 'station-3'], box: { x: 1642.5, y: 391.5 } },
    { id: 'station-20~station-22', ends: ['station-20', 'station-22'], box: { x: 699.5, y: 779 } },
    { id: 'station-22~station-23', ends: ['station-22', 'station-23'], box: { x: 582, y: 814.5 } },
    { id: 'station-22~station-27', ends: ['station-22', 'station-27'], box: { x: 641.5, y: 847 } },
    {
        id: 'station-24~station-25',
        ends: ['station-24', 'station-25'],
        box: { x: 995.5, y: 854.5 }
    },
    { id: 'station-24~station-28', ends: ['station-24', 'station-28'], box: { x: 907, y: 864 } },
    { id: 'station-25~station-29', ends: ['station-25', 'station-29'], box: { x: 1072.5, y: 898 } },
    { id: 'station-25~station-30', ends: ['station-25', 'station-30'], box: { x: 1013, y: 903.5 } },
    { id: 'station-26~station-32', ends: ['station-26', 'station-32'], box: { x: 281.5, y: 944 } },
    { id: 'station-27~station-28', ends: ['station-27', 'station-28'], box: { x: 760, y: 887 } },
    { id: 'station-29~station-31', ends: ['station-29', 'station-31'], box: { x: 1067.5, y: 969 } },
    { id: 'station-30~station-34', ends: ['station-30', 'station-34'], box: { x: 958, y: 978 } },
    { id: 'station-31~station-34', ends: ['station-31', 'station-34'], box: { x: 974, y: 1018 } },
    {
        id: 'station-34~station-35',
        ends: ['station-34', 'station-35'],
        box: { x: 884.5, y: 1027.5 }
    }
]

// The crossings add nothing to a railroad's value.
export const EXTERNAL_CONNECTIONS: readonly ExternalConnectionDefinition[] = [
    {
        id: 'north-crossing',
        name: 'North Crossing',
        settlementId: 'market-2',
        price: 30,
        value: 0,
        x: 864.5,
        y: 471.5
    },
    {
        id: 'northwest-crossing',
        name: 'Northwest Crossing',
        settlementId: 'works',
        price: 30,
        value: 0,
        x: 734,
        y: 532
    },
    {
        id: 'northeast-crossing',
        name: 'Northeast Crossing',
        settlementId: 'station-1',
        price: 30,
        value: 0,
        x: 1308,
        y: 319
    }
]
