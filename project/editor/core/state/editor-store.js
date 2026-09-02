import { lifecycleDiagnostics as diagnostics } from '../diagnostics/lifecycle-diagnostics.js';
import { createProjectDocument, PROJECT_DOMAINS, PROJECT_DOCUMENT_FIELDS } from './project-document.js';
import { createEditorSession } from './editor-session.js';

const clone = value => structuredClone(value);
const domainFields = domain => PROJECT_DOMAINS[domain] || [];

export function createEditorStore(initial = {}) {
  let document = createProjectDocument(initial), session = createEditorSession(initial);
  let persistentRevision = 0, versionToken = Symbol('document-version');
  const revisions = Object.fromEntries(Object.keys(PROJECT_DOMAINS).map(key => [key, 0]));
  const documentListeners = new Map(Object.keys(PROJECT_DOMAINS).map(key => [key, new Set()]));
  const sessionListeners = new Map(); const legacyListeners = new Set();
  let facade = { ...document, ...session };
  const refresh = () => { facade = { ...document, ...session }; };
  const notifyDocument = domains => { for (const domain of domains) for (const fn of documentListeners.get(domain) || []) { diagnostics.increment('store.documentNotifications'); fn(document, domain); } for (const fn of legacyListeners) fn(facade); };
  const notifySession = keys => { for (const key of keys) for (const fn of sessionListeners.get(key) || []) { diagnostics.increment('store.sessionNotifications'); fn(session, key); } for (const fn of legacyListeners) fn(facade); };
  function mutateDocument({ type='document/mutate', domains, source='editor', apply, version } = {}) {
    if (!domains?.length || typeof apply !== 'function') throw new Error('Document mutation requires explicit domains and apply');
    const next = { ...document }; for (const domain of domains) for (const field of domainFields(domain)) next[field] = clone(document[field]);
    apply(next); document = next; persistentRevision++; versionToken = version || Symbol(`${type}:${source}`);
    for (const domain of domains) revisions[domain]++;
    diagnostics.increment('store.documentMutations'); refresh(); notifyDocument([...new Set(domains)]); return document;
  }
  function mutateSession(keys, apply) {
    if (typeof keys === 'string') keys = [keys];
    const next = { ...session, animationEditor: { ...session.animationEditor } }; apply(next); session = createEditorSession(next);
    diagnostics.increment('store.sessionMutations'); refresh(); notifySession(keys); return session;
  }
  return {
    getDocument:()=>document, getSession:()=>session, mutateDocument, mutateSession,
    execute(command){ return mutateDocument(command); },
    replaceDocument(next,{version=Symbol('document-replacement')}={}) { document=createProjectDocument(next);versionToken=version;persistentRevision++;for(const key of Object.keys(revisions))revisions[key]++;refresh();diagnostics.increment('store.documentMutations');notifyDocument(Object.keys(revisions)); },
    replaceSession(next){session=createEditorSession(next);refresh();diagnostics.increment('store.sessionMutations');notifySession(Object.keys(session));},
    replaceProject(nextDocument,nextSession={},options={}){document=createProjectDocument(nextDocument);session=createEditorSession(nextSession);versionToken=options.version||Symbol(`project-replacement:${options.source||'unknown'}`);persistentRevision++;for(const key of Object.keys(revisions))revisions[key]++;refresh();diagnostics.increment('store.documentMutations');diagnostics.increment('store.sessionMutations');notifyDocument(Object.keys(revisions));notifySession(Object.keys(session));},
    subscribeDocument(domain,fn){documentListeners.get(domain)?.add(fn);return()=>documentListeners.get(domain)?.delete(fn);},
    subscribeSession(key,fn){if(!sessionListeners.has(key))sessionListeners.set(key,new Set());sessionListeners.get(key).add(fn);return()=>sessionListeners.get(key).delete(fn);},
    getPersistentRevision:()=>persistentRevision,getDomainRevision:domain=>revisions[domain],getDomainRevisions:()=>({...revisions}),getDocumentVersionToken:()=>versionToken,
    // Compatibility facade. New and frame-sensitive code must use the APIs above.
    getState:()=>facade,
    setState(recipe){
      diagnostics.increment('store.legacySetState');diagnostics.increment('store.wholeDocumentMutationClones');
      const draft=clone(facade), touched=new Set(), proxies=new WeakMap();
      const track=(value,root)=>{if(!value||typeof value!=='object')return value;if(proxies.has(value))return proxies.get(value);const proxy=new Proxy(value,{get(target,key){return track(target[key],root??key);},set(target,key,next){touched.add(root??key);target[key]=next;return true;},deleteProperty(target,key){touched.add(root??key);delete target[key];return true;}});proxies.set(value,proxy);return proxy;};
      recipe(track(draft,null));
      const domains=Object.entries(PROJECT_DOMAINS).filter(([,fields])=>fields.some(field=>touched.has(field))).map(([domain])=>domain);
      const sessionKeys=[...touched].filter(key=>!PROJECT_DOCUMENT_FIELDS.includes(key));
      if(domains.length){document=createProjectDocument(draft);persistentRevision++;versionToken=Symbol('legacy-setState');for(const key of domains)revisions[key]++;diagnostics.increment('store.documentMutations');}
      if(sessionKeys.length){session=createEditorSession(draft);diagnostics.increment('store.sessionMutations');}
      refresh();if(domains.length)notifyDocument(domains);if(sessionKeys.length)notifySession(sessionKeys);
    },
    // Deprecated flat-state adapter. It explicitly splits legacy input at the
    // compatibility boundary; normal project creation/loading uses replaceProject.
    replaceState(next){this.replaceProject(createProjectDocument(next),createEditorSession(next),{source:'legacy-replaceState'});}, subscribe(fn){legacyListeners.add(fn);return()=>legacyListeners.delete(fn);},
    restoreDocument(next,token){document=createProjectDocument(next);versionToken=token;persistentRevision++;for(const key of Object.keys(revisions))revisions[key]++;refresh();notifyDocument(Object.keys(revisions));},
    diagnostics:()=>({persistentRevision,domain:{...revisions}})
  };
}
