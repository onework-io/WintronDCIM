import ezdxf,json,collections
D=ezdxf.readfile('/Users/yuhueisheng/Downloads/緯創樓_115.09.02 B1F-R1F建築底圖_6087.dxf')
for f,n in [(2,'2F建築底圖-0602'),(3,'3F建築底圖-0603')]:
 arr=[]
 for e in D.blocks[n].query('POLYLINE LWPOLYLINE'):
  pts=list(e.points()) if e.dxftype()=='POLYLINE' else [tuple(p[:2]) for p in e.get_points()]
  xs=[p[0] for p in pts];ys=[p[1] for p in pts]
  if not xs:continue
  w=max(xs)-min(xs);h=max(ys)-min(ys)
  closed=e.is_closed if e.dxftype()=='POLYLINE' else e.closed
  if closed and max(w,h)>50 and min(w,h)<100:arr.append({'pts':[list(p)[:2] for p in pts],'bounds':[min(xs),min(ys),w,h]})
 print(f,len(arr));print([a['bounds'] for a in arr][:70]);json.dump(arr,open(f'output/{f}F_wall_polys.json','w'))
