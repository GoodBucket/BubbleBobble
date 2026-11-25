// Original level layouts for Fizz & Fern.
// Grid is 32 columns x 24 rows of 16px tiles.
//   '#' solid wall (blocks from every side)
//   '=' one-way ledge (you can jump up through it and land on top)
//   '.' empty air
// Falling through the gap in the floor wraps you around to the gap in the ceiling.

export const TILE = 16;
export const COLS = 32;
export const ROWS = 24;

const EDGE = '##############....##############';
const AIR = '#..............................#';
const PILLARS = '#.......#..............#.......#';

export const LEVELS = [
  {
    name: 'Lily Ledges',
    palette: { bg1: '#141a3a', bg2: '#25305e', wall: '#3fb08f', wallDark: '#1f6e5a', ledge: '#7fe0b8' },
    map: [
      EDGE, AIR, AIR, AIR,
      '#..========..........========..#',
      AIR, AIR, AIR,
      '#......==================......#',
      AIR, AIR, AIR,
      '#===========........===========#',
      AIR, AIR, AIR,
      '#......==================......#',
      AIR, AIR, AIR,
      '#===========........===========#',
      AIR, AIR,
      EDGE,
    ],
    enemies: [
      ['clank', 8, 3], ['clank', 23, 3], ['clank', 12, 7], ['clank', 19, 7], ['clank', 4, 11], ['clank', 27, 11],
    ],
  },
  {
    name: 'Trellis',
    palette: { bg1: '#2a1236', bg2: '#4a2160', wall: '#e0779b', wallDark: '#9c3e62', ledge: '#ffc1d6' },
    map: [
      EDGE, AIR, AIR, AIR,
      '#.......====........====.......#',
      AIR, AIR, AIR,
      '#==........==========........==#',
      AIR, AIR, AIR,
      '#.....======........======.....#',
      AIR, AIR, AIR,
      '#==......====......====......==#',
      AIR, AIR, AIR,
      '#.......================.......#',
      AIR, AIR,
      EDGE,
    ],
    enemies: [
      ['clank', 9, 3], ['clank', 22, 3], ['clank', 14, 7], ['clank', 17, 7], ['wisp', 6, 10], ['wisp', 25, 10],
    ],
  },
  {
    name: 'Zigzag Kiln',
    palette: { bg1: '#2b1a0f', bg2: '#4d2f18', wall: '#f0a347', wallDark: '#a3621d', ledge: '#ffd79a' },
    map: [
      EDGE, AIR, AIR, AIR,
      '#...======.............======..#',
      AIR, AIR, AIR,
      '#.........======....======.....#',
      AIR, AIR, AIR,
      '#....======.........======.....#',
      AIR, AIR, AIR,
      '#.........======....======.....#',
      AIR, AIR, AIR,
      '#...======............=======..#',
      AIR, AIR,
      EDGE,
    ],
    enemies: [
      ['clank', 6, 3], ['clank', 25, 3], ['clank', 12, 7], ['clank', 22, 7], ['wisp', 15, 10], ['wisp', 8, 14],
    ],
  },
  {
    name: 'Reed Columns',
    palette: { bg1: '#0c2330', bg2: '#16425a', wall: '#5fc4e8', wallDark: '#2b7ea0', ledge: '#b8ecff' },
    map: [
      EDGE, AIR, AIR, AIR,
      '#..========......========......#',
      AIR, AIR, AIR,
      '#...======..========..======...#',
      PILLARS, PILLARS, PILLARS,
      '#..====.#....========..#.====..#',
      PILLARS, PILLARS, PILLARS,
      '#...====#....======....#====...#',
      PILLARS, PILLARS, PILLARS,
      '#..===..#======..======#..===..#',
      AIR, AIR,
      EDGE,
    ],
    enemies: [
      ['clank', 5, 7], ['clank', 15, 7], ['clank', 25, 7], ['clank', 15, 11], ['wisp', 4, 14], ['wisp', 27, 14],
    ],
  },
  {
    name: 'Moonlit Crown',
    palette: { bg1: '#0d0d24', bg2: '#22224a', wall: '#b39cff', wallDark: '#6a54c4', ledge: '#e2d8ff' },
    map: [
      EDGE, AIR, AIR, AIR,
      '#.............====.............#',
      AIR, AIR, AIR,
      '#....========......========....#',
      AIR, AIR, AIR,
      '#========..............========#',
      AIR, AIR, AIR,
      '#.....====....====....====.....#',
      AIR, AIR, AIR,
      '#=====......========......=====#',
      AIR, AIR,
      EDGE,
    ],
    enemies: [
      ['clank', 15, 3], ['clank', 8, 7], ['clank', 23, 7], ['clank', 4, 11], ['wisp', 8, 5], ['wisp', 23, 5], ['wisp', 15, 9],
    ],
  },
];

export const PLAYER_SPAWNS = [
  { x: 2 * TILE, y: 22 * TILE },
  { x: 29 * TILE - 2, y: 22 * TILE },
];
