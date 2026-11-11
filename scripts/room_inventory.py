import ezdxf,json,functools,re
D=ezdxf.readfile('/Users/yuhueisheng/Downloads/緯創樓_115.09.02 B1F-R1F建築底圖_6087.dxf')
@functools.lru_cache(None)
def txts(name):
 arr=[]
 for e in D.blocks[name]:
  if e.dxftype() in ('MTEXT','TEXT','ATTRIB'):
   t=e.plain_text() if e.dxftype()=='MTEXT' else e.dxf.text
   if any('\u4e00'<=c<='\u9fff' for c in t):arr.append((t,tuple(e.dxf.insert)))
  elif e.dxftype()=='INSERT':
   mx=e.matrix44()
   for t,p in txts(e.dxf.name):arr.append((t,tuple(mx.transform(p))))
   for a in e.attribs:arr.append((a.dxf.text,tuple(a.dxf.insert)))
 return tuple(arr)
out={}
for e in D.modelspace().query('INSERT'):
 n=e.dxf.name
 if re.match(r'^(B1F|1F|2F|3F|4F|5F|R1F)建築底圖-',n) or n=='R1F建築底圖1150401':
  if '噴灌' in n:continue
  a=list(dict.fromkeys(txts(n)));out[n]=a;print('\nFLOOR',n)
  for t,p in a:
   if any(k in t for k in ['機房','電氣','弱電','中控','電信','資訊','發電','變電','配電','消防','泵','水箱','水池','空調','冰水','儲','電腦']):print(t,tuple(round(x,1) for x in p))
json.dump(out,open('output/all_floor_room_inventory.json','w'),ensure_ascii=False,indent=2)
