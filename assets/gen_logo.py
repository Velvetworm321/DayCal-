"""
DayCal logo generator - run by CI to produce icon.ico and logo64.png
"""
from PIL import Image, ImageDraw
import os, sys

OUT = os.path.join(os.path.dirname(__file__))

def make_logo(size):
    s = size
    img = Image.new('RGBA', (s, s), (0,0,0,0))

    # Gradient BG (coral-pink)
    bg = Image.new('RGBA', (s, s), (0,0,0,0))
    bd = ImageDraw.Draw(bg)
    for i in range(s):
        t = i / s
        bd.line([(0,i),(s,i)], fill=(255, int(143-t*22), int(171-t*22), 255))
    mask = Image.new('L', (s,s), 0)
    dm = ImageDraw.Draw(mask)
    dm.rounded_rectangle([0,0,s-1,s-1], radius=int(s*0.22), fill=255)
    bg.putalpha(mask)
    img = Image.alpha_composite(img, bg)

    # White card
    cx, cy = s/2, s/2 + s*0.04
    cw, ch = s*0.56, s*0.50
    card_x = cx - cw/2; card_y = cy - ch/2
    cr2 = int(s*0.07)
    card = Image.new('RGBA',(s,s),(0,0,0,0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle([card_x,card_y,card_x+cw,card_y+ch], radius=cr2, fill=(255,255,255,230))
    img = Image.alpha_composite(img, card)

    # Pink header bar
    hh = ch*0.28
    header = Image.new('RGBA',(s,s),(0,0,0,0))
    hd = ImageDraw.Draw(header)
    hd.rounded_rectangle([card_x,card_y,card_x+cw,card_y+hh], radius=cr2, fill=(255,107,157,255))
    hd.rectangle([card_x,card_y+hh*0.5,card_x+cw,card_y+hh], fill=(255,107,157,255))
    img = Image.alpha_composite(img, header)
    d = ImageDraw.Draw(img)

    # Ring pegs
    peg_y = card_y - s*0.03
    pr = s*0.038
    for px in [cx-cw*0.22, cx+cw*0.22]:
        d.ellipse([px-pr,peg_y-pr,px+pr,peg_y+pr], fill=(220,70,110,255))
        d.ellipse([px-pr*0.5,peg_y-pr*0.5,px+pr*0.5,peg_y+pr*0.5], fill=(255,255,255,255))

    # Dot grid (calendar days)
    dr = max(2, int(s*0.028))
    colors = [(255,107,157,210),(255,190,70,220),(100,195,130,210),(180,140,230,210)]
    gx = card_x + cw*0.14; gy = card_y + hh + ch*0.16
    gw_g = cw*0.72; gh_g = ch*0.56
    cols, rows = 4, 2
    for row in range(rows):
        for col in range(cols):
            dx = gx + col*(gw_g/(cols-1))
            dy = gy + row*(gh_g/(rows-1))
            if row==0 and col==2:  # today
                d.ellipse([dx-dr*1.6,dy-dr*1.6,dx+dr*1.6,dy+dr*1.6], fill=(255,107,157,255))
                d.ellipse([dx-dr*0.7,dy-dr*0.7,dx+dr*0.7,dy+dr*0.7], fill=(255,255,255,255))
            else:
                c = colors[(row*cols+col)%4]
                d.ellipse([dx-dr,dy-dr,dx+dr,dy+dr], fill=c)
    return img

if __name__ == '__main__':
    print("Generating DayCal icons...")
    imgs = {s: make_logo(s) for s in [16,32,48,64,128,256,512]}
    imgs[256].save(os.path.join(OUT, 'logo.png'))
    imgs[64].save(os.path.join(OUT, 'logo64.png'))
    imgs[256].save(os.path.join(OUT, 'icon.ico'), format='ICO',
                   sizes=[(16,16),(32,32),(48,48),(256,256)])
    print("Done:", [f for f in os.listdir(OUT) if f.endswith(('.png','.ico'))])
