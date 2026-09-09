#!/usr/bin/env python3
# Import gate: this file is also used to trigger the official BodyParts3D workflow.
import argparse,gzip,hashlib,json
from pathlib import Path
ATTR='BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International'
def main():
 p=argparse.ArgumentParser();p.add_argument('--models',type=Path,default=Path('public/models'));p.add_argument('--expected-parts',type=int,default=2234);a=p.parse_args();atlas=json.loads((a.models/'atlas.json').read_text());src=json.loads((a.models/'source.json').read_text());assert atlas['version']=='BodyParts3D 4.0';assert atlas['license']=='CC BY 4.0';assert atlas['attribution']==ATTR;assert src['attribution']==ATTR;assert len(atlas['parts'])==a.expected_parts;ids=[x['id'] for x in atlas['parts']];assert len(ids)==len(set(ids));assert all(x['name'] and x['vertexCount']>0 and x['indexCount']>=3 and x['indexCount']%3==0 for x in atlas['parts']);sizes={}
 for i,c in enumerate(atlas['chunks']):
  f=a.models/Path(c['url']).name;assert f.exists();assert hashlib.sha256(f.read_bytes()).hexdigest()==c['sha256'];raw=gzip.decompress(f.read_bytes());assert len(raw)==c['bytes'];sizes[i]=len(raw)
 for x in atlas['parts']:
  s=sizes[x['chunk']];assert x['positions']+x['vertexCount']*12<=s;assert x['normals']+x['vertexCount']*6<=s;assert x['indices']+x['indexCount']*4<=s
 coverage=sum(bool(x.get('conceptId')) for x in atlas['parts'])/len(atlas['parts']);assert coverage>=.9,coverage;assert atlas['triangles']>100000;print(json.dumps({'verified':True,'parts':len(atlas['parts']),'conceptCoverage':round(coverage,4),'triangles':atlas['triangles'],'chunks':len(atlas['chunks'])},indent=2))
if __name__=='__main__':main()
