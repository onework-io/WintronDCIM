import bpy, math, json, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'output','4F');os.makedirs(os.path.join(OUT,'previews'),exist_ok=True); bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(n,c,metal=0,rough=.5,emit=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes.clear();p=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');out=m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(p.outputs[0],out.inputs['Surface']);p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emit:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emit
 return m
white=mat('Architecture | warm white',(.69,.73,.76)); concrete=mat('Slab | edge',(.19,.24,.29));black=mat('Rack | graphite',(.018,.024,.032),.65,.3);door=mat('Rack | perforated dark door',(.045,.065,.085),.55,.35);silver=mat('Cable basket | galvanized',(.42,.52,.60),.8,.28);yellow=mat('Power A | safety yellow',(.98,.58,.025),.35,.3);orange=mat('Power B | orange',(.95,.18,.025),.4,.3);blue=mat('Cold aisle | blue',(.025,.24,.55),.15,.38);green=mat('Status | green',(.08,.8,.32),emit=3);cyan=mat('Data | cyan',(.015,.7,.8),.4);red=mat('Fire | red',(.65,.035,.03),.4);glass=mat('Glazing | tinted',(.08,.22,.29),.55,.22);light=mat('LED | white',(.8,.92,1),emit=5);textmat=mat('Sign | white',(.85,.93,1)); wood=mat('Desk | pale oak',(.48,.34,.19)); floor=mat('Raised floor | 600 mm tile',(.5,.57,.62),.15,.5)
# Transparent containment glazing: alpha blend is portable to the local glTF viewer.
contain_glass=mat('Containment | clear blue glass',(.35,.72,.82),0,.18)
contain_glass.diffuse_color=(.35,.72,.82,.19)
next(n for n in contain_glass.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Alpha'].default_value=.19
if hasattr(contain_glass,'surface_render_method'):contain_glass.surface_render_method='DITHERED'
elif hasattr(contain_glass,'blend_method'):contain_glass.blend_method='BLEND'
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
scene=bpy.data.scenes.new('4F | A11 + B22');bpy.context.window.scene=scene;scene.unit_settings.system='METRIC';scene.unit_settings.length_unit='METERS'
scene['Confirmed_scope']='4F only, user marked area: Zone A 11 racks, Zone B 22 racks.';scene['Architectural_source']='4F建築底圖-0511';scene['Fitout_source']='User supplied annotated 4F image, A11 B22';scene['Assumptions']='1 DXF unit = .01 m; height 3.6m; A rack width .8m / B .6m estimated; MEP illustrative.'
try:cnfont=bpy.data.fonts.load('/System/Library/Fonts/STHeiti Medium.ttc')
except:cnfont=None
base_label=label
def label(n,s,loc,size=.25,ma=textmat,rot=(0,0,0)):
 o=base_label(n,s,loc,size,ma,rot)
 if cnfont:o.data.font=cnfont
 return o
C=coll('4F_01 | Slabs - selected north wing and east support')
poly('North wing floor',[(-40,-10),(18.4,-10),(18.4,8.9),(-40,8.9)],0,.35,floor)
poly('OP and maintenance wing',[(0,-10),(11,-10),(11,-33),(0,-33)],0,.35,floor)
C=coll('4F_02 | Architecture and partitions')
# Main envelope with corridor connection; cropped at end of maintenance room.
for a,b in [((-40,-10),(0,-10)),((11,-10),(18.4,-10)),((18.4,-10),(18.4,8.9)),((18.4,8.9),(-40,8.9)),((-40,8.9),(-40,-10)),((0,-10),(0,-33)),((0,-33),(11,-33)),((11,-33),(11,-10))]:wall(a,b)
# Corridor separating the upper electrical/A rooms from B/support rooms.
for xa,xb in [(-40,-31.4),(-29.8,-20.5),(-18.9,-5.8),(-4.2,-1.5),(.1,6),(7.6,8.5)]:wall((xa,1.5),(xb,1.5))
wall((-4,1.5),(-4,8.9));wall((8.5,1.5),(8.5,8.9))
# B room and western cooling support, with actual door gaps.
wall((-29,-10),(-29,-.7));wall((-8.5,-10),(-8.5,-.7))
for xa,xb in [(-29,-26.5),(-24.9,-13),(-11.4,-8.5),(-8.5,-5.8),(-4.2,3)]:wall((xa,-.7),(xb,-.7))
wall((3,-.7),(3,-5.5));wall((3,-5.5),(8.5,-5.5));wall((8.5,-5.5),(8.5,-.7))
# West stair, as source layout.
for a,b in [((-39,-9.5),(-34.5,-9.5)),((-39,-9.5),(-39,-1.8)),((-34.5,-9.5),(-34.5,-4)),((-34.5,-2.4),(-34.5,-.7)),((-39,-.7),(-35.5,-.7))]:wall(a,b)
for i in range(14):box('D stair tread',(-37.7,-9+i*.25,.075+i*.12),(1.8,.25,.15+i*.24),white)
# Northeast stair and elevator core.
for a,b in [((11,4.6),(17.5,4.6)),((11,4.6),(11,8.5)),((11,8.5),(17.5,8.5)),((17.5,8.5),(17.5,4.6)),((11,2.8),(17.5,2.8)),((17.5,2.8),(17.5,4.6))]:wall(a,b)
for i in range(14):box('A stair tread',(11.5+i*.25,6.2,.075+i*.12),(.25,1.8,.15+i*.24),white)
for x in [12,15]:box('Lift door',(x,2.77,1.2),(1.5,.06,2.4),silver)
# East restrooms and original electrical/low-voltage service cores.
wall((11,-10),(11,-2.5));wall((11,-2.5),(18.4,-2.5));wall((11,-6),(18.4,-6))
for y in [-9.5,-5.5]:
 for x in [12.5,14.5,16.5]:
  wall((x,y),(x,y+2.5),2.25,.1);box('Sanitary fixture',(x+.6,y+1,.45),(.5,.65,.9),white)
for x in [3,5.7,8.5]:wall((x,-10),(x,-6.8))
wall((3,-6.8),(8.5,-6.8))
# OP room and maintenance / spares, per the supplied image.
wall((0,-13),(8.5,-13));wall((0,-26),(8.5,-26));wall((0,-32.5),(8.5,-32.5))
for ya,yb in [(-13,-15),(-16.5,-23),(-24.5,-28),(-29.5,-32.5)]:wall((8.5,ya),(8.5,yb))
# Glass access doors in explicit room openings.
C=coll('4F_03 | Doors and access control')
def door_x(x,y,width=1.6):
 box('Glazed access door',(x,y,1.15),(width,.045,2.3),glass)
 for xx in [x-width/2,x+width/2]:box('Door jamb',(xx,y,1.2),(.055,.09,2.4),silver)
 box('Door lintel',(x,y,2.35),(width+.1,.09,.1),silver);box('Badge reader',(x+width/2+.16,y-.07,1.35),(.1,.05,.16),black)
for x,y in [(-30.6,1.5),(-19.7,1.5),(-5,1.5),(-.7,1.5),(6.8,1.5),(-25.7,-.7),(-12.2,-.7),(-5,-.7)]:door_x(x,y)
for yy in [-15.75,-23.75,-28.75]:box('OP room access door',(8.5,yy,1.15),(.045,1.5,2.3),glass)
C=coll('4F_04 | Structural columns from DXF grid')
for y in [8.5,0,-9.5]:
 for x in [-39,-34,-25.5,-17,-8.5,0,8.5,17.2]:box('RC column',(x,y,1.8),(.8,.8,3.6),white)
for y in [-17.5,-25.5,-33]:
 for x in [0,8.5]:box('East wing RC column',(x,y,1.8),(.8,.8,3.6),white)
# Exact 11 + 22 server cabinet instances. Both are single east-west rows, matching diagram.
zoneinfo=[('A',11,-2.2,5.1,.8,cyan),('B',22,-25.5,-5.4,.6,green)]
for zone,count,x0,yy,width,accent in zoneinfo:
 C=coll(f'4F_10{zone} | Zone {zone} - {count} server racks')
 length=count*width
 for i in range(count):
  o=bpy.data.objects.new(f'4F-{zone}-{i+1:02d}',None);C.objects.link(o);o.instance_type='COLLECTION';o.instance_collection=asset;o.location=(x0+(i+.5)*width,yy,0);o.rotation_euler.z=math.pi/2;o.scale=(1,width/.8,1);o['Zone']=zone;o['Rack_number']=i+1;o['Dimensions_m']=f'{width} W x 1.2 D x 2.2 H'
  label('Rack ID',f'{zone}{i+1:02d}',(x0+i*width+.08,yy-.645,2.04),.095,rot=(math.pi/2,0,0))
 C=coll(f'4F_11{zone} | Zone {zone} - aisle busway cable baskets')
 box('Blue cold aisle',(x0+length/2,yy-1.5,.02),(length,1.75,.04),blue)
 # Row end portals and separate front/back service routing.
 for yoff,ma in [(-.33,yellow),(.33,orange)]:
  beam('A/B overhead busway',(x0,yy+yoff),(x0+length,yy+yoff),.15,.18,ma,3.0)
  for i in range(count):box('Tap off module',(x0+(i+.5)*width,yy+yoff,3.12),(.20,.25,.18),ma)
 for yoff in [-.45,.45]:beam('Basket edge',(x0,yy+yoff),(x0+length,yy+yoff),.025,.12,silver,2.72)
 for i in range(int(length/.3)+1):beam('Basket rung',(x0+i*.3,yy-.45),(x0+i*.3,yy+.45),.025,.025,silver,2.67)
 beam('Fibre tray',(x0,yy+.48),(x0+length,yy+.48),.06,.06,cyan,2.85)
 for xx in [x0+.3,x0+length/2,x0+length-.3]:
  box('Hanger rod',(xx,yy,3.31),(.025,.025,1.15),silver)
  for yoff in [-.65,.65]:box('Row end frame',(xx,yy+yoff,1.25),(.045,.045,2.5),silver)
 beam('Linear aisle LED',(x0,yy-1.5),(x0+length,yy-1.5),.05,.04,light,3.35)
 label(f'Zone {zone} floor label',f'ZONE {zone}   /   {count:02d} RACKS',(x0,yy-2.35,.05),.34,ma=textmat)
# End closures join each side of the rack row to the existing room walls.
# Prototype dimensions, not a coordinated fire / HVAC construction design.
for zone,count,x0,yy,width,accent in zoneinfo:
 C=coll(f'4F_12{zone} | Closed cold and hot aisles')
 length=count*width; south,north=({'A':(1.6,8.8),'B':(-9.9,-.8)})[zone]
 h=2.5; rail=.045
 def part(name,loc,size,ma):
  o=box(f'Containment {zone} | '+name,loc,size,ma);o['Containment']=zone;return o
 for side,lo,hi,color in [('COLD',south,yy-.65,blue),('HOT',yy+.65,north,orange)]:
  span=hi-lo; mid=(hi+lo)/2
  part(side+' floor strip',(x0+length/2,mid,.025),(length,span,.025),color)
  # Full transparent overhead closure with spaced supporting mullions.
  part(side+' glass roof',(x0+length/2,mid,h),(length,span,.025),contain_glass)
  for i in range(math.ceil(length/2)+1):
   x=x0+min(i*2,length)
   part(side+' roof crossbar',(x,mid,h),(.04,span,.05),silver)
  for y in [lo,hi]:part(side+' roof perimeter',(x0+length/2,y,h),(length,rail,.06),silver)
  for end,x in [('WEST',x0),('EAST',x0+length)]:
   # Centered paired door leaves, fixed glazed sidelights, and upper transom.
   doorw=1.4; dl=mid-doorw/2; dr=mid+doorw/2
   for a,b,name in [(lo,dl,'fixed left'),(dl,mid,'door left'),(mid,dr,'door right'),(dr,hi,'fixed right')]:
    part(f'{side} {end} {name} glass',(x,(a+b)/2,1.14),(.022,b-a-.025,2.24),contain_glass)
   part(f'{side} {end} glazed transom',(x,mid,2.395),(.022,span-.04,.16),contain_glass)
   for y in [lo,dl,mid,dr,hi]:part(side+' door jamb',(x,y,1.15),(.065,.04,2.3),silver)
   for z in [.035,2.29,h]:part(side+' door header',(x,mid,z),(.065,span,.045),silver)
   for y in [mid-.12,mid+.12]:part(side+' door pull',(x-.065,y,1.1),(.04,.025,.32),silver)
   part(side+' identification header',(x,mid,2.3),(.075,doorw,.08),color)
 # Seal the space over rack tops, keeping hot and cold volumes separate.
 part('rack overhead seal',(x0+length/2,yy,2.39),(length,1.3,.22),contain_glass)
scene['Aisle_containment']='A/B front cold and rear hot aisles: glazed end doors to room walls, transparent roofs; prototype dimensions.'
# Electrical room: power equipment is deliberately distinct from 33 IT racks.
C=coll('4F_20 | Electrical room - UPS batteries switchgear')
for group,x0 in enumerate([-38,-28,-18]):
 for i in range(7):
  x=x0+i*1.05
  box('Switchgear panel',(x,7.5,1.15),(.9,.65,2.3),white);box('Switchgear front',(x,7.155,1.2),(.79,.025,2.1),silver);box('Meter display',(x,7.13,1.7),(.25,.02,.18),black)
for group,x0 in enumerate([-37,-25,-13]):
 for i in range(5):
  x=x0+i*1.25;box('UPS cabinet',(x,4.8,1.1),(.95,.8,2.2),white);box('UPS front',(x,4.385,1.1),(.85,.025,2.05),door);box('UPS monitor',(x,4.365,1.65),(.3,.02,.2),cyan)
for x in [-30,-16]:
 for i in range(4):box('Battery cabinet',(x,2.5+i*.95,1.0),(.8,.8,2),white)
# Precision cooling at western service room and at each rack room perimeter.
C=coll('4F_21 | Cooling fire lighting - schematic')
for x,y in [(-32,-3),(-32,-6),(-32,-8.5),(-27.7,-7.5),(-9.6,-7.5),(-2.8,7.6),(7.2,7.6)]:
 box('Precision cooling CRAC',(x,y,1.1),(1.1,.75,2.2),white);box('CRAC intake',(x,y-.39,1.2),(.95,.025,1.65),door)
 for j in range(12):box('Intake louvre',(x,y-.415,.45+j*.13),(.90,.025,.025),silver)
for y in [8.1,-9.1]:beam('Fire main',(-39,y),(8,y),.07,.07,red,3.3)
for x in [-36,-28,-20,-12,-3,5]:
 beam('General light',(x,2.1),(x,7.8),.06,.035,light,3.45)
 box('Smoke sensor',(x,4,3.45),(.16,.16,.06),white)
for x in [-26,-20,-14]:beam('Zone B service light',(x,-2),(x,-8.5),.05,.035,light,3.45)
# Operations desk bank and maintenance shelving from user-designated rooms.
C=coll('4F_30 | OP room and maintenance furniture')
for y in [-17,-20,-23]:
 box('OP desk',(3,y,.77),(3.2,.9,.09),wood)
 for x in [2,3,4]:
  box('Operator monitor',(x,y+.25,1.2),(.85,.08,.48),black);box('Monitor screen',(x,y+.20,1.2),(.76,.015,.4),cyan);box('Chair seat',(x,y-1,.46),(.5,.5,.12),black);box('Chair back',(x,y-1.2,.8),(.5,.1,.6),black)
 for x in [1.6,4.4]:box('Desk leg',(x,y,.35),(.07,.6,.7),silver)
for x in [1,4,7]:
 for z in [.2,.8,1.4,2]:box('Spares shelf',(x,-31,z),(2,.6,.07),silver)
 for dx in [-.95,.95]:box('Shelf upright',(x+dx,-31,1.05),(.05,.65,2.1),silver)
 for z in [.4,1,1.6]:box('Spare equipment carton',(x,-31,z),(1.4,.5,.3),concrete)
box('Maintenance workbench',(3,-28.2,.85),(3.4,1.2,.12),wood)
for x in [1.7,4.3]:box('Workbench leg',(x,-28.2,.4),(.1,1,.8),silver)
# Wayfinding and source status.
C=coll('4F_40 | Zone labels and wayfinding')
for s,x,y,size,ma in [('電力室 / POWER',-29,3,.7,concrete),('A 區 / ZONE A',-1,2.5,.45,cyan),('B 區 / ZONE B',-25,-2.6,.6,green),('管道間',-6.8,-3.5,.5,concrete),('OP 室',1.5,-14.5,.6,concrete),('維修 / 備品間',.8,-27.2,.42,concrete)]:label(s,s,(x,y,.035),size,ma)
for s,loc in [('ZONE A  |  11 RACKS',(-2,8.75,2.7)),('ZONE B  |  22 RACKS',(-26,-.82,2.7))]:label(s,s,loc,.35,rot=(math.pi/2,0,0))
C=coll('4F_90 | Original DXF reference - hidden');C.hide_render=True;C.hide_viewport=True
D=json.load(open(os.path.join(ROOT,'output','4F_base.json')));cu=bpy.data.curves.new('4F DXF centimetres to metres','CURVE');cu.dimensions='3D';cu.bevel_depth=.01;cu.bevel_resolution=0
for pts in D['lines']:
 if len(pts)>1000 or not all(-4100<p[0]<1900 and -3350<p[1]<1000 for p in pts):continue
 sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
 for q,p in zip(sp.points,pts):q.co=(p[0]*.01,p[1]*.01,.025,1)
o=bpy.data.objects.new('DXF 4F selected region',cu);C.objects.link(o);cu.materials.append(cyan)
# Pack the user supplied configuration image for tracing review inside Blender.
for n,path in [('SOURCE - 4F A11 B22','/var/folders/rf/2czkt0593dlgncmj0q7hzmww0000gn/T/codex-clipboard-1e4160fd-7ae8-4ccb-a9db-e714ec455602.png'),('SOURCE - 4F marked area','/var/folders/rf/2czkt0593dlgncmj0q7hzmww0000gn/T/codex-clipboard-a2d76312-607f-4ce7-93b7-f9aa08b8a7ab.png')]:
 im=bpy.data.images.load(path);im.name=n;im.pack()
C=coll('4F_80 | Studio lighting and cameras')
world=bpy.data.worlds.new('4F Studio');world.use_nodes=True;bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.13,.18,.24,1);bg.inputs[1].default_value=.65;scene.world=world
area('North softbox',(-20,0,25),14000,25,(-15,0,0));area('East fill',(15,-15,20),8000,20,(-8,-10,0));area('Zone B fill',(-19,-5,7),1200,10,(-19,-5,0));area('Zone A fill',(2,5,7),600,7,(2,5,0))
overview=camera('01 | 4F selected area overview',(-62,-72,67),(-10,-10,0),80)
plan=camera('02 | 4F plan',(-10,-12,100),(-10,-12,0),66)
hero=camera('03 | Zone B detail',(-28.5,-12,7.5),(-19,-5.4,1),None);hero.data.lens=28
ac=camera('04 | Zone A detail',(-3,-1,8),(2,5,1),None);ac.data.lens=26
scene.camera=overview;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
for s in list(bpy.data.scenes):
 if s!=scene:bpy.data.scenes.remove(s)
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA';a.spaces.active.clip_end=500
readme='''4F 資料中心模型｜確認範圍 A 區 11 櫃、B 區 22 櫃

本檔僅含 4F 一個場景，沒有 2F、3F 或其他樓層。
建模區域為使用者標示的上側機房及右側 OP、維修／備品間，未建模未指定的南翼。
以 DXF 4F 建築輪廓／柱距為尺度依據，依新提供的配置截圖重建電力室、A 區、B 區、管道間、OP 室、維修／備品間的相對位置。
A 區 11 個，物件名 4F-A-01～11；B 區 22 個，4F-B-01～22，共 33 個 IT 機櫃。電力室電源櫃／電池櫃不列入 IT 櫃數。
兩區依截圖呈現東西向單列機櫃；不是前版的 84 櫃多排配置。
A 暫用 800 寬、B 暫用 600 寬，兩區深 1200、高 2200 mm，依圖面相對尺度估算，實際型號待確認。
建築高度暫設 3.6 m，樓板 0.35 m，DXF 1 單位依柱距／門寬解讀為 1 cm（標頭標為 mm，存在不一致）。
原始 DXF 不含這張圖的新機房隔間配置；截圖沒有可讀尺寸，新隔間及機櫃位置為比例對位，非測量／施工精度。
黃色與橙色雙路母線、銀色線槽、青色資料線路、藍色冷通道、深色機櫃依渲染參考建模。機電、空調、消防容量與路徑是視覺示意。
樓梯／衛浴／門窗簡化，無天花板以便俯視。冷、熱通道兩端以玻璃雙扇門與固定隔板接至牆面，上方透明封板；封閉高度暫設 2.5 m、雙扇門總寬 1.4 m，屬 Prototype 示意，非施工氣流／消防設計。
原始配置截圖已內嵌在 Blender 的 Images，4F_90 集合可開啟 CAD 線稿核對。
四台相機：全區總覽、平面、B 區近景、A 區近景。所有材質內建，無外部貼圖依賴。
生成腳本：scripts/build_4f.py；舊 2F、3F 模型為已撤回草稿，不是此版交付。
'''
open(os.path.join(OUT,'模型說明.txt'),'w').write(readme);t=bpy.data.texts.new('READ ME - 4F 模型說明');t.write(readme)
counts={z:len([o for o in scene.objects if o.get('Zone')==z]) for z in ['A','B']};assert counts=={'A':11,'B':22};assert len(bpy.data.scenes)==1
scene['Rack_count']=33
# Keep reference-driven overhead services reproducible in full rebuilds.
import runpy
runpy.run_path(os.path.join(ROOT,'scripts','upgrade_overhead.py'))['upgrade']()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'AIDC_4F_A11_B22.blend'))
json.dump({'scenes':[scene.name],'rack_counts':counts,'IT_total':33,'objects':len(scene.objects),'source_images_packed':2},open(os.path.join(OUT,'validation.json'),'w'),indent=2)
for cam,suffix in ([] if os.environ.get('SKIP_RENDERS') else [(overview,'overview'),(plan,'plan'),(hero,'zone_B'),(ac,'zone_A')]):
 scene.camera=cam;scene.render.filepath=os.path.join(OUT,'previews','4F_'+suffix+'.png');bpy.ops.render.render(write_still=True)
print('4F COMPLETE',counts)
