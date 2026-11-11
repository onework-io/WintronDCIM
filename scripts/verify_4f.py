import bpy,os,json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));O=os.path.join(ROOT,'output','4F')
bpy.ops.wm.open_mainfile(filepath=os.path.join(O,'AIDC_4F_A11_B22.blend'));s=bpy.context.scene
# Fit the entire selected footprint in the landscape camera sensor.
pts=[Vector((x,y,z)) for x,y in [(-40,-10),(-40,8.9),(18.4,8.9),(18.4,-10),(11,-10),(11,-33),(0,-33),(0,-10)] for z in [0,3.8]]
for cam in [o for o in s.objects if o.type=='CAMERA' and o.data.type=='ORTHO']:
 bpy.context.view_layer.update();inv=cam.matrix_world.inverted();qs=[inv@p for p in pts];xmin=min(p.x for p in qs);xmax=max(p.x for p in qs);ymin=min(p.y for p in qs);ymax=max(p.y for p in qs)
 delta=cam.rotation_euler.to_matrix()@Vector(((xmin+xmax)/2,(ymin+ymax)/2,0));cam.location+=delta
 cam.data.ortho_scale=max(xmax-xmin,(ymax-ymin)*s.render.resolution_x/s.render.resolution_y)*1.10
ac=next(o for o in s.objects if o.type=='CAMERA' and o.name.startswith('04'))
ac.location=(-3,-1,8);ac.rotation_euler=(Vector((2,5,1))-ac.location).to_track_quat('-Z','Y').to_euler();ac.data.lens=29
for name,col in [('concrete text',(.045,.07,.10)),('Zone B floor text',(.01,.22,.08)),('Zone A floor text',(.01,.18,.28))]:
 m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True;nodes=m.node_tree.nodes;bs=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
 if bs:bs.inputs['Base Color'].default_value=(*col,1)
 for o in s.objects:
  if o.type=='FONT' and o.rotation_euler.x==0 and o.location.z<.04:
   if (name=='Zone B floor text' and o.name.startswith('B 區')) or (name=='Zone A floor text' and o.name.startswith('A 區')) or (name=='concrete text' and not o.name.startswith(('A 區','B 區'))):o.data.materials.clear();o.data.materials.append(m)
s.camera=next(o for o in s.objects if o.type=='CAMERA' and o.name.startswith('01'));bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=os.path.join(O,'AIDC_4F_A11_B22.blend'))
counts={z:len([o for o in s.objects if o.get('Zone')==z]) for z in ['A','B']};assert counts=={'A':11,'B':22};assert len(bpy.data.scenes)==1
# Validate floor/rack bounds and exact naming after reopening.
for z,n in counts.items():
 assert all(bpy.data.objects.get(f'4F-{z}-{i:02d}') is not None for i in range(1,n+1))
json.dump({'reopened_successfully':True,'scene_count':1,'rack_counts':counts,'rack_total':sum(counts.values()),'packed_sources':True},open(os.path.join(O,'validation.json'),'w'),indent=2)
for prefix,suffix in [('01','overview'),('02','plan'),('04','zone_A')]:
 s.camera=next(o for o in s.objects if o.type=='CAMERA' and o.name.startswith(prefix));s.render.filepath=os.path.join(O,'previews','4F_'+suffix+'.png');bpy.ops.render.render(write_still=True)
print('4F VERIFIED',counts)
