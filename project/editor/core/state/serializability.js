import { PROJECT_DOCUMENT_FIELDS } from './project-document.js';

const tag = value => Object.prototype.toString.call(value);

/** Return actionable violations without mutating or normalizing authored data. */
export function inspectProjectDocument(document) {
  const issues=[];
  const visit=(value,path,seen)=>{
    if(typeof value==='function'||typeof value==='symbol') { issues.push({path,type:typeof value});return; }
    if(value===null||typeof value!=='object')return;
    if(seen.has(value)) { issues.push({path,type:'circular reference'});return; }
    seen.add(value);
    const prototype=Object.getPrototypeOf(value);
    if(!Array.isArray(value)&&prototype!==Object.prototype&&prototype!==null)issues.push({path,type:value.constructor?.name||tag(value)});
    try { for(const key of Reflect.ownKeys(value))visit(value[key],`${path}.${String(key)}`,seen); }
    catch(error) { issues.push({path,type:`uninspectable ${tag(value)}`,message:error.message}); }
    seen.delete(value);
  };
  for(const field of PROJECT_DOCUMENT_FIELDS)visit(document[field],field,new WeakSet());
  try { structuredClone(document); }
  catch(error) { issues.push({path:'<document>',type:error.name,message:error.message}); }
  return issues;
}

export function assertSerializableProjectDocument(document) {
  const issues=inspectProjectDocument(document);
  if(issues.length)throw new TypeError(`ProjectDocument must contain plain serializable data: ${issues.map(issue=>`${issue.path} (${issue.type})`).join(', ')}`);
  return document;
}
