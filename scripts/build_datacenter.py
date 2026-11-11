import bpy, math, json, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'output'); bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(n,c,metal=0,rough=.5,emit=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes.clear();p=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');out=m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(p.outputs[0],out.inputs['Surface']);p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emit:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emit
 return m
white=mat('Architecture | warm white',(.69,.73,.76)); concrete=mat('Slab | edge',(.19,.24,.29));black=mat('Rack | graphite',(.018,.024,.032),.65,.3);door=mat('Rack | perforated dark door',(.045,.065,.085),.55,.35);silver=mat('Cable basket | galvanized',(.42,.52,.60),.8,.28);yellow=mat('Power A | safety yellow',(.98,.58,.025),.35,.3);orange=mat('Power B | orange',(.95,.18,.025),.4,.3);blue=mat('Cold aisle | blue',(.025,.24,.55),.15,.38);green=mat('Status | green',(.08,.8,.32),emit=3);cyan=mat('Data | cyan',(.015,.7,.8),.4);red=mat('Fire | red',(.65,.035,.03),.4);glass=mat('Glazing | tinted',(.08,.22,.29),.55,.22);light=mat('LED | white',(.8,.92,1),emit=5);textmat=mat('Sign | white',(.85,.93,1)); wood=mat('Desk | pale oak',(.48,.34,.19)); floor=mat('Raised floor | 600 mm tile',(.5,.57,.62),.15,.5)
# Metric procedural tile grid, stable in world scale.
n=floor.node_tree.nodes;l=floor.node_tree.links;p=next(a for a in n if a.type=='BSDF_PRINCIPLED');geo=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(geo.outputs['Object'],sep.inputs[0]);edges=[]
for axis in ['X','Y']:
 mul=n.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=1/.6;l.new(sep.outputs[axis],mul.inputs[0]);fr=n.new('ShaderNodeMath');fr.operation='FRACT';l.new(mul.outputs[0],fr.inputs[0]);cmp=n.new('ShaderNodeMath');cmp.operation='LESS_THAN';cmp.inputs[1].default_value=.018;l.new(fr.outputs[0],cmp.inputs[0]);edges.append(cmp)
mx=n.new('ShaderNodeMath');mx.operation='MAXIMUM';l.new(edges[0].outputs[0],mx.inputs[0]);l.new(edges[1].outputs[0],mx.inputs[1]);mix=n.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(.48,.54,.59,1);mix.inputs[2].default_value=(.21,.27,.31,1);l.new(mx.outputs[0],mix.inputs[0]);l.new(mix.outputs[0],p.inputs['Base Color'])
C=None; scene=None
cubeverts=[(-.5,-.5,-.5),(-.5,-.5,.5),(-.5,.5,-.5),(-.5,.5,.5),(.5,-.5,-.5),(.5,-.5,.5),(.5,.5,-.5),(.5,.5,.5)];faces=[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)];meshcache={}
def box(n,loc,size,ma,collection=None):
 key=ma.name
 if key not in meshcache:
  me=bpy.data.meshes.new('Cube_'+key);me.from_pydata(cubeverts,[],faces);me.materials.append(ma);meshcache[key]=me
 o=bpy.data.objects.new(n,meshcache[key]);(collection or C).objects.link(o);o.location=loc;o.scale=size;return o
def beam(n,a,b,w,h,ma,z):
 a=Vector(a);b=Vector(b);d=b-a;o=box(n,((a.x+b.x)/2,(a.y+b.y)/2,z),(d.length,w,h),ma);o.rotation_euler.z=math.atan2(d.y,d.x);return o
def coll(n):
 c=bpy.data.collections.new(n);scene.collection.children.link(c);return c
def label(n,s,loc,size=.25,ma=textmat,rot=(0,0,0)):
 cu=bpy.data.curves.new(n,'FONT');cu.body=s;cu.size=size;cu.extrude=.001;o=bpy.data.objects.new(n,cu);C.objects.link(o);o.location=loc;o.rotation_euler=rot;cu.materials.append(ma);return o
def poly(n,pts,z,depth,ma):
 me=bpy.data.meshes.new(n);N=len(pts);vs=[(x,y,z+d) for d in [-depth,0] for x,y in pts];fs=[tuple(reversed(range(N))),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)];me.from_pydata(vs,[],fs);me.materials.append(ma);o=bpy.data.objects.new(n,me);C.objects.link(o);return o
def wall(a,b,h=3.6,w=.2):return beam('Wall | DXF traced',a,b,w,h,white,h/2)
def camera(n,pos,target,ortho=None):
 ca=bpy.data.cameras.new(n);o=bpy.data.objects.new(n,ca);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();ca.clip_end=500
 if ortho:ca.type='ORTHO';ca.ortho_scale=ortho
 else:ca.lens=24
 return o
def area(n,pos,power,size,target):
 da=bpy.data.lights.new(n,'AREA');da.energy=power;da.shape='DISK';da.size=size;o=bpy.data.objects.new(n,da);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
# Shared detailed rack asset. X = cabinet depth; Y = rack face width.
asset=bpy.data.collections.new('ASSET | 42U rack 800 x 1200 x 2200');C=asset
box('Cabinet', (0,0,1.15),(1.2,.8,2.2),black)
for side in [-1,1]:
 box('Door', (side*.608,0,1.16),(.025,.72,2.06),door)
 for j in range(22):box('Vent slot', (side*.625,0,.23+j*.083),(.009,.64,.012),black)
 box('Handle',(side*.64,.26,1.13),(.035,.025,.20),silver)
 box('Asset badge',(side*.63,0,2.05),(.012,.25,.06),silver)
 for j in range(4):box('Status LED',(side*.635,-.24,1.85-j*.1),(.015,.025,.018),green)
 for yy in [-.38,.38]:box('Vertical rail',(side*.62,yy,1.15),(.025,.025,2.16),silver)
box('Plinth',(0,0,.06),(1.22,.82,.12),black)
# Scenes are deliberately independent floor models; no other floors are constructed.
counts={}
for f in [2,3]:
 scene=bpy.data.scenes.new(f'{f}F | Data Centre');bpy.context.window.scene=scene;scene.unit_settings.system='METRIC';scene.unit_settings.length_unit='METERS';scene['Source']='緯創樓_115.09.02 B1F-R1F建築底圖_6087.dxf';scene['Scale_note']='DXF coordinates interpreted as centimetres from 80 cm columns and door block sizes; header INSUNITS conflicts.';scene['Design_status']='Architectural tracing + proposed data centre fitout, not as-built MEP';scene['Assumed_height_m']=3.6
 C=coll(f'{f}F_01 | Floor slabs')
 if f==2:
  north=[(-40,-10.6),(18.4,-10.6),(18.4,9.6),(10.3,9.6),(10.3,7.3),(-32.9,7.3),(-32.9,9.6),(-40,9.6)]
 else:north=[(-40,-10),(18.4,-10),(18.4,8.9),(-40,8.9)]
 south=[(-40,-66.3),(18.4,-66.3),(18.4,-46.5),(-40,-46.5)]
 poly('North wing slab',north,0,.35,floor);poly('South wing slab',south,0,.35,floor)
 poly('East link corridor',[(.1,-10.6),(3,-10.6),(3,-47.5),(.1,-47.5)],0,.35,floor)
 if f==2:poly('Central link', [(-15,-17),(.1,-14),(.1,-42),(-10,-42)],0,.25,floor);poly('East support rooms',[(3,-13.4),(9,-12.2),(9,-42),(3,-42)],0,.25,floor)
 C=coll(f'{f}F_02 | Architecture traced from DXF')
 for footprint in [north,south]:
  for a,b in zip(footprint,footprint[1:]+footprint[:1]):wall(a,b)
 # Main hall / core separation, with access opening.
 for ya,yb in [(-10,-2),(.1,7.3)]:wall((0,ya),(0,yb))
 # Four stair cores, position and footprint from plan.
 for x,y in [(-39,-9.5),(10.5,4.6),(-39,-57),(10.5,-66)]:
  w=4.5 if x<0 else 7.1;d=8 if x<0 else 4
  wall((x,y),(x+w,y));wall((x,y),(x,y+d));wall((x,y+d),(x+w,y+d));wall((x+w,y),(x+w,y+d-1.4))
  for i in range(14):
   if x<0:box('Stair tread',(x+1.1,y+.25+i*.25,.07+i*.12),(1.8,.25,.14+i*.24),white)
   else:box('Stair tread',(x+.3+i*.25,y+1,.07+i*.12),(.25,1.8,.14+i*.24),white)
 # North control room (as indicated on 2F; service enclosure on 3F).
 wall((-8.5,-9.5),(-8.5,-4));wall((-8.5,-4),(-1.5,-4));wall((-1.5,-4),(0,-4),h=.9)
 # East utility cores and restrooms, simplified interior fittings.
 for yy in [-9.7,-52.5]:
  wall((3.0,yy),(9,yy));wall((9,yy),(9,yy+7));wall((3,yy),(3,yy+2.4));wall((3,yy+4),(3,yy+7));wall((3,yy+7),(9,yy+7));wall((3,yy+3.5),(9,yy+3.5))
  for xx in [11.4,13.4,15.4]:
   wall((xx,yy),(xx,yy+3),2.3,.10);box('Washroom fixture',(xx+.6,yy+1,.45),(.55,.7,.9),white)
 # South wing room layout differs by floor.
 if f==2:
  for x in [-25.5,-17,-8.5,0]:wall((x,-47.5),(x,-59.2))
  for xa,xb in [(-33,-27),(-25.3,-18.5),(-16.8,-10),(-8.3,-1.5)]:wall((xa,-59.2),(xb,-59.2))
 else:
  for x in [-32.5,-29.8,-25.5,-21.2,-17,-13,-6.5,0]:wall((x,-47.5),(x,-54.2))
  wall((-32.5,-54.2),(-1.5,-54.2));wall((-25.5,-56.8),(8.5,-56.8));wall((-25.5,-56.8),(-25.5,-66));wall((8.5,-56.8),(8.5,-61))
 # Central trapezoid and corridor. 3F centre kept free of equipment pending confirmation.
 for a,b in [((-15,-17),(9,-12.2)),((-15,-17),(-10,-42)),((-10,-42),(9,-42)),((9,-12.2),(9,-42)),((0,-10),(0,-14)),((3,-10),(3,-13.4))]:wall(a,b,1.1 if f==3 else 3.6)
 if f==2:
  wall((0,-14),(0,-42));wall((-13.5,-23.5),(0,-23.5));
  for x in [-11.5,-8,-4]:wall((x,-22),(x,-17-x*.2))
  for y in [-21.5,-25.5,-29.5,-33.5,-37.5,-42]:wall((3,y),(9,y));wall((3,y),(3,y+2.5))
  for i in range(14):box('Central stepped passage',(-5.5,-40.5+i*1.05,.07+i*.08),(8.6,1.05,.14+i*.16),white)
 # Exposed structural columns derived from 850 cm grid and DXF column footprints.
 C=coll(f'{f}F_03 | Structural columns')
 for y in [0,-9.5,-47.5,-57,-65.5]:
  for x in [-39,-34,-25.5,-17,-8.5,0,8.5,17.2]:box('RC column 800', (x,y,1.8),(.8,.8,3.6),white)
 for y in [-17.5,-25.5,-33.5,-41.5]:box('Link column',(8.5,y,1.8),(.8,1.1,3.6),white)
 # Source drawing is retained as editable curves but hidden by default.
 C=coll(f'{f}F_90 | CAD source linework - toggle to compare');C.hide_render=True;C.hide_viewport=True
 data=json.load(open(os.path.join(OUT,f'{f}F_base.json')));cu=bpy.data.curves.new('DXF original geometry','CURVE');cu.dimensions='3D';cu.bevel_depth=.009;cu.bevel_resolution=0
 for pts in data['lines']:
  if len(pts)>1000:continue
  if not all(-4100<p[0]<1900 and -6700<p[1]<1000 for p in pts):continue
  sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
  for q,p in zip(sp.points,pts):q.co=(p[0]*.01,p[1]*.01,.025,1)
 ob=bpy.data.objects.new('DXF 1 unit = .01 m',cu);C.objects.link(ob);cu.materials.append(cyan)
 C=coll(f'{f}F_10 | Proposed racks and cold aisles');count=0
 for pod,center in enumerate([-28.5,-20.5,-12.5,-4.5]):
  ymin=-8.2 if pod<3 else -.0;ymax=6.4
  box('Cold aisle blue zone',(center,(ymin+ymax)/2,.018),(1.75,ymax-ymin,.035),blue)
  for side in [-1,1]:
   xx=center+side*1.5
   for k,yy in enumerate([-7.5,-6.65,-5.8,-4.95,-4.1,-3.25,1.2,2.05,2.9,3.75,4.6,5.45]):
    if yy<ymin:continue
    ob=bpy.data.objects.new(f'{f}F-R{pod*2+(1 if side<0 else 2):02d}-{k+1:02d}',None);C.objects.link(ob);ob.instance_type='COLLECTION';ob.instance_collection=asset;ob.location=(xx,yy,0);ob['proposed']=True;ob['size_m']='0.8 W x 1.2 D x 2.2 H';count+=1
   # Grey overhead ladder trays, yellow / orange power rails and tap boxes.
   for yy in [ymin,ymax]:beam('Aisle portal',(center-2.15,yy),(center+2.15,yy),.10,.14,silver,2.62)
   railmat=yellow if side<0 else orange
   beam('Busway A/B',(xx,ymin),(xx,ymax),.15,.18,railmat,2.98)
   for yy in [ymin+i*.8 for i in range(int((ymax-ymin)/.8))]:
    box('Tap off box',(xx,yy,3.10),(.27,.22,.20),railmat)
    beam('Basket rung',(xx-.3,yy),(xx+.3,yy),.025,.025,silver,2.66)
   for dx in [-.3,.3]:beam('Basket side',(xx+dx,ymin),(xx+dx,ymax),.025,.14,silver,2.72)
   beam('Data fibre',(xx+.22,ymin),(xx+.22,ymax),.045,.05,cyan,2.84)
   for yy in [ymin+.6,ymax-.6]:box('Suspension rod',(xx,yy,3.3),(.022,.022,1.2),silver)
  label('Floor aisle label',f'{f}F / COLD AISLE {pod+1:02}',(center-.5,ymin+.1,.041),.19)
  # End door portals with tinted infill and horizontal LED.
  for yy in [ymin-.1,ymax+.1]:
   for xx in [center-.87,center+.87]:box('Containment post',(xx,yy,1.22),(.06,.06,2.44),silver)
   box('Containment header',(center,yy,2.42),(1.8,.08,.1),silver)
   box('Containment glass door',(center,yy,1.18),(1.66,.025,2.25),glass)
 counts[f]=count
 C=coll(f'{f}F_11 | Cooling power safety - proposed')
 for i,x in enumerate([-31,-24,-17,-10,-3]):
  box('CRAC precision cooling',(x,6.7,1.1),(1.45,.8,2.2),white)
  box('CRAC grille',(x,6.285,1.2),(1.2,.025,1.7),door)
  for j in range(12):box('CRAC louvre',(x,6.26,.5+j*.12),(1.17,.025,.025),silver)
 for x in [2,3.2,4.4,5.6]:
  box('UPS / power cabinet',(x,3.6,1.05),(.85,.85,2.1),black);box('UPS front',(x,3.16,1.1),(.78,.025,1.95),door);box('UPS display',(x,3.14,1.6),(.35,.015,.2),cyan)
 for x in [2,3.2,4.4,5.6]:box('Battery cabinet',(x,5.8,1),(.9,.8,2),white)
 for yy in [-8.5,6.7]:beam('Fire main',(-33,yy),(-.5,yy),.07,.07,red,3.25)
 for x in [-28.5,-20.5,-12.5,-4.5]:
  beam('Lighting strip',(x,-8 if x<-8 else 0),(x,6.5),.045,.035,light,3.5)
  for yy in [-6,3]:box('Smoke detector',(x,yy,3.5),(.15,.15,.06),white)
 # NOC room with desk and three screens.
 C=coll(f'{f}F_12 | Operations and support furniture')
 for x in [-7,-5,-3]:
  box('NOC console',(x,-8,.76),(1.7,.8,.08),wood);box('Desk pedestal',(x,-8,.36),(.1,.6,.72),silver);box('Operator display',(x,-7.75,1.14),(1.1,.08,.55),black);box('Screen',(x,-7.70,1.14),(1,.015,.45),cyan);box('Operator seat',(x,-8.8,.46),(.5,.5,.12),black);box('Operator back',(x,-9,.8),(.5,.1,.6),black)
 for x in ([-29,-20.5,-12,-3.5] if f==2 else [-31,-27.5,-23.5,-19,-15,-9,-3]):
  box('Support desk',(x,-51,.75),(1.6,.8,.08),wood);box('Desk pedestal',(x,-51,.35),(.15,.55,.7),silver);box('Support display',(x,-50.8,1.1),(.8,.07,.45),black)
 if f==3:
  for x in [-22,-18,-14,-10,-6]:
   box('Technical staging bench',(x,-61,.78),(2.4,1.1,.1),silver);box('Bench leg',(x,-61,.35),(.2,.8,.7),black)
 C=coll(f'{f}F_20 | Wayfinding')
 for s,loc,size in [(f'{f}F  /  DATA CENTRE',(-31,8,3),.65),('NOC',(-7.7,-9.35,2.6),.35),('POWER / UPS',(1,7,2.6),.35)]:label(s,s,loc,size,rot=(math.pi/2,0,0))
 label('South floor zone','SUPPORT / OPERATIONS',(-26,-63,.03),.65,ma=concrete)
 label('Link note','CENTRAL LINK' if f==2 else 'OPEN ZONE / VERIFY',(-7,-39,.04),.35,ma=concrete)
 # Presentation cameras and physically scaled lighting.
 C=coll(f'{f}F_80 | Lighting')
 world=bpy.data.worlds.new(f'{f}F World');world.use_nodes=True;next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.12,.17,.23,1);next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[1].default_value=.65;scene.world=world
 area('Large softbox',(-25,-10,45),18000,40,(-10,-25,0));area('Fill',(20,-30,25),11000,30,(-10,-28,0));area('Hall softbox',(-17,0,12),4500,18,(-17,0,0))
 for x in [-28.5,-20.5,-12.5,-4.5]:area('Aisle light',(x,0,5),220,6,(x,0,0))
 overview=camera('01 | Full floor overview',(-96,-122,107),(-10,-28,0),100)
 plan=camera('02 | Top plan',(-10,-28,120),(-10,-28,0),86)
 hero=camera('03 | Data hall overview',(-44,-23,23),(-17,-.5,.7))
 aisle=camera('04 | Cold aisle eye level',(-28.5,-1.8,1.7),(-28.5,6,1.7))
 scene.camera=overview;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1400;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.render.film_transparent=False
 scene['Rack_count_proposed']=count
# Remove empty factory scene.
for s in list(bpy.data.scenes):
 if s.name=='Scene':bpy.data.scenes.remove(s)
bpy.context.window.scene=bpy.data.scenes['2F | Data Centre']
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':a.spaces.active.region_3d.view_distance=95;a.spaces.active.region_3d.view_location=(-10,-28,0);a.spaces.active.clip_end=500
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'AIDC_2F_3F.blend'))
json.dump({'racks':counts,'scenes':[s.name for s in bpy.data.scenes],'objects':len(bpy.data.objects)},open(os.path.join(OUT,'model_manifest.json'),'w'),indent=2)
for f in [2,3]:
 scene=bpy.data.scenes[f'{f}F | Data Centre'];bpy.context.window.scene=scene
 for suffix,cam in [('overview','01 | Full floor overview'),('hall','03 | Data hall overview')]:
  scene.camera=next(o for o in scene.objects if o.type=='CAMERA' and o.name.startswith(cam));scene.render.filepath=os.path.join(OUT,'previews',f'{f}F_{suffix}.png');bpy.ops.render.render(write_still=True)
print('BUILD COMPLETE',counts)
