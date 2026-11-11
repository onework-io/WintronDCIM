import bpy, os, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));OUT=os.path.join(ROOT,'output','4F')
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'AIDC_4F_A11_B22.blend'))
s=bpy.context.scene;bpy.context.view_layer.update()
# Collapse the shared rack assembly to one reusable multi-material mesh.
asset=bpy.data.collections.get('ASSET | 42U rack 800 x 1200 x 2200')
verts=[];faces=[];mats=[];indices=[]
for o in asset.objects:
 if o.type!='MESH':continue
 off=len(verts);verts.extend([tuple(o.matrix_local@v.co) for v in o.data.vertices])
 for p in o.data.polygons:
  faces.append(tuple(off+i for i in p.vertices));ma=o.data.materials[p.material_index]
  if ma not in mats:mats.append(ma)
  indices.append(mats.index(ma))
mesh=bpy.data.meshes.new('IT Rack | shared detailed mesh');mesh.from_pydata(verts,[],faces)
for ma in mats:mesh.materials.append(ma)
for p,idx in zip(mesh.polygons,indices):p.material_index=idx
racks=[o for o in s.objects if o.get('Zone') in ['A','B']]
assert len(racks)==33
for o in racks:
 o.instance_type='NONE';o.instance_collection=None
 child=bpy.data.objects.new(o.name+' | geometry',mesh);o.users_collection[0].objects.link(child);child.parent=o
# Convert visible text to meshes so labels survive glTF export.
deps=bpy.context.evaluated_depsgraph_get()
for o in list(s.objects):
 if o.type=='FONT' and o.visible_get():
  me=bpy.data.meshes.new_from_object(o.evaluated_get(deps),depsgraph=deps);name=o.name;matrix=o.matrix_world.copy();collections=list(o.users_collection)
  bpy.data.objects.remove(o,do_unlink=True);ob=bpy.data.objects.new(name,me)
  for c in collections:c.objects.link(ob)
  ob.matrix_world=matrix
# Turn the procedural floor grid into an embedded, repeatable PBR texture.
ma=bpy.data.materials.get('Raised floor | 600 mm tile');nodes=ma.node_tree.nodes;nodes.clear();bs=nodes.new('ShaderNodeBsdfPrincipled');out=nodes.new('ShaderNodeOutputMaterial');ma.node_tree.links.new(bs.outputs[0],out.inputs['Surface']);bs.inputs['Metallic'].default_value=.15;bs.inputs['Roughness'].default_value=.5
im=bpy.data.images.new('600mm floor tile',width=128,height=128,alpha=False)
pixels=[]
for y in range(128):
 for x in range(128):pixels.extend((.21,.27,.31,1) if x<2 or y<2 else (.48,.54,.59,1))
im.pixels.foreach_set(pixels);im.pack();tx=nodes.new('ShaderNodeTexImage');tx.image=im;tx.extension='REPEAT';ma.node_tree.links.new(tx.outputs['Color'],bs.inputs['Base Color'])
for o in s.objects:
 if o.type=='MESH' and ma.name in o.data.materials:
  uv=o.data.uv_layers.new(name='Floor metric UV')
  for p in o.data.polygons:
   for li in p.loop_indices:
    v=o.matrix_world@o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(v.x/.6,v.y/.6)
path=os.path.join(OUT,'AIDC_4F_A11_B22_draco.glb')
bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_visible=True,use_active_scene=True,export_apply=True,export_cameras=True,export_lights=False,export_extras=True,export_animations=False,export_yup=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=16,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12)
print('EXPORTED',path,os.path.getsize(path))
# Decoder roundtrip: test the compressed artifact rather than the source scene.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
counts={z:len([o for o in bpy.context.scene.objects if o.get('Zone')==z]) for z in ['A','B']}
assert counts=={'A':11,'B':22},counts
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert meshes
points=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
bounds=[[min(p[i] for p in points),max(p[i] for p in points)] for i in range(3)]
assert 58<bounds[0][1]-bounds[0][0]<60,bounds
assert 41<bounds[1][1]-bounds[1][0]<44,bounds
report={'file':os.path.basename(path),'size_bytes':os.path.getsize(path),'draco_level':6,'quantization':{'position':16,'normal':10,'texcoord':12},'decoded_in_Blender':True,'rack_counts':counts,'mesh_objects_after_import':len(meshes),'bounds_m_Blender_axes':bounds,'embedded_floor_texture':True,'cameras_exported':True,'studio_area_lights_exported':False}
json.dump(report,open(os.path.join(OUT,'glb_validation.json'),'w'),ensure_ascii=False,indent=2)
print('ROUNDTRIP OK',report)
