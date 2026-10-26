"""Generate Krypto's original branded social card (no network dependencies)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
S = 2
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/assets/social-preview.png'
FONT = Path('/System/Library/Fonts/Supplemental')
def font(name, size):
    return ImageFont.truetype(str(FONT / name), size*S)
def box(draw, rect, fill, radius=0, outline=None, width=1):
    draw.rounded_rectangle(tuple(int(x*S) for x in rect), radius=radius*S, fill=fill, outline=outline, width=width*S)
def text(draw, xy, label, face, fill, **kw):
    draw.text((xy[0]*S, xy[1]*S), label, font=face, fill=fill, **kw)
img=Image.new('RGB',(1200*S,630*S),'#f5f2e9');d=ImageDraw.Draw(img)
box(d,(20,20,1180,610),'#173f33',26)
box(d,(29,29,1171,601),None,20,'#46634c')
for x,y,symbol in [(105,167,'+'),(1060,110,'÷'),(980,487,'×'),(69,465,'−'),(570,85,'×'),(1120,380,'+')]:
    text(d,(x,y),symbol,font('Arial.ttf',48),'#355b45')
text(d,(66,42),'krypto!',font('Arial Bold.ttf',40),'#f5f2e9')
text(d,(784,61),'GOOD COMPANY. BRIGHT IDEAS.',font('Arial.ttf',15),'#c7da80')
text(d,(65,110),'Five cards. One target.',font('Arial Bold.ttf',68),'#f5f2e9')
text(d,(69,200),'Who will shout Krypto! first?',font('Georgia Italic.ttf',30),'#c7da80')
start=130;top=294;width=125;height=180;gap=25
for i,n in enumerate([5,19,8,3,6,12]):
    x=start+i*(width+gap)+(49 if i==5 else 0)
    if i==5:
        text(d,(x-48,top+61),'=',font('Arial.ttf',40),'#c7da80')
    box(d,(x+1,top+5,x+width+1,top+height+5),'#0c3025',10)
    box(d,(x,top,x+width,top+height),'#e89857' if i==5 else '#f5efdc',10)
    text(d,(x+12,top+10),str(n),font('Arial.ttf',15),'#203b32')
    f=font('Arial Bold.ttf',61);bounds=d.textbbox((0,0),str(n),font=f)
    w=bounds[2]-bounds[0]
    text(d,(x+(width-w/S)/2,top+52),str(n),f,'#203b32')
    text(d,(x+width-25,top+height-29),str(n),font('Arial.ttf',14),'#203b32')
text(d,(start+1,269),'YOUR FIVE CARDS',font('Arial.ttf',12),'#a9bbaa')
text(d,(start+5*(width+gap)+49,269),'THE TARGET',font('Arial.ttf',12),'#a9bbaa')
text(d,(69,531),'A little arithmetic. A lot of possibility.',font('Georgia.ttf',26),'#f5f2e9')
box(d,(918,519,1117,572),'#c7da80',25)
text(d,(945,532),'LET’S PLAY  →',font('Arial Bold.ttf',19),'#203b32')
OUT.parent.mkdir(parents=True,exist_ok=True)
img.resize((1200,630),Image.Resampling.LANCZOS).save(OUT,optimize=True)
print(OUT)
