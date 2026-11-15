/**
 * The little bubbles over a building that has a problem (see `buildingIssues`). They are drawn pixel by pixel,
 * like the buildings: a speech bubble of paper with a dark edge and a tail, and inside it a small picture of
 * the trouble in the colours of the rest of the game.
 */
import type { Issue } from '../sim/warnings';

/** Width and height of a bubble in pixels, tail included. */
export const BUBBLE_W = 13;
export const BUBBLE_H = 15;

/** The bubble itself: `k` is the edge, `p` the paper (tinted per issue). Rows 2 to 10 are the room for the picture. */
const BODY = [
  '..kkkkkkkkk..',
  '.kpppppppppk.',
  'kpppppppppppk',
  'kpppppppppppk',
  'kpppppppppppk',
  'kpppppppppppk',
  'kpppppppppppk',
  'kpppppppppppk',
  'kpppppppppppk',
  'kpppppppppppk',
  'kpppppppppppk',
  '.kpppppppppk.',
  '..kkkkpkkkk..',
  '.....kpk.....',
  '......k......',
];

/** The pictures, 9×9, to go at column 2, row 2 of the body. `.` is empty. */
const ICONS: Record<Issue, string[]> = {
  // A street under a prohibition sign: the red circle crossed by its red bar. No street reaches the building.
  road: ['..rrrrr..', '.rwwowwr.', 'rwrooowwr', 'rwwryowwr', 'rwooroowr', 'rwooyrowr', 'rwoooorwr', '.rwwwwwr.', '..rrrrr..'],
  // A traffic light with every lamp on: the street is full.
  jam: ['..ooooo..', '..orrro..', '..orrro..', '..oyyyo..', '..oyyyo..', '..onnno..', '..onnno..', '..ooooo..', '....o....'],
  // Three books piled up: no school near.
  school: ['.ooooooo.', '.ouuuuwo.', '.ooooooo.', 'oooooooo.', 'orrrrrwo.', 'oooooooo.', '.oooooooo', '.onnnnnwo', '.oooooooo'],
  // A house with a red cross over it: nobody lives or works there any more.
  empty: ['....o....', '...ogo...', '..ogggo..', '.ogggggo.', 'ogrgggrgo', 'ogggrgggo', 'ogrgggrgo', 'ogggggggo', 'ooooooooo'],
  // A bare, dry sapling: the plaza is not kept.
  dry: ['.y..t..y.', '..y.t.y..', '...ttt...', '.y..t....', '....t.y..', '...tt....', '....t....', '...ttt...', '.........'],
  // A lightning bolt, yellow with a dark orange edge.
  power: ['....oo...', '...oyyo..', '..oyyo...', '.oyyyyyo.', '.ooyyyyo.', '...oyyo..', '...oyo...', '..oyo....', '..oo.....'],
  // A head in a balaclava: black wool and a strip of skin with the eyes.
  crime: ['..bbbbb..', '.bbbbbbb.', '.bfffffb.', '.bfkfkfb.', '.bfffffb.', '.bbbbbbb.', '..bbbbb..', '.bbbbbbb.', 'bbbbbbbbb'],
  // A red cross with a dark red edge.
  health: ['...ddd...', '...drd...', '...drd...', 'ddddrdddd', 'drrrrrrrd', 'ddddrdddd', '...drd...', '...drd...', '...ddd...'],
  // A puff of smoke, light on top and grey underneath.
  smoke: ['....ooo..', '...owwwo.', '.ooowwwwo', 'owwwwwwwo', 'owwwwwggo', 'owwwggggo', '.ogggggo.', '..ooooo..', '.........'],
};

const COLORS: Record<string, string> = {
  k: '#2b1d12',
  o: '#3d3a40',
  y: '#f2c230',
  b: '#17161c',
  f: '#e8c9a0',
  r: '#d23a32',
  d: '#7a1d17',
  w: '#e9e9ee',
  g: '#8d919a',
  c: '#ee7a20',
  s: '#b85410',
  u: '#2f63a6',
  n: '#3fa65b',
  t: '#6b4a2a',
};

/** The paper of each bubble: a little warmer for the dark, a little bluer for the crime. */
const PAPER: Record<Issue, string> = {
  power: '#f6dc9a',
  road: '#f3dcb8',
  jam: '#efd0d0',
  school: '#d5e0f2',
  empty: '#dcd8d2',
  dry: '#e7e0b8',
  crime: '#c9cde0',
  health: '#f4f0e6',
  smoke: '#d6d9de',
};

const sprites = new Map<Issue, HTMLCanvasElement>();

/** The bubble of an issue as a picture, drawn once. */
function spriteOf(issue: Issue): HTMLCanvasElement {
  let c = sprites.get(issue);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = BUBBLE_W;
  c.height = BUBBLE_H;
  const g = c.getContext('2d')!;
  BODY.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      g.fillStyle = row[x] === 'p' ? PAPER[issue] : COLORS.k;
      g.fillRect(x, y, 1, 1);
    }
  });
  ICONS[issue].forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      g.fillStyle = COLORS[row[x]];
      g.fillRect(2 + x, 2 + y, 1, 1);
    }
  });
  sprites.set(issue, c);
  return c;
}

/** The bubble as a data URL, for the card that explains it (shown enlarged without smoothing). */
export function bubbleIcon(issue: Issue): string {
  return spriteOf(issue).toDataURL();
}

/** Draws the bubble of `issue` with its middle on (cx, cy), in whole pixels so the edges stay sharp at any zoom. */
export function drawBubble(g: CanvasRenderingContext2D, issue: Issue, cx: number, cy: number): void {
  const smoothing = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(spriteOf(issue), Math.round(cx) - 6, Math.round(cy) - 7);
  g.imageSmoothingEnabled = smoothing;
}
