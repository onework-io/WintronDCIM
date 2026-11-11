"""Reference-driven overhead services. Blender scene patch; rerunnable and batched by material."""
import bpy, math, os, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'output','4F')

def upgrade():
 scene=bpy.context.scene
 for c in list(bpy.data.collections):
  if c.name.startswith('4F_13'):
   for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
   bpy.data.collections.remove(c)
 for c in list(bpy.data.collections):
  if c.name.startswith(('4F_11A','4F_11B')):
   for o in list(c.objects):
    if o.name.startswith(('A/B overhead busway','Tap off module','Basket edge','Basket rung','Fibre tray','Hanger rod')):bpy.data.objects.remove(o,do_unlink=True)
 def material(name,color,metal=.4,rough=.38):
  m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
  p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) or m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
 mats={
 'Busway A':material('Overhead | yellow A',(.95,.62,.018)),
 'Busway B':material('Overhead | orange B',(.95,.19,.018)),
 'Galvanized':material('Overhead | galvanized',(.46,.54,.60),.75,.32),
 'Cable blue':material('Overhead | network blue',(.015,.12,.42),.15),
 'Cable cyan':material('Overhead | fibre cyan',(.012,.48,.52),.15),
 'Dark fittings':material('Overhead | dark fittings',(.026,.04,.055),.45),
 'Labels':material('Overhead | label plate',(.80,.86,.90),.2)}
 report=[]
 for zone,count,x0,y,width in [('A',11,-2.2,5.1,.8),('B',22,-25.5,-5.4,.6)]:
  col=bpy.data.collections.new('4F_13'+zone+' | Detailed overhead services');scene.collection.children.link(col)
  batches={k:[[],[]] for k in mats};length=count*width
  def box(key,c,s):
   vs,fs=batches[key];off=len(vs);vs.extend([(c[0]+dx*s[0]/2,c[1]+dy*s[1]/2,c[2]+dz*s[2]/2) for dx,dy,dz in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]])
   fs.extend([tuple(off+i for i in f) for f in [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]])
  def sweep(key,points,radius,sides=8):
   vs,fs=batches[key];off=len(vs);pts=[Vector(p) for p in points]
   for i,p in enumerate(pts):
    t=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized();n=Vector((1,0,0)) if abs(t.x)<.9 else Vector((0,1,0));n=(n-t*t.dot(n)).normalized();b=t.cross(n)
    for j in range(sides):vs.append(tuple(p+radius*(n*math.cos(j*2*math.pi/sides)+b*math.sin(j*2*math.pi/sides))))
   fs.append(tuple(off+j for j in reversed(range(sides))))
   for i in range(len(pts)-1):
    for j in range(sides):fs.append((off+i*sides+j,off+i*sides+(j+1)%sides,off+(i+1)*sides+(j+1)%sides,off+(i+1)*sides+j))
   fs.append(tuple(off+(len(pts)-1)*sides+j for j in range(sides)))
  def bezier(a,b,c,d,n=14):
   a,b,c,d=map(Vector,[a,b,c,d]);return [tuple((1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d) for t in [i/n for i in range(n+1)]]
  for sign,key in [(-1,'Busway A'),(1,'Busway B')]:
   by=y+sign*.42
   box(key,(x0+length/2,by,3.14),(length+.3,.14,.18))
   for z in [3.04,3.24]:box(key,(x0+length/2,by,z),(length+.34,.20,.035))
   for i in range(1,int(length/2.4)+1):box('Galvanized',(x0+i*2.4,by,3.14),(.055,.155,.20))
   for i in range(count):
    x=x0+(i+.5)*width
    box(key,(x,by,3.31),(.22,.25,.18));box(key,(x,by,3.415),(.26,.29,.035))
    box('Dark fittings',(x,by+sign*.132,3.31),(.065,.014,.08))
    box('Labels',(x-.065,by+sign*.14,3.34),(.045,.012,.035))
    # Broad insulated downfeed with a gentle outward shoulder, then rounded roof entry.
    pts=bezier((x,by+sign*.13,3.31),(x,by+sign*.25,3.27),(x,by+sign*.25,3.10),(x,by+sign*.25,2.98),8)
    pts += [(x,by+sign*.25,2.51)]
    pts += bezier((x,by+sign*.25,2.51),(x,by+sign*.25,2.36),(x,by,2.37),(x,by,2.26),10)[1:]
    sweep(key,pts,.047,4)
    box('Dark fittings',(x,by,2.265),(.15,.13,.03))
    for h in [2.66,2.92]:box('Galvanized',(x,by+sign*.25,h),(.10,.10,.025))
  # Open wire mesh basket at lower level, separated from power downfeeds.
  for yy in [-.27,-.18,-.09,0,.09,.18,.27]:sweep('Galvanized',[(x0-.1,y+yy,2.76),(x0+length+.1,y+yy,2.76)],.008,6)
  for side in [-1,1]:
   for h in [2.81,2.88,2.95]:sweep('Galvanized',[(x0-.1,y+side*.27,h),(x0+length+.1,y+side*.27,h)],.008,6)
  for i in range(int((length+.2)/.15)+1):
   x=x0-.1+i*.15;sweep('Galvanized',[(x,y-.27,2.95),(x,y-.27,2.76),(x,y+.27,2.76),(x,y+.27,2.95)],.007,6)
  for j in range(10):
   yy=y-.20+j*.043;sweep('Cable blue' if j<6 else 'Cable cyan',[(x0-.10,yy,2.785),(x0+length+.10,yy,2.785)],.012,6)
  for i in range(count):
   x=x0+(i+.5)*width
   for j in range(4):
    xx=x-.09+j*.06;key='Cable blue' if j<2 else 'Cable cyan'
    pts=bezier((xx-.22,y-.12+j*.075,2.81),(xx+.03,y-.12+j*.075,2.81),(xx,y-.33,2.68),(xx,y-.33,2.56),10)
    pts += bezier((xx,y-.33,2.56),(xx,y-.33,2.40),(xx,y-.15,2.42),(xx,y-.15,2.26),10)[1:]
    sweep(key,pts,.012,6)
   box('Dark fittings',(x,y-.15,2.265),(.34,.13,.03))
  # Threaded hanger pairs and trapeze crossmembers, without ground-standing posts.
  for i in range(math.ceil(length/2)+1):
   xx=x0+min(i*2,length)
   for yy in [y-.85,y+.85]:
    sweep('Galvanized',[(xx,yy,2.70),(xx,yy,3.58)],.012,8)
    box('Galvanized',(xx,yy,3.57),(.12,.12,.035))
    box('Dark fittings',(xx,yy,2.73),(.05,.05,.035))
   box('Galvanized',(xx,y,2.72),(.055,1.78,.055))
  for key,(vs,fs) in batches.items():
   me=bpy.data.meshes.new('Overhead '+zone+' '+key);me.from_pydata(vs,[],fs);me.materials.append(mats[key]);me.update()
   ob=bpy.data.objects.new('Overhead '+zone+' | '+key,me);col.objects.link(ob);ob['ServiceZone']=zone;ob['Reference']='Aisle video 2026-11-11';ob['System']=key
  report.append({'zone':zone,'racks':count,'busways':2,'tap_off_boxes':count*2,'power_downfeeds':count*2,'data_downfeeds':count*4,'mesh_batches':len(batches)})
 scene['Overhead_reference']='User aisle video: A/B busways, tap-offs, curved downfeeds, wire baskets, data bundles, trapeze hangers'
 return report

if __name__=='__main__':
 bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'AIDC_4F_A11_B22.blend'))
 report=upgrade();bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'AIDC_4F_A11_B22.blend'))
 json.dump(report,open(os.path.join(OUT,'overhead_validation.json'),'w'),indent=2)
 print('OVERHEAD UPGRADE',report)
 if os.environ.get('RENDER_OVERHEAD'):
  s=bpy.context.scene;cam=s.camera;cam.data.type='PERSP';cam.data.lens=40;cam.location=(-28,-10,5.7);cam.rotation_euler=(Vector((-20,-5.4,2.65))-cam.location).to_track_quat('-Z','Y').to_euler()
  s.render.resolution_x=1200;s.render.resolution_y=780;s.render.resolution_percentage=100;s.cycles.samples=16;s.render.filepath=os.path.join(OUT,'previews','overhead_detail.png');bpy.ops.render.render(write_still=True)
