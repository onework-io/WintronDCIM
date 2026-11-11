import ezdxf,json
from ezdxf import path
import matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
D=ezdxf.readfile('/Users/yuhueisheng/Downloads/緯創樓_115.09.02 B1F-R1F建築底圖_6087.dxf')
for f,n in [(2,'2F建築底圖-0602'),(3,'3F建築底圖-0603')]:
 lines=[];txt=[]
 for e in D.blocks[n]:
  if e.dxftype()=='MTEXT':txt.append([e.plain_text(),list(e.dxf.insert)])
  try:
   pts=[list(v) for v in path.make_path(e).flattening(3)]
   if len(pts)>1:lines.append(pts)
  except:pass
 fig,ax=plt.subplots(figsize=(13,16));ax.add_collection(LineCollection([[p[:2] for p in l] for l in lines],linewidths=.5,color='#25394a'));ax.set_xlim(-5000,2500);ax.set_ylim(-7000,2000);ax.set_aspect('equal');ax.grid(alpha=.2);plt.savefig(f'output/previews/{f}F_base.png',dpi=140)
 json.dump({'lines':lines,'texts':txt},open(f'output/{f}F_base.json','w'),ensure_ascii=False)
