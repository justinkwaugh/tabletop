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
        x: 1989,
        y: 271
    },
    {
        id: 'resource-2',
        name: 'Natural Resource 2',
        kind: SettlementKind.NaturalResource,
        x: 1888,
        y: 305
    },
    {
        id: 'resource-3',
        name: 'Natural Resource 3',
        kind: SettlementKind.NaturalResource,
        x: 1800,
        y: 376
    },
    { id: 'burlington', name: 'Burlington', kind: SettlementKind.RailroadStation, x: 1604, y: 378 },
    { id: 'bangor', name: 'Bangor', kind: SettlementKind.RailroadStation, x: 1969, y: 385 },
    {
        id: 'resource-4',
        name: 'Natural Resource 4',
        kind: SettlementKind.NaturalResource,
        x: 1455,
        y: 436
    },
    {
        id: 'resource-5',
        name: 'Natural Resource 5',
        kind: SettlementKind.NaturalResource,
        x: 1769,
        y: 440
    },
    {
        id: 'resource-6',
        name: 'Natural Resource 6',
        kind: SettlementKind.NaturalResource,
        x: 476,
        y: 444
    },
    {
        id: 'resource-7',
        name: 'Natural Resource 7',
        kind: SettlementKind.NaturalResource,
        x: 1364,
        y: 444
    },
    {
        id: 'resource-8',
        name: 'Natural Resource 8',
        kind: SettlementKind.NaturalResource,
        x: 587,
        y: 454
    },
    {
        id: 'resource-9',
        name: 'Natural Resource 9',
        kind: SettlementKind.NaturalResource,
        x: 1524,
        y: 462
    },
    { id: 'portland', name: 'Portland', kind: SettlementKind.RailroadStation, x: 1877, y: 466 },
    { id: 'rutland', name: 'Rutland', kind: SettlementKind.RailroadStation, x: 1659, y: 517 },
    {
        id: 'resource-10',
        name: 'Natural Resource 10',
        kind: SettlementKind.NaturalResource,
        x: 692,
        y: 526
    },
    { id: 'rochester', name: 'Rochester', kind: SettlementKind.RailroadStation, x: 1221, y: 530 },
    { id: 'manchester', name: 'Manchester', kind: SettlementKind.RailroadStation, x: 1733, y: 532 },
    { id: 'utica', name: 'Utica', kind: SettlementKind.RailroadStation, x: 1439, y: 542 },
    { id: 'syracuse', name: 'Syracuse', kind: SettlementKind.MercantileCenter, x: 1345, y: 545 },
    {
        id: 'grand-rapids',
        name: 'Grand Rapids',
        kind: SettlementKind.RailroadStation,
        x: 482,
        y: 554
    },
    { id: 'buffalo', name: 'Buffalo', kind: SettlementKind.MercantileCenter, x: 1105, y: 572 },
    { id: 'lansing', name: 'Lansing', kind: SettlementKind.MercantileCenter, x: 594, y: 588 },
    { id: 'albany', name: 'Albany', kind: SettlementKind.MercantileCenter, x: 1578, y: 595 },
    { id: 'boston', name: 'Boston', kind: SettlementKind.RailroadBase, x: 1831, y: 610.5 },
    { id: 'detroit', name: 'Detroit', kind: SettlementKind.MetroArea, x: 732.5, y: 632 },
    { id: 'binghamton', name: 'Binghamton', kind: SettlementKind.RailroadStation, x: 1410, y: 637 },
    { id: 'bradford', name: 'Bradford', kind: SettlementKind.RailroadStation, x: 1158, y: 660 },
    { id: 'elmira', name: 'Elmira', kind: SettlementKind.RailroadStation, x: 1294, y: 661 },
    {
        id: 'springfield-e',
        name: 'Springfield',
        kind: SettlementKind.MercantileCenter,
        x: 1698,
        y: 662
    },
    { id: 'erie', name: 'Erie', kind: SettlementKind.RailroadStation, x: 1003, y: 665 },
    {
        id: 'resource-11',
        name: 'Natural Resource 11',
        kind: SettlementKind.NaturalResource,
        x: 1059,
        y: 676
    },
    { id: 'chicago', name: 'Chicago', kind: SettlementKind.MetroArea, x: 315, y: 692 },
    { id: 'south-bend', name: 'South Bend', kind: SettlementKind.RailroadStation, x: 474, y: 693 },
    {
        id: 'providence',
        name: 'Providence',
        kind: SettlementKind.RailroadStation,
        x: 1807.5,
        y: 700.5
    },
    { id: 'toledo', name: 'Toledo', kind: SettlementKind.MercantileCenter, x: 684.5, y: 729 },
    { id: 'cleveland', name: 'Cleveland', kind: SettlementKind.MercantileCenter, x: 832, y: 736 },
    { id: 'scranton', name: 'Scranton', kind: SettlementKind.RailroadStation, x: 1420, y: 745 },
    {
        id: 'resource-12',
        name: 'Natural Resource 12',
        kind: SettlementKind.NaturalResource,
        x: 1370.5,
        y: 756
    },
    {
        id: 'resource-13',
        name: 'Natural Resource 13',
        kind: SettlementKind.NaturalResource,
        x: 1190,
        y: 760
    },
    { id: 'new-haven', name: 'New Haven', kind: SettlementKind.MercantileCenter, x: 1674, y: 765 },
    {
        id: 'lock-haven',
        name: 'Lock Haven',
        kind: SettlementKind.RailroadStation,
        x: 1282.5,
        y: 766.5
    },
    { id: 'youngstown', name: 'Youngstown', kind: SettlementKind.RailroadStation, x: 929, y: 768 },
    {
        id: 'resource-14',
        name: 'Natural Resource 14',
        kind: SettlementKind.NaturalResource,
        x: 1141,
        y: 768.5
    },
    { id: 'fort-wayne', name: 'Fort Wayne', kind: SettlementKind.MercantileCenter, x: 542, y: 787 },
    { id: 'lima', name: 'Lima', kind: SettlementKind.RailroadStation, x: 651, y: 818 },
    { id: 'new-york', name: 'New York', kind: SettlementKind.RailroadBase, x: 1576, y: 822 },
    { id: 'altoona', name: 'Altoona', kind: SettlementKind.RailroadStation, x: 1164.5, y: 854.5 },
    {
        id: 'steubenville',
        name: 'Steubenville',
        kind: SettlementKind.RailroadStation,
        x: 879,
        y: 856
    },
    { id: 'pittsburgh', name: 'Pittsburgh', kind: SettlementKind.MetroArea, x: 1021, y: 861 },
    {
        id: 'harrisburg',
        name: 'Harrisburg',
        kind: SettlementKind.MercantileCenter,
        x: 1307,
        y: 885
    },
    {
        id: 'resource-15',
        name: 'Natural Resource 15',
        kind: SettlementKind.NaturalResource,
        x: 1216,
        y: 902
    },
    { id: 'champaign', name: 'Champaign', kind: SettlementKind.RailroadStation, x: 302, y: 909 },
    { id: 'columbus', name: 'Columbus', kind: SettlementKind.RailroadStation, x: 747, y: 917 },
    { id: 'wheeling', name: 'Wheeling', kind: SettlementKind.MercantileCenter, x: 922.5, y: 919.5 },
    {
        id: 'philadelphia',
        name: 'Philadelphia',
        kind: SettlementKind.RailroadBase,
        x: 1484,
        y: 920
    },
    { id: 'dayton', name: 'Dayton', kind: SettlementKind.RailroadStation, x: 617, y: 924 },
    { id: 'cumberland', name: 'Cumberland', kind: SettlementKind.RailroadStation, x: 1122, y: 943 },
    {
        id: 'springfield-w',
        name: 'Springfield',
        kind: SettlementKind.MercantileCenter,
        x: 109,
        y: 948
    },
    {
        id: 'indianapolis',
        name: 'Indianapolis',
        kind: SettlementKind.MercantileCenter,
        x: 453,
        y: 954
    },
    {
        id: 'resource-16',
        name: 'Natural Resource 16',
        kind: SettlementKind.NaturalResource,
        x: 846,
        y: 970
    },
    {
        id: 'martinsburg',
        name: 'Martinsburg',
        kind: SettlementKind.RailroadStation,
        x: 1210,
        y: 986
    },
    { id: 'baltimore', name: 'Baltimore', kind: SettlementKind.RailroadBase, x: 1368, y: 986 },
    {
        id: 'terre-haute',
        name: 'Terre Haute',
        kind: SettlementKind.RailroadStation,
        x: 330,
        y: 988
    },
    {
        id: 'chillicothe',
        name: 'Chillicothe',
        kind: SettlementKind.RailroadStation,
        x: 759,
        y: 1004.5
    },
    { id: 'clarksburg', name: 'Clarksburg', kind: SettlementKind.RailroadStation, x: 992, y: 1014 },
    { id: 'cincinnati', name: 'Cincinnati', kind: SettlementKind.MetroArea, x: 596.5, y: 1029 },
    {
        id: 'resource-17',
        name: 'Natural Resource 17',
        kind: SettlementKind.NaturalResource,
        x: 1105,
        y: 1038
    },
    {
        id: 'washington',
        name: 'Washington',
        kind: SettlementKind.RailroadStation,
        x: 1305,
        y: 1065
    },
    {
        id: 'front-royal',
        name: 'Front Royal',
        kind: SettlementKind.RailroadStation,
        x: 1155,
        y: 1071
    },
    { id: 'st-louis', name: 'St Louis', kind: SettlementKind.MetroArea, x: 64, y: 1082 },
    {
        id: 'resource-18',
        name: 'Natural Resource 18',
        kind: SettlementKind.NaturalResource,
        x: 1072,
        y: 1087
    },
    {
        id: 'charleston',
        name: 'Charleston',
        kind: SettlementKind.MercantileCenter,
        x: 865,
        y: 1100
    },
    {
        id: 'resource-19',
        name: 'Natural Resource 19',
        kind: SettlementKind.NaturalResource,
        x: 965,
        y: 1103
    },
    {
        id: 'louisville',
        name: 'Louisville',
        kind: SettlementKind.MercantileCenter,
        x: 484,
        y: 1136
    },
    {
        id: 'charlottesville',
        name: 'Charlottesville',
        kind: SettlementKind.RailroadStation,
        x: 1185,
        y: 1148
    },
    { id: 'evansville', name: 'Evansville', kind: SettlementKind.RailroadStation, x: 316, y: 1157 },
    { id: 'lexington', name: 'Lexington', kind: SettlementKind.RailroadStation, x: 620, y: 1157 },
    { id: 'staunton', name: 'Staunton', kind: SettlementKind.RailroadStation, x: 1085, y: 1178 },
    { id: 'beckley', name: 'Beckley', kind: SettlementKind.RailroadStation, x: 970, y: 1186 },
    {
        id: 'resource-20',
        name: 'Natural Resource 20',
        kind: SettlementKind.NaturalResource,
        x: 825,
        y: 1192
    },
    { id: 'richmond', name: 'Richmond', kind: SettlementKind.RailroadBase, x: 1266, y: 1215 },
    {
        id: 'resource-21',
        name: 'Natural Resource 21',
        kind: SettlementKind.NaturalResource,
        x: 1059,
        y: 1239
    },
    {
        id: 'resource-22',
        name: 'Natural Resource 22',
        kind: SettlementKind.NaturalResource,
        x: 882,
        y: 1241
    },
    {
        id: 'resource-23',
        name: 'Natural Resource 23',
        kind: SettlementKind.NaturalResource,
        x: 1165,
        y: 1252
    }
]

export const LINKS: readonly LinkDefinition[] = [
    { id: 'albany~binghamton', ends: ['albany', 'binghamton'], box: { x: 1495, y: 617 } },
    { id: 'albany~burlington', ends: ['albany', 'burlington'], box: { x: 1592, y: 487 } },
    { id: 'albany~new-york', ends: ['albany', 'new-york'], box: { x: 1577, y: 708 } },
    { id: 'albany~resource-9', ends: ['albany', 'resource-9'], box: { x: 1550, y: 527 } },
    { id: 'albany~springfield-e', ends: ['albany', 'springfield-e'], box: { x: 1635, y: 627 } },
    { id: 'albany~utica', ends: ['albany', 'utica'], box: { x: 1503, y: 566 } },
    { id: 'altoona~harrisburg', ends: ['altoona', 'harrisburg'], box: { x: 1243, y: 866 } },
    { id: 'altoona~pittsburgh', ends: ['altoona', 'pittsburgh'], box: { x: 1102, y: 856 } },
    { id: 'altoona~resource-14', ends: ['altoona', 'resource-14'], box: { x: 1154, y: 811 } },
    { id: 'baltimore~harrisburg', ends: ['baltimore', 'harrisburg'], box: { x: 1339, y: 934 } },
    { id: 'baltimore~martinsburg', ends: ['baltimore', 'martinsburg'], box: { x: 1294, y: 989 } },
    { id: 'baltimore~philadelphia', ends: ['baltimore', 'philadelphia'], box: { x: 1423, y: 958 } },
    { id: 'baltimore~washington', ends: ['baltimore', 'washington'], box: { x: 1339, y: 1027 } },
    { id: 'bangor~portland', ends: ['bangor', 'portland'], box: { x: 1925, y: 425 } },
    { id: 'bangor~resource-1', ends: ['bangor', 'resource-1'], box: { x: 1979, y: 328 } },
    { id: 'bangor~resource-2', ends: ['bangor', 'resource-2'], box: { x: 1925, y: 346 } },
    { id: 'beckley~charleston', ends: ['beckley', 'charleston'], box: { x: 915, y: 1142 } },
    { id: 'beckley~resource-21', ends: ['beckley', 'resource-21'], box: { x: 1015.5, y: 1217 } },
    { id: 'beckley~resource-22', ends: ['beckley', 'resource-22'], box: { x: 929, y: 1214 } },
    { id: 'beckley~staunton', ends: ['beckley', 'staunton'], box: { x: 1033.5, y: 1177 } },
    { id: 'binghamton~elmira', ends: ['binghamton', 'elmira'], box: { x: 1352, y: 650 } },
    { id: 'binghamton~new-york', ends: ['binghamton', 'new-york'], box: { x: 1493, y: 731 } },
    { id: 'binghamton~scranton', ends: ['binghamton', 'scranton'], box: { x: 1413, y: 695 } },
    { id: 'boston~manchester', ends: ['boston', 'manchester'], box: { x: 1780, y: 571 } },
    { id: 'boston~portland', ends: ['boston', 'portland'], box: { x: 1855, y: 545 } },
    { id: 'boston~providence', ends: ['boston', 'providence'], box: { x: 1823.5, y: 659 } },
    { id: 'boston~springfield-e', ends: ['boston', 'springfield-e'], box: { x: 1763, y: 638 } },
    { id: 'bradford~buffalo', ends: ['bradford', 'buffalo'], box: { x: 1132, y: 618 } },
    { id: 'bradford~lock-haven', ends: ['bradford', 'lock-haven'], box: { x: 1223, y: 714 } },
    { id: 'bradford~pittsburgh', ends: ['bradford', 'pittsburgh'], box: { x: 1098, y: 750 } },
    { id: 'bradford~resource-11', ends: ['bradford', 'resource-11'], box: { x: 1107, y: 668 } },
    { id: 'buffalo~elmira', ends: ['buffalo', 'elmira'], box: { x: 1207, y: 619 } },
    { id: 'buffalo~erie', ends: ['buffalo', 'erie'], box: { x: 1056, y: 616 } },
    { id: 'buffalo~rochester', ends: ['buffalo', 'rochester'], box: { x: 1165, y: 570 } },
    { id: 'burlington~manchester', ends: ['burlington', 'manchester'], box: { x: 1681, y: 463 } },
    { id: 'burlington~rutland', ends: ['burlington', 'rutland'], box: { x: 1637, y: 463 } },
    { id: 'champaign~chicago', ends: ['champaign', 'chicago'], box: { x: 313, y: 811 } },
    { id: 'champaign~fort-wayne', ends: ['champaign', 'fort-wayne'], box: { x: 429, y: 843 } },
    {
        id: 'champaign~springfield-w',
        ends: ['champaign', 'springfield-w'],
        box: { x: 208, y: 923 }
    },
    { id: 'champaign~st-louis', ends: ['champaign', 'st-louis'], box: { x: 214, y: 970 } },
    { id: 'charleston~chillicothe', ends: ['charleston', 'chillicothe'], box: { x: 808, y: 1050 } },
    { id: 'charleston~cincinnati', ends: ['charleston', 'cincinnati'], box: { x: 734, y: 1063 } },
    { id: 'charleston~lexington', ends: ['charleston', 'lexington'], box: { x: 747, y: 1128 } },
    { id: 'charleston~resource-20', ends: ['charleston', 'resource-20'], box: { x: 847, y: 1142 } },
    {
        id: 'charlottesville~staunton',
        ends: ['charlottesville', 'staunton'],
        box: { x: 1140, y: 1159.5 }
    },
    {
        id: 'charlottesville~washington',
        ends: ['charlottesville', 'washington'],
        box: { x: 1249, y: 1105 }
    },
    { id: 'chicago~fort-wayne', ends: ['chicago', 'fort-wayne'], box: { x: 444, y: 745 } },
    { id: 'chicago~south-bend', ends: ['chicago', 'south-bend'], box: { x: 406, y: 690 } },
    { id: 'chicago~springfield-w', ends: ['chicago', 'springfield-w'], box: { x: 216, y: 811 } },
    {
        id: 'chillicothe~cincinnati',
        ends: ['chillicothe', 'cincinnati'],
        box: { x: 693, y: 1012.5 }
    },
    { id: 'chillicothe~clarksburg', ends: ['chillicothe', 'clarksburg'], box: { x: 887, y: 1008 } },
    { id: 'chillicothe~columbus', ends: ['chillicothe', 'columbus'], box: { x: 749.5, y: 961 } },
    { id: 'cincinnati~columbus', ends: ['cincinnati', 'columbus'], box: { x: 674.5, y: 972.5 } },
    { id: 'cincinnati~dayton', ends: ['cincinnati', 'dayton'], box: { x: 610, y: 967.5 } },
    {
        id: 'cincinnati~indianapolis',
        ends: ['cincinnati', 'indianapolis'],
        box: { x: 524, y: 988 }
    },
    { id: 'cincinnati~lexington', ends: ['cincinnati', 'lexington'], box: { x: 612, y: 1099 } },
    { id: 'clarksburg~cumberland', ends: ['clarksburg', 'cumberland'], box: { x: 1060, y: 981 } },
    {
        id: 'clarksburg~resource-18',
        ends: ['clarksburg', 'resource-18'],
        box: { x: 1036, y: 1052 }
    },
    { id: 'clarksburg~resource-19', ends: ['clarksburg', 'resource-19'], box: { x: 984, y: 1059 } },
    { id: 'clarksburg~wheeling', ends: ['clarksburg', 'wheeling'], box: { x: 960, y: 967 } },
    { id: 'cleveland~erie', ends: ['cleveland', 'erie'], box: { x: 925, y: 697 } },
    { id: 'cleveland~lima', ends: ['cleveland', 'lima'], box: { x: 758, y: 773 } },
    { id: 'cleveland~toledo', ends: ['cleveland', 'toledo'], box: { x: 769, y: 730 } },
    { id: 'cleveland~youngstown', ends: ['cleveland', 'youngstown'], box: { x: 886, y: 754 } },
    { id: 'columbus~dayton', ends: ['columbus', 'dayton'], box: { x: 677, y: 929 } },
    { id: 'columbus~lima', ends: ['columbus', 'lima'], box: { x: 700, y: 870 } },
    { id: 'columbus~steubenville', ends: ['columbus', 'steubenville'], box: { x: 819, y: 885.5 } },
    { id: 'columbus~wheeling', ends: ['columbus', 'wheeling'], box: { x: 844, y: 921 } },
    { id: 'cumberland~martinsburg', ends: ['cumberland', 'martinsburg'], box: { x: 1166, y: 968 } },
    { id: 'cumberland~pittsburgh', ends: ['cumberland', 'pittsburgh'], box: { x: 1079, y: 906 } },
    { id: 'cumberland~resource-15', ends: ['cumberland', 'resource-15'], box: { x: 1170, y: 921 } },
    { id: 'cumberland~resource-17', ends: ['cumberland', 'resource-17'], box: { x: 1116, y: 991 } },
    { id: 'dayton~indianapolis', ends: ['dayton', 'indianapolis'], box: { x: 544, y: 944 } },
    { id: 'dayton~lima', ends: ['dayton', 'lima'], box: { x: 630, y: 880 } },
    { id: 'detroit~lansing', ends: ['detroit', 'lansing'], box: { x: 655, y: 609 } },
    { id: 'detroit~south-bend', ends: ['detroit', 'south-bend'], box: { x: 606, y: 659 } },
    { id: 'detroit~toledo', ends: ['detroit', 'toledo'], box: { x: 706, y: 689.5 } },
    { id: 'elmira~scranton', ends: ['elmira', 'scranton'], box: { x: 1356, y: 705 } },
    { id: 'erie~pittsburgh', ends: ['erie', 'pittsburgh'], box: { x: 1010, y: 761 } },
    { id: 'evansville~louisville', ends: ['evansville', 'louisville'], box: { x: 410, y: 1145 } },
    { id: 'evansville~st-louis', ends: ['evansville', 'st-louis'], box: { x: 194, y: 1120 } },
    { id: 'evansville~terre-haute', ends: ['evansville', 'terre-haute'], box: { x: 324, y: 1075 } },
    {
        id: 'fort-wayne~indianapolis',
        ends: ['fort-wayne', 'indianapolis'],
        box: { x: 494, y: 877 }
    },
    { id: 'fort-wayne~lima', ends: ['fort-wayne', 'lima'], box: { x: 593, y: 802 } },
    { id: 'fort-wayne~toledo', ends: ['fort-wayne', 'toledo'], box: { x: 617, y: 753 } },
    {
        id: 'front-royal~martinsburg',
        ends: ['front-royal', 'martinsburg'],
        box: { x: 1186, y: 1026 }
    },
    { id: 'front-royal~staunton', ends: ['front-royal', 'staunton'], box: { x: 1122, y: 1119.5 } },
    { id: 'grand-rapids~lansing', ends: ['grand-rapids', 'lansing'], box: { x: 543, y: 575 } },
    {
        id: 'grand-rapids~resource-6',
        ends: ['grand-rapids', 'resource-6'],
        box: { x: 481, y: 493 }
    },
    {
        id: 'grand-rapids~resource-8',
        ends: ['grand-rapids', 'resource-8'],
        box: { x: 539, y: 502 }
    },
    {
        id: 'grand-rapids~south-bend',
        ends: ['grand-rapids', 'south-bend'],
        box: { x: 477, y: 624 }
    },
    { id: 'harrisburg~lock-haven', ends: ['harrisburg', 'lock-haven'], box: { x: 1297, y: 822 } },
    { id: 'harrisburg~martinsburg', ends: ['harrisburg', 'martinsburg'], box: { x: 1260, y: 936 } },
    {
        id: 'harrisburg~philadelphia',
        ends: ['harrisburg', 'philadelphia'],
        box: { x: 1391, y: 900 }
    },
    {
        id: 'indianapolis~louisville',
        ends: ['indianapolis', 'louisville'],
        box: { x: 470, y: 1044 }
    },
    {
        id: 'indianapolis~terre-haute',
        ends: ['indianapolis', 'terre-haute'],
        box: { x: 391, y: 969 }
    },
    { id: 'lansing~resource-10', ends: ['lansing', 'resource-10'], box: { x: 637, y: 561 } },
    { id: 'lexington~louisville', ends: ['lexington', 'louisville'], box: { x: 559, y: 1145 } },
    { id: 'lima~steubenville', ends: ['lima', 'steubenville'], box: { x: 767, y: 836 } },
    { id: 'lima~toledo', ends: ['lima', 'toledo'], box: { x: 669.5, y: 771 } },
    {
        id: 'lock-haven~philadelphia',
        ends: ['lock-haven', 'philadelphia'],
        box: { x: 1374, y: 836 }
    },
    {
        id: 'lock-haven~resource-12',
        ends: ['lock-haven', 'resource-12'],
        box: { x: 1326, y: 759.5 }
    },
    {
        id: 'lock-haven~resource-13',
        ends: ['lock-haven', 'resource-13'],
        box: { x: 1237.5, y: 763 }
    },
    { id: 'manchester~resource-5', ends: ['manchester', 'resource-5'], box: { x: 1753, y: 486 } },
    {
        id: 'manchester~springfield-e',
        ends: ['manchester', 'springfield-e'],
        box: { x: 1718, y: 592 }
    },
    {
        id: 'martinsburg~washington',
        ends: ['martinsburg', 'washington'],
        box: { x: 1255, y: 1021 }
    },
    { id: 'new-haven~new-york', ends: ['new-haven', 'new-york'], box: { x: 1624, y: 800 } },
    { id: 'new-haven~providence', ends: ['new-haven', 'providence'], box: { x: 1745, y: 732 } },
    {
        id: 'new-haven~springfield-e',
        ends: ['new-haven', 'springfield-e'],
        box: { x: 1688, y: 707 }
    },
    { id: 'new-york~philadelphia', ends: ['new-york', 'philadelphia'], box: { x: 1534, y: 880 } },
    { id: 'new-york~scranton', ends: ['new-york', 'scranton'], box: { x: 1489, y: 785 } },
    { id: 'philadelphia~scranton', ends: ['philadelphia', 'scranton'], box: { x: 1450, y: 832 } },
    {
        id: 'pittsburgh~steubenville',
        ends: ['pittsburgh', 'steubenville'],
        box: { x: 939, y: 855 }
    },
    { id: 'pittsburgh~wheeling', ends: ['pittsburgh', 'wheeling'], box: { x: 964, y: 894 } },
    { id: 'pittsburgh~youngstown', ends: ['pittsburgh', 'youngstown'], box: { x: 966, y: 805 } },
    { id: 'portland~resource-3', ends: ['portland', 'resource-3'], box: { x: 1837, y: 421 } },
    { id: 'resource-16~wheeling', ends: ['resource-16', 'wheeling'], box: { x: 884.5, y: 944 } },
    { id: 'resource-23~staunton', ends: ['resource-23', 'staunton'], box: { x: 1121, y: 1216 } },
    { id: 'resource-4~utica', ends: ['resource-4', 'utica'], box: { x: 1450, y: 486 } },
    { id: 'resource-7~utica', ends: ['resource-7', 'utica'], box: { x: 1403, y: 491 } },
    { id: 'richmond~staunton', ends: ['richmond', 'staunton'], box: { x: 1182, y: 1201 } },
    { id: 'richmond~washington', ends: ['richmond', 'washington'], box: { x: 1290, y: 1136 } },
    { id: 'rochester~syracuse', ends: ['rochester', 'syracuse'], box: { x: 1287, y: 535 } },
    { id: 'rutland~springfield-e', ends: ['rutland', 'springfield-e'], box: { x: 1674, y: 588 } },
    { id: 'south-bend~toledo', ends: ['south-bend', 'toledo'], box: { x: 589, y: 708 } },
    { id: 'springfield-w~st-louis', ends: ['springfield-w', 'st-louis'], box: { x: 86, y: 1003 } },
    { id: 'st-louis~terre-haute', ends: ['st-louis', 'terre-haute'], box: { x: 224, y: 1023 } },
    { id: 'syracuse~utica', ends: ['syracuse', 'utica'], box: { x: 1393, y: 542 } }
]

// The Canadian connections add nothing to a railroad's value.
export const EXTERNAL_CONNECTIONS: readonly ExternalConnectionDefinition[] = [
    {
        id: 'niagara',
        name: 'Niagara',
        settlementId: 'buffalo',
        price: 30,
        value: 0,
        x: 1010,
        y: 522
    },
    {
        id: 'windsor',
        name: 'Windsor',
        settlementId: 'detroit',
        price: 30,
        value: 0,
        x: 855.5,
        y: 595
    },
    {
        id: 'montreal',
        name: 'Montreal',
        settlementId: 'burlington',
        price: 30,
        value: 0,
        x: 1532,
        y: 340
    }
]
