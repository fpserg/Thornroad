"""Usage: python3 build_cyrillic_font.py jacquarda-bastarda-9-latin.woff2 ../thornroad-bastarda.woff2

Build fonts/thornroad-bastarda.woff2: Jacquarda Bastarda 9 (OFL) extended
with Cyrillic, so Russian headings keep the pixel-blackletter look.

Letters whose shapes match Latin reuse the original glyphs as components;
the rest are drawn below on the font's own pixel grid (1 px = 80 units,
cap height 9 px, x-height 6 px, descender 3 px).

Grid notation: '#' = pixel. Rows run top to bottom. `top` is the grid row
(in pixels above the baseline, minus one) of the first row: caps start at 8,
lowercase at 5, ascenders/accents above that, descenders below 0.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables._g_l_y_f import GlyphComponent

SRC = sys.argv[1]
OUT = sys.argv[2]
U = 80

# Cyrillic letter -> Latin glyph it can borrow outright.
BORROW = {
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P',
    'С': 'C', 'Т': 'T', 'Х': 'X', 'У': 'Y', 'Ё': 'Ë',
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
    'и': 'u', 'п': 'n', 'ё': 'ë',
}

# Hand-drawn glyphs: (top_row, rows). Blank columns are added on both sides.
CAP, LOW = 8, 5
DRAWN = {
    'Б': (CAP, ['.#######', '#.#.....', '..#.....', '..#.###.', '..##...#', '..#....#', '..#....#', '.##...#.', '#.#####.']),
    'Г': (CAP, ['.#######', '#.#.....', '..#.....', '..#.....', '..#.....', '..#.....', '..#.....', '.##.....', '#.##....']),
    'Д': (CAP, ['...#####.', '..#...#..', '..#...#..', '..#...#..', '.#....#..', '.#....#..', '.#....#..', '#########', '#.......#', '#.......#']),
    'Ж': (CAP, ['#...#...#', '.#..#..#.', '..#.#.#..', '...###...', '..#.#.#..', '.#..#..#.', '.#..#..#.', '#...#...#', '#..###..#']),
    'З': (CAP, ['.####.', '#....#', '.....#', '....#.', '..##..', '....#.', '.....#', '#....#', '.####.']),
    'И': (CAP, ['##....##', '#.#...#.', '..#..##.', '..#..##.', '..#.#.#.', '..#.#.#.', '..##..#.', '..##..#.', '.#....##']),
    'Й': (10, ['..#..#..', '...##...', '##....##', '#.#...#.', '..#..##.', '..#..##.', '..#.#.#.', '..#.#.#.', '..##..#.', '..##..#.', '.#....##']),
    'Л': (CAP, ['...#####', '..#...#.', '..#...#.', '..#...#.', '..#...#.', '.#....#.', '.#....#.', '#.....#.', '#.....##']),
    'П': (CAP, ['########', '#.#...#.', '..#...#.', '..#...#.', '..#...#.', '..#...#.', '..#...#.', '.##...#.', '#.#...##']),
    'Ф': (CAP, ['....#....', '..#####..', '.#..#..#.', '#...#...#', '#...#...#', '.#..#..#.', '..#####..', '....#....', '...###...']),
    'Ц': (CAP, ['##...##.', '.#...#..', '.#...#..', '.#...#..', '.#...#..', '.#...#..', '.#...#..', '.#...#..', '..######', '.......#', '......##']),
    'Ч': (CAP, ['##....##', '.#....#.', '.#....#.', '.#....#.', '..####..', '......#.', '......#.', '......#.', '.....###']),
    'Ш': (CAP, ['##..##..##', '.#...#...#', '.#...#...#', '.#...#...#', '.#...#...#', '.#...#...#', '.#...#...#', '.#...#...#', '..###.###.']),
    'Щ': (CAP, ['##..##..##.', '.#...#...#.', '.#...#...#.', '.#...#...#.', '.#...#...#.', '.#...#...#.', '.#...#...#.', '.#...#...#.', '..###.#####', '..........#', '.........##']),
    'Ъ': (CAP, ['###.....', '..#.....', '..#.....', '..####..', '..#...#.', '..#....#', '..#....#', '..#...#.', '.#####..']),
    'Ы': (CAP, ['##.....##', '.#......#', '.#......#', '.####...#', '.#...#..#', '.#....#.#', '.#....#.#', '.#...#..#', '####...##']),
    'Ь': (CAP, ['##......', '.#......', '.#......', '.####...', '.#...#..', '.#....#.', '.#....#.', '.#...#..', '#####...']),
    'Э': (CAP, ['.####..', '#....#.', '......#', '......#', '..#####', '......#', '......#', '#....#.', '.####..']),
    'Ю': (CAP, ['##....###.', '.#...#...#', '.#..#....#', '.####....#', '.#..#....#', '.#..#....#', '.#..#....#', '.#...#...#', '##....###.']),
    'Я': (CAP, ['..######', '.#....#.', '.#....#.', '.#....#.', '..#####.', '...#..#.', '..#...#.', '.#....#.', '#....###']),

    # lowercase: textura-style stems — a hairline flick in at the top-left,
    # a split foot at the baseline — to match the Latin lowercase.
    'б': (8, ['....###', '..##...', '.#.....', '.#.##..', '.##..#.', '.#...#.', '.#...#.', '.#...#.', '..###..']),
    'в': (LOW, ['#.##.', '.#..#', '.###.', '.#..#', '.#..#', '#.##.']),
    'г': (LOW, ['#.###', '.#...', '.#...', '.#...', '.#...', '#.#..']),
    'д': (LOW, ['..###.', '.#..#.', '.#..#.', '.#..#.', '.#..#.', '######', '#....#']),
    'ж': (LOW, ['#..#..#', '.#.#.#.', '..###..', '..###..', '.#.#.#.', '#.#.#.#']),
    'з': (LOW, ['.###.', '#...#', '..##.', '....#', '#...#', '.###.']),
    'й': (7, ['.#..#.', '..##..', '.#..#.#', '#.#..#.', '..#..#.', '..#..#.', '..#..#.', '...##.#']),
    'к': (LOW, ['#...#', '.#.#.', '.##..', '.#.#.', '.#..#', '#.#..#']),
    'л': (LOW, ['..###', '.#..#', '.#..#', '.#..#', '.#..#', '#..#.#']),
    'м': (LOW, ['#.....#', '.##.##.', '.#.#.#.', '.#...#.', '.#...#.', '#.#.#.#']),
    'н': (LOW, ['#...#..', '.#...#.', '.#####.', '.#...#.', '.#...#.', '#.#.#.#']),
    'т': (LOW, ['#.###.#', '...#...', '...#...', '...#...', '...#...', '..#.#..']),
    'ф': (7, ['...#...', '...#...', '.#####.', '#..#..#', '#..#..#', '#..#..#', '.#####.', '...#...', '...#...', '..#.#..']),
    'ц': (LOW, ['#...#..', '.#...#.', '.#...#.', '.#...#.', '.#...#.', '..#####', '......#']),
    'ч': (LOW, ['#...#..', '.#...#.', '.#...#.', '..####.', '.....#.', '....#.#']),
    'ш': (LOW, ['#..#..#..', '.#..#..#.', '.#..#..#.', '.#..#..#.', '.#..#..#.', '..##.##.#']),
    'щ': (LOW, ['#..#..#..', '.#..#..#.', '.#..#..#.', '.#..#..#.', '.#..#..#.', '..#######', '........#']),
    'ъ': (LOW, ['##....', '..#...', '..###.', '..#..#', '..#..#', '.#.##.']),
    'ы': (LOW, ['#....#.', '.#....#', '.###..#', '.#..#.#', '.#..#.#', '#.##.#.']),
    'ь': (LOW, ['#....', '.#...', '.###.', '.#..#', '.#..#', '#.##.']),
    'э': (LOW, ['.###.', '#...#', '..###', '....#', '#...#', '.###.']),
    'ю': (LOW, ['#..##.', '.#.#..#', '.###..#', '.#.#..#', '.#.#..#', '#...##.']),
    'я': (LOW, ['.####.', '#...#.', '#...#.', '.####.', '..#.#.', '.#.#.#']),
}


def draw_pixels(top, rows):
    pen = TTGlyphPen(None)
    width = max(len(r) for r in rows)
    for i, row in enumerate(rows):
        gy = top - i
        x = 0
        while x < len(row):
            if row[x] != '#':
                x += 1
                continue
            start = x
            while x < len(row) and row[x] == '#':
                x += 1
            x0, x1 = (start + 1) * U, (x + 1) * U  # +1 = left side bearing
            y0, y1 = gy * U, (gy + 1) * U
            pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    return pen.glyph(), (width + 2) * U


def main():
    font = TTFont(SRC)
    glyf, hmtx = font['glyf'], font['hmtx']
    cmap = font.getBestCmap()
    order = list(font.getGlyphOrder())
    new = {}

    for ch, (top, rows) in DRAWN.items():
        name = 'uni%04X' % ord(ch)
        g, adv = draw_pixels(top, rows)
        glyf[name] = g
        hmtx[name] = (adv, g.xMin if hasattr(g, 'xMin') else 0)
        new[ord(ch)] = name
        order.append(name)

    for ch, latin in BORROW.items():
        name = 'uni%04X' % ord(ch)
        src = cmap[ord(latin)]
        pen = TTGlyphPen(font.getGlyphSet())
        pen.addComponent(src, (1, 0, 0, 1, 0, 0))
        g = pen.glyph()
        glyf[name] = g
        hmtx[name] = hmtx[src]
        new[ord(ch)] = name
        order.append(name)

    font.setGlyphOrder(order)
    for table in font['cmap'].tables:
        if table.isUnicode():
            table.cmap.update(new)

    for g in new.values():
        glyf[g].recalcBounds(glyf)
        adv, _ = hmtx[g]
        hmtx[g] = (adv, getattr(glyf[g], 'xMin', 0))
    font['maxp'].numGlyphs = len(order)

    # A modified OFL font must not use the original's name.
    name = font['name']
    for rec in name.names:
        if rec.nameID in (1, 4, 16):
            rec.string = 'Thornroad Bastarda'
        elif rec.nameID == 6:
            rec.string = 'ThornroadBastarda-Regular'
        elif rec.nameID == 3:
            rec.string = 'ThornroadBastarda-Regular;Jacquarda Bastarda 9 + Cyrillic'
    font.flavor = 'woff2'
    font.save(OUT)
    print('added', len(new), 'glyphs ->', OUT)


if __name__ == '__main__':
    main()
