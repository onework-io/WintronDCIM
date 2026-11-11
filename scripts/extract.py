exec(open('scripts/inspect_dxf.py').read().split("print('UNITS'")[0])
from ezdxf.disassemble import recursive_decompose
from ezdxf import path
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection

for b in d.blocks:
 for e in list(b):
  if e.dxftype()=='MULTILEADER': b.delete_entity(e)
def dec(es):
 for e in es:
  if e.dxftype()=='INSERT':
   yield from dec(e.virtual_entities())
  elif e.dxftype() in ('LINE','LWPOLYLINE','POLYLINE','ARC','CIRCLE','TEXT','MTEXT','ELLIPSE'):yield e
ents=list(dec([e for e in m.query('INSERT') if e.dxf.name.startswith(('2F建築','3F建築'))])); print('COUNT',len(ents)); print(collections.Counter(e.dxf.layer for e in ents))
lines=[]; texts=[]; seen=set()
for e in ents:
 if e.dxftype() in ('TEXT','MTEXT'):
  t=e.dxf.text if e.dxftype()=='TEXT' else e.plain_text(); texts.append([t,list(e.dxf.insert),e.dxf.layer])
 try:
  pts=[list(v) for v in path.make_path(e).flattening(5)]
  if len(pts)>1:
   key=tuple(tuple(round(c,2) for c in p) for p in pts)
   if key not in seen:
    seen.add(key);lines.append({'layer':e.dxf.layer,'pts':pts,'type':e.dxftype()})
 except:pass
json.dump({'lines':lines,'texts':texts},open('output/dxf_geometry.json','w'),ensure_ascii=False)
print('TEXTS')
for t,p,l in texts:
 if any(s in t for s in ['2F','3F','機房','機櫃','平面','UPS']):print(t,p)
fig,ax=plt.subplots(figsize=(18,18));ax.add_collection(LineCollection([[p[:2] for p in l['pts']] for l in lines],linewidths=.3));ax.autoscale();ax.set_aspect('equal');plt.savefig('output/previews/dxf_all.png',dpi=140)
