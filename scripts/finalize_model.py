import bpy,os,json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));O=os.path.join(ROOT,'output')
bpy.ops.wm.open_mainfile(filepath=os.path.join(O,'AIDC_2F_3F.blend'))
for s in bpy.data.scenes:
 h=next(o for o in s.objects if o.type=='CAMERA' and o.name.startswith('03 |'))
 h.location=(-35,-17,18);h.rotation_euler=(Vector((-17,0,.8))-h.location).to_track_quat('-Z','Y').to_euler();h.data.lens=32
 s['Fitout_approval']='PROPOSAL ONLY: actual server-room boundaries not supplied in DXF.'
 for c in s.collection.children:
  if any(key in c.name for key in ['10 |','11 |','12 |']):c['Status']='Proposed fitout from visual references; not present in architectural DXF.'
 s.camera=next(o for o in s.objects if o.type=='CAMERA' and o.name.startswith('01 |'))
# Embed usage and assumptions inside .blend.
t=bpy.data.texts.new('READ ME - 模型說明');t.write(open(os.path.join(O,'模型說明.txt')).read())
bpy.context.window.scene=bpy.data.scenes['2F | Data Centre']
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(O,'AIDC_2F_3F.blend'))
checks=[]
for s in bpy.data.scenes:
 bpy.context.window.scene=s;f=s.name[:2]
 racks=[o for o in s.objects if o.instance_type=='COLLECTION' and o.instance_collection and o.instance_collection.name.startswith('ASSET')]
 assert len(racks)==84
 assert all(all(v>0 for v in o.scale) for o in s.objects if o.type=='MESH')
 checks.append({'scene':s.name,'racks':len(racks),'cameras':len([o for o in s.objects if o.type=='CAMERA']),'cad_reference_present':any('CAD source' in c.name for c in s.collection.children)})
 for prefix,suffix in [('03 |','hall'),('04 |','aisle')]:
  s.camera=next(o for o in s.objects if o.type=='CAMERA' and o.name.startswith(prefix));s.render.resolution_x=1400;s.render.resolution_y=1000;s.cycles.samples=32;s.render.filepath=os.path.join(O,'previews',f+'_'+suffix+'.png');bpy.ops.render.render(write_still=True)
json.dump(checks,open(os.path.join(O,'validation.json'),'w'),indent=2)
print('VALIDATED',checks)
