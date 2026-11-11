import ezdxf,collections,json
p='/Users/yuhueisheng/Downloads/緯創樓_115.09.02 B1F-R1F建築底圖_6087.dxf'
d=ezdxf.readfile(p); m=d.modelspace()
print('UNITS',d.units,'entities',len(m)); print(collections.Counter(e.dxftype() for e in m)); print('LAYERS',collections.Counter(e.dxf.layer for e in m))
texts=[]
for e in m:
 if e.dxftype() in ('TEXT','MTEXT'):
  t=e.dxf.text if e.dxftype()=='TEXT' else e.plain_text()
  texts.append([t,list(e.dxf.insert),e.dxf.layer])
json.dump(texts,open('output/dxf_texts.json','w'),ensure_ascii=False,indent=2)
for t,p,l in texts:
 if any(s in t for s in ['2F','3F','二層','三層','二樓','三樓','機房','機櫃']): print(repr(t),p,l)
