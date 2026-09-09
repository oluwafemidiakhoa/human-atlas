#!/usr/bin/env python3
import argparse,csv,gzip,hashlib,json,math,re,sys,zipfile
from array import array
from collections import defaultdict
from pathlib import Path

ATTR='BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International'
SYS={'skeletal':'#d8cfb6','muscular':'#a85b50','arterial':'#b95345','venous':'#527c9f','nervous':'#d8b565','respiratory':'#b98991','digestive':'#b8916b','urinary':'#88738f','reproductive':'#bda098','lymphatic':'#879f7c','endocrine':'#c5a09a','sensory':'#91aeb2','cardiac':'#9d4f45','connective':'#aec3bb','integumentary':'#ba9b7d','other':'#9da5a3'}
KW=[('cardiac',['heart','ventricle','atrium','cardiac valve']),('arterial',['artery','aorta']),('venous',['vein','vena cava']),('nervous',['nerve','brain','spinal cord','ganglion','plexus','cerebell','medulla','pons']),('skeletal',['bone','vertebra','rib','femur','tibia','fibula','humerus','radius','ulna','skull','mandible','maxilla','sternum','sacrum','coccyx','patella','carpal','tarsal','metacarp','metatars','phalan','scapula','clavicle']),('muscular',['muscle','diaphragm']),('respiratory',['lung','bronch','trachea','larynx','alveol']),('digestive',['stomach','intestin','colon','rectum','esophagus','liver','gallbladder','pancreas','duodenum','jejun','ileum','bile duct']),('urinary',['kidney','ureter','bladder','urethra']),('reproductive',['testis','prostate','penis','seminal','epididym','spermatic']),('lymphatic',['lymph','spleen','thymus','tonsil']),('endocrine',['adrenal','pituitary','thyroid','parathyroid','pineal']),('sensory',['eye','retina','optic','ear','cochlea','vestib','lens','cornea']),('integumentary',['skin']),('connective',['cartilage','ligament','tendon','fascia'])]

def rows(p):
 with open(p,encoding='utf-8-sig',errors='replace',newline='') as f:return [[c.strip() for c in r] for r in csv.reader(f,delimiter='\t') if r]
def h(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def arr(vals,code):
 a=array(code,vals)
 if sys.byteorder!='little':a.byteswap()
 return a.tobytes()
def meta(parts,rels,elems):
 C={}; parent={}; child=defaultdict(list); E=defaultdict(list)
 for r in rows(parts)[1:]:
  if len(r)>=3:C[r[0]]={'id':r[0],'representationId':r[1],'name':r[2],'elements':[]}
 for r in rows(rels)[1:]:
  if len(r)>=4:parent[r[2]]=r[0];child[r[0]].append(r[2]);C.setdefault(r[0],{'id':r[0],'representationId':'','name':r[1],'elements':[]});C.setdefault(r[2],{'id':r[2],'representationId':'','name':r[3],'elements':[]})
 for r in rows(elems)[1:]:
  if len(r)>=3:C.setdefault(r[0],{'id':r[0],'representationId':'','name':r[1],'elements':[]})['elements'].append(r[2]);E[r[2].upper()].append(r[0])
 D={}
 def depth(x,seen=None):
  if x in D:return D[x]
  seen=set() if seen is None else seen
  if x in seen:return 0
  seen.add(x);D[x]=0 if x not in parent else depth(parent[x],seen)+1;return D[x]
 def choose(e):return max(E.get(e.upper(),[]),key=lambda x:depth(x),default=None)
 def lineage(cid):
  out=[];seen=set()
  while cid and cid not in seen:seen.add(cid);out.append(C.get(cid,{}).get('name',''));cid=parent.get(cid)
  return out
 concepts=[dict(v,parentId=parent.get(k),children=child.get(k,[])) for k,v in sorted(C.items())]
 return concepts,choose,lineage

def system(name,line):
 s=' | '.join([name,*line]).lower()
 for k,words in KW:
  if any(w in s for w in words):return k
 return 'other'
def scan_bounds(z,members):
 lo=[1e9]*3;hi=[-1e9]*3
 for m in members:
  for b in z.open(m):
   if b.startswith(b'v '):
    q=b.decode('ascii','ignore').split();x,y,z0=map(float,q[1:4]);p=(x*.001,z0*.001,-y*.001)
    for i in range(3):lo[i]=min(lo[i],p[i]);hi[i]=max(hi[i],p[i])
 return lo,hi
def parse_obj(txt,raw):
 pos=[];norm=[];faces=[];name='';lo,hi=raw;cx=(lo[0]+hi[0])/2;cz=(lo[2]+hi[2])/2
 for ln in txt.splitlines():
  if ln.startswith('#') and 'english name' in ln.lower() and ':' in ln:name=ln.split(':',1)[1].strip()
  elif ln.startswith('v '):x,y,z=map(float,ln.split()[1:4]);pos.append((x*.001-cx,z*.001-lo[1],-y*.001-cz))
  elif ln.startswith('vn '):x,y,z=map(float,ln.split()[1:4]);n=(x,z,-y);L=math.sqrt(sum(v*v for v in n)) or 1;norm.append(tuple(v/L for v in n))
  elif ln.startswith('f '):
   f=[]
   for tok in ln.split()[1:]:
    q=tok.split('/');vi=int(q[0]);vi=vi-1 if vi>0 else len(pos)+vi;ni=None
    if len(q)>2 and q[2]:ni=int(q[2]);ni=ni-1 if ni>0 else len(norm)+ni
    f.append((vi,ni))
   faces.append(f)
 have=bool(norm) and any(n is not None for f in faces for _,n in f);mp={};P=[];N=[];I=[]
 def V(ref):
  key=ref if have else (ref[0],None)
  if key in mp:return mp[key]
  i=len(P)//3;mp[key]=i;P.extend(pos[ref[0]]);n=norm[ref[1]] if have and ref[1] is not None else (0,0,0);N.extend(n);return i
 for f in faces:
  ff=[V(r) for r in f]
  for j in range(1,len(ff)-1):I.extend((ff[0],ff[j],ff[j+1]))
 if not have:
  A=[0.0]*len(P)
  for k in range(0,len(I),3):
   ia,ib,ic=I[k:k+3];a=P[3*ia:3*ia+3];b=P[3*ib:3*ib+3];c=P[3*ic:3*ic+3];u=[b[j]-a[j] for j in range(3)];v=[c[j]-a[j] for j in range(3)];n=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
   for ii in (ia,ib,ic):
    for j in range(3):A[3*ii+j]+=n[j]
  N=[]
  for k in range(0,len(A),3):q=A[k:k+3];L=math.sqrt(sum(v*v for v in q)) or 1;N.extend(v/L for v in q)
 b=[[min(P[i::3]) for i in range(3)],[max(P[i::3]) for i in range(3)]]
 return name,P,N,I,b
def region(c,B):
 lo,hi=B;y=(c[1]-lo[1])/(hi[1]-lo[1]);x=abs(c[0]-(lo[0]+hi[0])/2)/(hi[0]-lo[0])
 return 'head & neck' if y>=.79 else 'upper limb' if x>.30 and .34<=y<.78 else 'thorax' if y>=.56 else 'abdomen' if y>=.39 else 'pelvis' if y>=.29 else 'lower limb'

def main():
 a=argparse.ArgumentParser();a.add_argument('--archive',required=True);a.add_argument('--isa-parts',required=True);a.add_argument('--isa-relations',required=True);a.add_argument('--isa-elements',required=True);a.add_argument('--out',default='public/models');a.add_argument('--expected-parts',type=int,default=2234);A=a.parse_args();out=Path(A.out);out.mkdir(parents=True,exist_ok=True)
 concepts,choose,lineage=meta(A.isa_parts,A.isa_relations,A.isa_elements);CB={c['id']:c for c in concepts}
 with zipfile.ZipFile(A.archive) as z:
  members=sorted(m for m in z.namelist() if m.lower().endswith('.obj'));assert len(members)==A.expected_parts,(len(members),A.expected_parts);raw=scan_bounds(z,members);lo,hi=raw;B=[[-(hi[0]-lo[0])/2,0,-(hi[2]-lo[2])/2],[(hi[0]-lo[0])/2,hi[1]-lo[1],(hi[2]-lo[2])/2]];parts=[];chunks=[];stats=defaultdict(lambda:{'parts':0,'vertices':0,'indices':0});blob=bytearray();ci=0;tri=0
  def flush():
   nonlocal blob,ci
   if not blob:return
   fn=out/f'body-{ci}.bin.gz';fn.write_bytes(gzip.compress(bytes(blob),compresslevel=9,mtime=0));chunks.append({'url':f'/models/{fn.name}','bytes':len(blob),'gzipBytes':fn.stat().st_size,'sha256':h(fn)});ci+=1;blob=bytearray()
  for n,m in enumerate(members,1):
   eid=(re.search(r'FJ\d+',Path(m).stem,re.I).group(0) if re.search(r'FJ\d+',Path(m).stem,re.I) else Path(m).stem).upper();nm,P,N,I,b=parse_obj(z.read(m).decode('utf-8','replace'),raw);cid=choose(eid);nm=nm or CB.get(cid,{}).get('name') or eid;sysid=system(nm,lineage(cid));c=[(b[0][i]+b[1][i])/2 for i in range(3)];pb=arr(P,'f');nb=arr([max(-32767,min(32767,round(x*32767))) for x in N],'h');ib=arr(I,'I')
   if blob and len(blob)+len(pb)+len(nb)+len(ib)>6_000_000:flush()
   def add(x):
    while len(blob)%4:blob.append(0)
    o=len(blob);blob.extend(x);return o
   po,no,io=add(pb),add(nb),add(ib);p={'id':eid,'name':nm,'conceptId':cid,'system':sysid,'region':region(c,B),'chunk':ci,'positions':po,'normals':no,'indices':io,'vertexCount':len(P)//3,'indexCount':len(I),'bounds':b};parts.append(p);tri+=len(I)//3;s=stats[sysid];s['parts']+=1;s['vertices']+=p['vertexCount'];s['indices']+=p['indexCount']
   if n%100==0:print(f'{n}/{len(members)}')
  flush()
 atlas={'version':'BodyParts3D 4.0','sex':'male','scope':'adult human male reference anatomy','source':'BodyParts3D','license':'CC BY 4.0','attribution':ATTR,'parts':parts,'concepts':concepts,'chunks':chunks,'triangles':tri,'bounds':B,'systemColors':SYS,'systemStats':dict(stats),'classification':{'system':'Human Atlas heuristic v1; not an official BodyParts3D field','region':'Human Atlas geometric heuristic v1; not an official BodyParts3D field'}}; (out/'atlas.json').write_text(json.dumps(atlas,separators=(',',':')),encoding='utf-8');(out/'source.json').write_text(json.dumps({'dataset':'BodyParts3D','release':'4.0','modelCount':len(parts),'archiveSha256':h(A.archive),'license':'Creative Commons Attribution 4.0 International','attribution':ATTR,'licensePage':'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html','downloadPage':'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html','transform':'millimetres/Z-up -> metres/Y-up; centered X/Z; grounded Y=0'},indent=2),encoding='utf-8');print(json.dumps({'parts':len(parts),'triangles':tri,'chunks':len(chunks),'bytes':sum(c['gzipBytes'] for c in chunks)},indent=2))
if __name__=='__main__':main()
