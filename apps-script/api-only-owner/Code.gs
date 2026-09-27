/* API-only CXL Owner bridge. Generated from the GO 6A storage contract. Do not add Owner UI functions here. */
var PRIVATE_HEADERS = ['id','title','category','status','visibility','is_public','deleted_at','folder_id','tags','updated_at','revision','file_id','has_collab_draft','media_count','cover_ref','create_request_id','user_id','created_at','summary_json','summary_version','search_version','search_chunk_count','search_index_token'];
var OWNER_SEARCH_SHEET_ = 'OwnerSearchIndex';
var OWNER_SEARCH_HEADERS_ = ['work_id','chunk_index','search_text','search_version','updated_at','index_token'];
var PUBLIC_HEADERS = ['id','title','category','status','updated_at','tags','short_description','file_id','active','cover_ref','summary_json'];
var PUBLIC_SUMMARY_VERSION = 2;
var PUBLIC_SUMMARY_MAX_CHARS = 45000;
var PRIVATE_SUMMARY_VERSION = 1;
var PRIVATE_SUMMARY_MAX_CHARS = 45000;
var OWNER_SEARCH_VERSION_ = 1;
var OWNER_SEARCH_CHUNK_CHARS_ = 30000;
var OWNER_SEARCH_MAX_QUERY_CHARS_ = 256;
var OWNER_SEARCH_OVERLAP_CHARS_ = OWNER_SEARCH_MAX_QUERY_CHARS_ - 1;
var PUBLIC_SUMMARY_ASSET_FIELDS = ['id','title','authorName','category','shortDescription','contentTypeLabels','contentTypes','presentationMetadata','publicCollaboration','collaborationAssetId','icon','content','contentBlocks','uiCodeSnippet','previewImage','previewImages','media','folderId','isPublic','visibility','status','tags','createdAt','updatedAt','deletedAt','likesCount','forkedFromAuthor','versions'];
var CXL_WRITE_FIELDS_=['authorName','authorAvatar','title','icon','category','shortDescription','contentTypeLabels','contentTypes','presentationMetadata','publicCollaboration','collaborationAssetId','contentBlocks','content','uiCodeSnippet','previewImage','previewImages','folderId','isPublic','visibility','status','tags','linkedAssetIds','deletedAt','likesCount','forkCount','forkedFromId','forkedFromAuthor','versions','media','collaboration'];
var API_OWNER_ACTIONS_ = ['works.fetch','folders.fetch','works.create','works.update',
  'media.upload.begin','media.upload.chunk','media.upload.finalize',
  'media.poc.begin','media.poc.chunk','media.poc.finalize','media.poc.setPublic',
  'media.poc.ownerChunk','media.poc.publicChunk','media.poc.readDiagnostics','media.poc.cleanup'];
var API_MAX_POST_CHARS_ = 5000000;
var OWNER_TIMING_PHASES_ = ['auth_request_validation','existing_work_index_lookup','canonical_drive_json_read','revision_idempotency_validation','write_payload_prepare','search_artifact_generation','search_chunk_write','stale_search_cleanup','drive_revision_write','private_index_update','private_public_transition','public_projection_sync','response_construction','owner_index_read','owner_search_index_read','summary_parse_projection','folders_drive_read','folders_projection','script_lock_wait','locked_revision_read','chunk_receive','chunk_persist','finalize_lookup','final_assembly','checksum_validation','binary_validation','canonical_drive_write','owner_media_read','public_media_authorization','public_media_read','staging_cleanup','total'];
var API_TIMING_CONTEXT_ = null;
var MEDIA_POC_CHUNK_BYTES_ = 2 * 1024 * 1024;
var MEDIA_POC_MAX_BYTES_ = 10 * 1024 * 1024;
var MEDIA_POC_MAX_CLEANUP_SESSIONS_ = 5;
var MEDIA_POC_SESSION_PREFIX_ = 'CXL_MEDIA_POC_SESSION_';
var MEDIA_POC_MANIFEST_PREFIX_ = 'CXL_MEDIA_POC_MEDIA_';
var MEDIA_POC_LAST_READ_DIAGNOSTIC_PROPERTY_ = 'CXL_MEDIA_POC_LAST_READ_DIAGNOSTIC';
var MEDIA_POC_READ_DIAGNOSTIC_MAX_CHARS_ = 2048;
var MEDIA_POC_ALLOWED_MIME_ = ['image/jpeg','image/png','image/webp','image/gif'];
var CXL_WORK_MEDIA_CHUNK_BYTES_ = 2 * 1024 * 1024;
var CXL_WORK_MEDIA_MAX_BYTES_ = 10 * 1024 * 1024;
var CXL_WORK_MEDIA_SESSION_PREFIX_ = 'CXL_WORK_MEDIA_UPLOAD_SESSION_';
var CXL_WORK_MEDIA_INDEX_PREFIX_ = 'CXL_WORK_MEDIA_UPLOAD_INDEX_';
var CXL_WORK_MEDIA_MANIFEST_PREFIX_ = 'CXL_WORK_MEDIA_MANIFEST_';
var MEDIA_POC_READ_ACTIONS_ = ['media.poc.ownerChunk','media.poc.publicChunk'];
var MEDIA_POC_READ_PHASES_ = ['request_received','manifest_validated','oauth_token_started','oauth_token_acquired','oauth_token_failed',
  'drive_fetch_started','drive_fetch_failed','drive_fetch_completed','drive_range_validated','response_constructed','read_failed'];
var MEDIA_POC_READ_FAILURE_CLASSES_ = ['authorization_required','external_request_permission','invalid_request_options',
  'url_fetch_runtime_failure','unknown_fetch_exception'];
var MEDIA_POC_READ_ERROR_CODES_ = ['INVALID_MEDIA_POC_REQUEST','MEDIA_POC_STATE_INVALID','MEDIA_POC_MEDIA_NOT_FOUND',
  'MEDIA_POC_MEDIA_NOT_PUBLIC','MEDIA_POC_MEDIA_INVALID','MEDIA_POC_MEDIA_READ_FAILED'];
var MEDIA_POC_READ_TRACE_ = null;

function doGet() {
  return apiJson_({ok:false,error:'Method not allowed',code:'METHOD_NOT_ALLOWED',httpStatus:405});
}
function doPost(e) {
  API_TIMING_CONTEXT_=null;
  MEDIA_POC_READ_TRACE_=null;
  var requestStarted=Date.now();
  var raw=e&&e.postData&&typeof e.postData.contents==='string'?e.postData.contents:'';
  var body;
  try { if(!raw||raw.length>API_MAX_POST_CHARS_)throw new Error('invalid body'); body=JSON.parse(raw); }
  catch(_error) { return apiJson_({ok:false,error:'Malformed JSON request',code:'INVALID_JSON',httpStatus:400}); }

  var expected=props_().getProperty('CXL_API_SHARED_SECRET')||'';
  var supplied=body&&typeof body.authorization==='string'?body.authorization:'';
  if(!expected||!apiSecretMatches_(supplied,expected))
    return apiJson_({ok:false,error:'Unauthorized',code:'OWNER_API_UNAUTHORIZED',httpStatus:401});

  var configuredOwner=props_().getProperty('CXL_OWNER_USER_ID')||'';
  if(!configuredOwner||!body||String(body.ownerUserId||'')!==configuredOwner)
    return apiJson_({ok:false,error:'Unauthorized',code:'OWNER_API_UNAUTHORIZED',httpStatus:401});
  if(!body||typeof body.action!=='string'||!Array.isArray(body.args))
    return apiJson_({ok:false,error:'Invalid request',code:'INVALID_REQUEST',httpStatus:400});
  if(API_OWNER_ACTIONS_.indexOf(body.action)<0)
    return apiJson_({ok:false,error:'Unsupported owner API action',code:'UNSUPPORTED_ACTION',httpStatus:400});

  if(body.includeTiming===true)API_TIMING_CONTEXT_={action:body.action,startedAt:requestStarted,phases:{}};
  ownerTimingPhase_('auth_request_validation',Date.now()-requestStarted);
  if(mediaPocIsReadAction_(body.action))mediaPocReadTraceStart_(body.action);

  try {
    var args=body.args;
    if(mediaPocIsReadAction_(body.action))mediaPocReadLog_(body.action,'request_received',{
      chunkIndex:mediaPocSafeChunkIndex_(args[0]),durationMs:Date.now()-requestStarted
    });
    if(body.action==='works.fetch') {
      if(args.length>1)return apiJson_({ok:false,error:'Invalid works.fetch request',code:'INVALID_REQUEST',httpStatus:400});
      return apiJson_({ok:true,data:fetchCxlWorks_(args[0]||{})});
    }
    if(body.action==='folders.fetch') {
      if(args.length)return apiJson_({ok:false,error:'Invalid folders.fetch request',code:'INVALID_REQUEST',httpStatus:400});
      return apiJson_({ok:true,data:{data:cxlOwnerFolders_(configuredOwner),error:null}});
    }
    if(body.action==='works.create'&&args.length===2)
      return apiJson_({ok:true,data:saveCxlWorkApi_('create',args[0],args[1],configuredOwner)});
    if(body.action==='works.update'&&args.length===3)
      return apiJson_({ok:true,data:saveCxlWorkApi_('update',{id:args[0],updates:args[1]},args[2],configuredOwner)});
    if(body.action.indexOf('media.upload.')===0) {
      return apiJson_({ok:true,data:mediaWorkUploadDispatch_(body.action,args,configuredOwner)});
    }
    if(body.action.indexOf('media.poc.')===0) {
      var mediaResult=mediaPocDispatch_(body.action,args,configuredOwner);
      var mediaOutput=apiJson_({ok:true,data:mediaResult});
      if(mediaPocIsReadAction_(body.action))mediaPocReadLog_(body.action,'response_constructed',{
        chunkIndex:mediaPocSafeChunkIndex_(args[0]),durationMs:Date.now()-requestStarted
      });
      return mediaOutput;
    }
    return apiJson_({ok:false,error:'Invalid action arguments',code:'INVALID_REQUEST',httpStatus:400});
  } catch(error) {
    if(body&&mediaPocIsReadAction_(body.action))mediaPocReadLog_(body.action,'read_failed',{
      code:mediaPocSafeReadCode_(error),chunkIndex:mediaPocSafeChunkIndex_(body.args&&body.args[0]),durationMs:Date.now()-requestStarted
    });
    var isWorkMediaAction=body&&typeof body.action==='string'&&body.action.indexOf('media.upload.')===0;
    var safeErrorCode=isWorkMediaAction?(error&&/^MEDIA_UPLOAD_|^INVALID_MEDIA_UPLOAD/.test(String(error.apiCode||''))?error.apiCode:'MEDIA_UPLOAD_FAILED'):(error&&error.apiCode||'OWNER_API_ERROR');
    var safeErrorMessage=isWorkMediaAction?(error&&error.apiCode?String(error.message||'Work media upload failed'):'Work media upload failed'):String(error&&error.message||error);
    return apiJson_({ok:false,error:safeErrorMessage,code:safeErrorCode,
      httpStatus:400,privateSaved:!!(error&&error.privateSaved),workId:error&&error.workId||undefined});
  }
}
function apiSecretMatches_(provided,expected) {
  if(typeof provided!=='string'||provided.length!==expected.length)return false;
  var difference=0;
  for(var i=0;i<expected.length;i++)difference|=provided.charCodeAt(i)^expected.charCodeAt(i);
  return difference===0;
}
function apiJson_(value) {
  var output=value;
  if(API_TIMING_CONTEXT_){
    var started=Date.now(),timing={action:API_TIMING_CONTEXT_.action,phases:API_TIMING_CONTEXT_.phases,totalMs:0};
    output=Object.assign({},value,{meta:{timing:timing}});ownerTimingPhase_('response_construction',Date.now()-started);
    timing.totalMs=Date.now()-API_TIMING_CONTEXT_.startedAt;
  }
  return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
}

function ownerTimingPhase_(phase,durationMs) {
  if(!API_TIMING_CONTEXT_||OWNER_TIMING_PHASES_.indexOf(phase)<0)return;
  var duration=Math.max(0,Number(durationMs)||0);
  API_TIMING_CONTEXT_.phases[phase]=(API_TIMING_CONTEXT_.phases[phase]||0)+duration;
}

function apiFail_(code,message) { var error=new Error(message);error.apiCode=code;throw error; }

function mediaPocIsReadAction_(action) { return MEDIA_POC_READ_ACTIONS_.indexOf(action)>=0; }
function mediaPocSafeChunkIndex_(input) {
  var index=input&&Number(input.chunkIndex);
  return Number.isInteger(index)&&index>=0&&index<=4?index:undefined;
}
function mediaPocSafeReadCode_(error) {
  var code=error&&typeof error.apiCode==='string'?error.apiCode:'';
  return MEDIA_POC_READ_ERROR_CODES_.indexOf(code)>=0?code:'MEDIA_POC_MEDIA_READ_FAILED';
}
function mediaPocSafeFetchFailureClass_(error) {
  var message='';
  try {
    if(error&&typeof error.message==='string')message=error.message;
    else if(typeof error==='string')message=error;
  } catch(_error) { return 'unknown_fetch_exception'; }
  var normalized=message.slice(0,4096).toLowerCase().replace(/\s+/g,' ');
  if(/script\.external_request|external request permission|permission to call urlfetchapp|urlfetchapp.{0,80}permission|permission.{0,80}urlfetchapp/.test(normalized))
    return 'external_request_permission';
  if(/authorization (?:is )?required|authentication required|not authorized|insufficient authentication scope/.test(normalized))
    return 'authorization_required';
  if(/invalid (?:argument|parameter|option|url|request)|(?:argument|parameter|option|url).{0,40}invalid|unsupported (?:method|protocol|header)|request options/.test(normalized))
    return 'invalid_request_options';
  if(/timed? ?out|timeout|service invoked too many times|quota|network|connection|dns|unreachable|temporary failure|service unavailable|internal error|backend error/.test(normalized))
    return 'url_fetch_runtime_failure';
  return 'unknown_fetch_exception';
}
function mediaPocReadTraceAction_(action) { return action==='media.poc.publicChunk'?'publicChunk':'ownerChunk'; }
function mediaPocReadTraceStart_(action) {
  MEDIA_POC_READ_TRACE_={action:mediaPocReadTraceAction_(action),phases:[]};
  mediaPocPersistReadTrace_();
}
function mediaPocDiagnosticPhase_(phase,details) {
  if(MEDIA_POC_READ_PHASES_.indexOf(phase)<0)return null;
  var data=details||{},record={phase:phase};
  var code=typeof data.code==='string'&&MEDIA_POC_READ_ERROR_CODES_.indexOf(data.code)>=0?data.code:'';
  var failureClass=phase==='drive_fetch_failed'&&typeof data.failureClass==='string'
    &&MEDIA_POC_READ_FAILURE_CLASSES_.indexOf(data.failureClass)>=0?data.failureClass:'';
  var status=Number(data.httpStatus),expected=Number(data.expectedBytes),actual=Number(data.actualBytes),duration=Number(data.durationMs),chunkIndex=Number(data.chunkIndex);
  if(code)record.code=code;
  if(failureClass)record.failureClass=failureClass;
  if(Number.isInteger(status)&&status>=100&&status<=599)record.httpStatus=status;
  if(Number.isInteger(expected)&&expected>=0&&expected<=MEDIA_POC_MAX_BYTES_)record.expectedBytes=expected;
  if(Number.isInteger(actual)&&actual>=0&&actual<=MEDIA_POC_MAX_BYTES_)record.actualBytes=actual;
  if(Number.isInteger(duration)&&duration>=0&&duration<=600000)record.durationMs=duration;
  if(Number.isInteger(chunkIndex)&&chunkIndex>=0&&chunkIndex<=4)record.chunkIndex=chunkIndex;
  return record;
}
function mediaPocPersistReadTrace_() {
  if(!MEDIA_POC_READ_TRACE_)return;
  try {
    var serialized=JSON.stringify(MEDIA_POC_READ_TRACE_);
    if(serialized.length<=MEDIA_POC_READ_DIAGNOSTIC_MAX_CHARS_)
      mediaPocProps_().setProperty(MEDIA_POC_LAST_READ_DIAGNOSTIC_PROPERTY_,serialized);
  } catch(_error) {}
}
function mediaPocReadDiagnostics_() {
  var raw=mediaPocProps_().getProperty(MEDIA_POC_LAST_READ_DIAGNOSTIC_PROPERTY_)||'';
  if(!raw||raw.length>MEDIA_POC_READ_DIAGNOSTIC_MAX_CHARS_)return null;
  var stored;try{stored=JSON.parse(raw);}catch(_error){return null;}
  if(!stored||typeof stored!=='object'||Array.isArray(stored)
    ||(stored.action!=='ownerChunk'&&stored.action!=='publicChunk')||!Array.isArray(stored.phases)||stored.phases.length>MEDIA_POC_READ_PHASES_.length)return null;
  var safe={action:stored.action,phases:[]},seen={};
  for(var i=0;i<stored.phases.length;i++){
    var item=stored.phases[i];if(!item||typeof item!=='object'||Array.isArray(item))return null;
    var phase=mediaPocDiagnosticPhase_(item.phase,item);
    if(!phase||seen[phase.phase])return null;
    seen[phase.phase]=true;safe.phases.push(phase);
  }
  if(!safe.phases.length||safe.phases[0].phase!=='request_received')return null;
  var sanitized=JSON.stringify(safe);
  return sanitized.length<=MEDIA_POC_READ_DIAGNOSTIC_MAX_CHARS_?safe:null;
}
function mediaPocReadLog_(action,phase,details) {
  if(!mediaPocIsReadAction_(action)||MEDIA_POC_READ_PHASES_.indexOf(phase)<0)return;
  var record={event:'media_poc_read',action:action,phase:phase},data=details||{};
  var code=typeof data.code==='string'&&MEDIA_POC_READ_ERROR_CODES_.indexOf(data.code)>=0?data.code:'';
  var failureClass=phase==='drive_fetch_failed'&&typeof data.failureClass==='string'
    &&MEDIA_POC_READ_FAILURE_CLASSES_.indexOf(data.failureClass)>=0?data.failureClass:'';
  var status=Number(data.httpStatus),expected=Number(data.expectedBytes),actual=Number(data.actualBytes),duration=Number(data.durationMs),chunkIndex=Number(data.chunkIndex);
  if(code)record.code=code;
  if(failureClass)record.failureClass=failureClass;
  if(Number.isInteger(status)&&status>=100&&status<=599)record.httpStatus=status;
  if(Number.isFinite(expected)&&expected>=0)record.expectedBytes=expected;
  if(Number.isFinite(actual)&&actual>=0)record.actualBytes=actual;
  if(Number.isFinite(duration)&&duration>=0)record.durationMs=duration;
  if(Number.isInteger(chunkIndex)&&chunkIndex>=0&&chunkIndex<=4)record.chunkIndex=chunkIndex;
  try {
    var line=JSON.stringify(record);
    if(phase==='read_failed')console.warn(line);else console.log(line);
  } catch(_error) {}
  if(MEDIA_POC_READ_TRACE_&&MEDIA_POC_READ_TRACE_.action===mediaPocReadTraceAction_(action)){
    var diagnosticPhase=mediaPocDiagnosticPhase_(phase,data),existing=-1;
    for(var i=0;i<MEDIA_POC_READ_TRACE_.phases.length;i++)if(MEDIA_POC_READ_TRACE_.phases[i].phase===phase){existing=i;break;}
    if(existing>=0)MEDIA_POC_READ_TRACE_.phases[existing]=diagnosticPhase;
    else if(MEDIA_POC_READ_TRACE_.phases.length<MEDIA_POC_READ_PHASES_.length)MEDIA_POC_READ_TRACE_.phases.push(diagnosticPhase);
    mediaPocPersistReadTrace_();
  }
}

function mediaPocDispatch_(action,args,ownerUserId) {
  var operation=function(){
    if(action==='media.poc.begin'&&args.length===1)return mediaPocBegin_(args[0],ownerUserId);
    if(action==='media.poc.chunk'&&args.length===1)return mediaPocChunk_(args[0]);
    if(action==='media.poc.finalize'&&args.length===1)return mediaPocFinalize_(args[0]);
    if(action==='media.poc.setPublic'&&args.length===1)return mediaPocSetPublic_(args[0],ownerUserId);
    if(action==='media.poc.ownerChunk'&&args.length===1)return mediaPocReadChunk_(args[0],ownerUserId,false);
    if(action==='media.poc.publicChunk'&&args.length===1)return mediaPocReadChunk_(args[0],ownerUserId,true);
    if(action==='media.poc.readDiagnostics'&&args.length===0)return mediaPocReadDiagnostics_();
    if(action==='media.poc.cleanup'&&args.length===0)return mediaPocCleanup_();
    apiFail_('INVALID_MEDIA_POC_REQUEST','Invalid isolated media proof-of-concept request');
  };
  if(action==='media.poc.ownerChunk'||action==='media.poc.publicChunk'||action==='media.poc.readDiagnostics')return operation();
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{return operation();}finally{lock.releaseLock();}
}

function mediaWorkManifestKey_(mediaId) { return CXL_WORK_MEDIA_MANIFEST_PREFIX_+mediaId; }
function mediaWorkSessionKey_(uploadId) { return CXL_WORK_MEDIA_SESSION_PREFIX_+uploadId; }
function mediaWorkIndexKey_(mediaId) { return CXL_WORK_MEDIA_INDEX_PREFIX_+mediaId; }
function mediaWorkReadJson_(key) {
  var raw=props_().getProperty(key);if(!raw)return null;
  try{return JSON.parse(raw);}catch(_error){apiFail_('MEDIA_UPLOAD_STATE_INVALID','Work media upload state is invalid');}
}
function mediaWorkStoreJson_(key,value) { props_().setProperty(key,JSON.stringify(value)); }
function mediaWorkPrivateFolder_(propertyName) {
  var id=props_().getProperty(propertyName)||'';
  if(!id)apiFail_('MEDIA_UPLOAD_NOT_CONFIGURED','Work media storage is not configured');
  var folder;
  try{folder=DriveApp.getFolderById(id);}catch(_error){apiFail_('MEDIA_UPLOAD_NOT_CONFIGURED','Work media storage is not accessible');}
  if(!folder||typeof folder.getSharingAccess!=='function'||folder.getSharingAccess()!==DriveApp.Access.PRIVATE)
    apiFail_('MEDIA_UPLOAD_FOLDER_NOT_PRIVATE','Work media storage folders must be private');
  return folder;
}
function mediaWorkMetadataMatches_(stored,input,ownerUserId) {
  return stored&&String(stored.mediaId)===String(input.mediaId)&&String(stored.workId)===String(input.workId)
    &&String(stored.ownerUserId)===String(ownerUserId)&&Number(stored.totalFileSize)===Number(input.totalFileSize)
    &&Number(stored.rawChunkSize)===Number(input.rawChunkSize)&&Number(stored.totalChunks)===Number(input.totalChunks)
    &&String(stored.mimeType)===String(input.mimeType)&&String(stored.sha256).toLowerCase()===String(input.sha256).toLowerCase()
    &&String(stored.purpose)===String(input.purpose)&&String(stored.contextId||'')===String(input.contextId||'')
    &&Number(stored.sortOrder)===Number(input.sortOrder)&&Boolean(stored.isCover)===Boolean(input.isCover);
}
function mediaWorkResult_(session,finalized) { return {uploadId:session.uploadId,mediaId:session.mediaId,finalized:!!finalized}; }
function mediaWorkUniqueFile_(folder,name) {
  var files=folder.getFilesByName(name),found=[];while(files.hasNext())found.push(files.next());
  if(found.length>1)apiFail_('MEDIA_UPLOAD_DUPLICATE_FILE','Work media storage contains duplicate upload files');
  return found[0]||null;
}
function mediaWorkChunkName_(uploadId,index) { return 'cxl-work-media-chunk-'+uploadId+'-'+('0'+index).slice(-2)+'.bin'; }
function mediaWorkCanonicalName_(mediaId,mimeType) { return 'cxl-work-media-'+mediaId+'.'+mediaPocMimeExtension_(mimeType); }
function mediaWorkSession_(uploadId) {
  if(!mediaPocUuid_(uploadId))apiFail_('INVALID_MEDIA_UPLOAD_REQUEST','Invalid Work media upload request');
  var session=mediaWorkReadJson_(mediaWorkSessionKey_(uploadId));
  if(!session)apiFail_('MEDIA_UPLOAD_SESSION_NOT_FOUND','Work media upload session was not found');
  if(Number(session.expiresAt)<=Date.now())apiFail_('MEDIA_UPLOAD_SESSION_EXPIRED','Work media upload session expired');
  return session;
}
function mediaWorkBegin_(input,ownerUserId) {
  var allowed=['uploadId','mediaId','workId','totalFileSize','rawChunkSize','totalChunks','mimeType','sha256','purpose','contextId','sortOrder','isCover'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(function(key){return allowed.indexOf(key)<0;})
    ||!mediaPocUuid_(input.uploadId)||!mediaPocUuid_(input.mediaId)||typeof input.workId!=='string'||!/^asset_[A-Za-z0-9_-]{1,96}$/.test(input.workId)
    ||!Number.isInteger(input.totalFileSize)||input.totalFileSize<1||input.totalFileSize>CXL_WORK_MEDIA_MAX_BYTES_
    ||input.rawChunkSize!==CXL_WORK_MEDIA_CHUNK_BYTES_||!Number.isInteger(input.totalChunks)
    ||input.totalChunks!==Math.ceil(input.totalFileSize/CXL_WORK_MEDIA_CHUNK_BYTES_)||input.totalChunks<1||input.totalChunks>5
    ||MEDIA_POC_ALLOWED_MIME_.indexOf(input.mimeType)<0||typeof input.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(input.sha256)
    ||['icon','gallery','prompt_example'].indexOf(input.purpose)<0
    ||(input.contextId!==undefined&&input.contextId!==null&&(typeof input.contextId!=='string'||input.contextId.length>128))
    ||!Number.isInteger(input.sortOrder)||input.sortOrder<0||input.sortOrder>20||typeof input.isCover!=='boolean')
    apiFail_('INVALID_MEDIA_UPLOAD_REQUEST','Invalid Work media upload metadata');
  var mediaFolder=mediaWorkPrivateFolder_('CXL_WORK_MEDIA_FOLDER_ID'),stagingFolder=mediaWorkPrivateFolder_('CXL_WORK_MEDIA_STAGING_FOLDER_ID');
  if(String(mediaFolder.getId())===String(stagingFolder.getId()))apiFail_('MEDIA_UPLOAD_FOLDER_NOT_PRIVATE','Work media folders must be separate');
  var expected={uploadId:input.uploadId,mediaId:input.mediaId,workId:input.workId,totalFileSize:input.totalFileSize,
    rawChunkSize:input.rawChunkSize,totalChunks:input.totalChunks,mimeType:input.mimeType,sha256:String(input.sha256).toLowerCase(),
    purpose:input.purpose,contextId:input.contextId||null,sortOrder:input.sortOrder,isCover:input.isCover,ownerUserId:ownerUserId,
    expiresAt:Date.now()+24*60*60*1000,status:'uploading'};
  var manifest=mediaWorkReadJson_(mediaWorkManifestKey_(input.mediaId));
  if(manifest){
    if(!mediaWorkMetadataMatches_(manifest,expected,ownerUserId))apiFail_('MEDIA_UPLOAD_IDEMPOTENCY_CONFLICT','Media identity is already bound to different Work data');
    var existingFile;try{existingFile=DriveApp.getFileById(manifest.drive_file_id);}catch(_error){apiFail_('MEDIA_UPLOAD_MEDIA_INVALID','Finalized Work media is unavailable');}
    if(!existingFile||existingFile.getSharingAccess()!==DriveApp.Access.PRIVATE||existingFile.getSize()!==manifest.totalFileSize)
      apiFail_('MEDIA_UPLOAD_MEDIA_INVALID','Finalized Work media is invalid');
    return mediaWorkResult_({uploadId:manifest.uploadId,mediaId:manifest.mediaId},true);
  }
  var indexedUploadId=props_().getProperty(mediaWorkIndexKey_(input.mediaId))||'';
  if(indexedUploadId){
    var indexedSession=mediaWorkReadJson_(mediaWorkSessionKey_(indexedUploadId));
    if(indexedSession&&Number(indexedSession.expiresAt)>Date.now()){
      if(!mediaWorkMetadataMatches_(indexedSession,expected,ownerUserId))apiFail_('MEDIA_UPLOAD_IDEMPOTENCY_CONFLICT','Media identity is already bound to different Work data');
      return mediaWorkResult_(indexedSession,false);
    }
  }
  var oldUpload=mediaWorkReadJson_(mediaWorkSessionKey_(input.uploadId));
  if(oldUpload){
    if(!mediaWorkMetadataMatches_(oldUpload,expected,ownerUserId))apiFail_('MEDIA_UPLOAD_IDEMPOTENCY_CONFLICT','Upload identifier is already used for different Work data');
    props_().setProperty(mediaWorkIndexKey_(input.mediaId),oldUpload.uploadId);
    return mediaWorkResult_(oldUpload,false);
  }
  mediaWorkStoreJson_(mediaWorkSessionKey_(expected.uploadId),expected);
  props_().setProperty(mediaWorkIndexKey_(expected.mediaId),expected.uploadId);
  return mediaWorkResult_(expected,false);
}
function mediaWorkBase64Bytes_(encoded) {
  if(typeof encoded!=='string'||!encoded.length||encoded.length>4*Math.ceil(CXL_WORK_MEDIA_CHUNK_BYTES_/3)
    ||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
    apiFail_('INVALID_MEDIA_UPLOAD_CHUNK','Invalid Work media chunk');
  var bytes;try{bytes=Utilities.base64Decode(encoded);}catch(_error){apiFail_('INVALID_MEDIA_UPLOAD_CHUNK','Invalid Work media chunk');}
  if(Utilities.base64Encode(bytes)!==encoded)apiFail_('INVALID_MEDIA_UPLOAD_CHUNK','Invalid Work media chunk');
  return bytes;
}
function mediaWorkChunk_(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(function(key){return ['uploadId','chunkIndex','base64','sha256'].indexOf(key)<0;})
    ||!Number.isInteger(input.chunkIndex)||typeof input.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(input.sha256))
    apiFail_('INVALID_MEDIA_UPLOAD_CHUNK','Invalid Work media chunk');
  var session=mediaWorkSession_(input.uploadId);
  if(session.status!=='uploading')apiFail_('MEDIA_UPLOAD_SESSION_CLOSED','Work media upload session is closed');
  if(input.chunkIndex<0||input.chunkIndex>=session.totalChunks)apiFail_('INVALID_MEDIA_UPLOAD_CHUNK','Invalid Work media chunk');
  var bytes=mediaWorkBase64Bytes_(input.base64),expectedSize=Math.min(session.rawChunkSize,session.totalFileSize-input.chunkIndex*session.rawChunkSize);
  if(bytes.length!==expectedSize||mediaPocSha256_(bytes)!==input.sha256.toLowerCase())apiFail_('MEDIA_UPLOAD_CHUNK_CHECKSUM','Work media chunk checksum or size did not match');
  var folder=mediaWorkPrivateFolder_('CXL_WORK_MEDIA_STAGING_FOLDER_ID'),name=mediaWorkChunkName_(session.uploadId,input.chunkIndex),existing=mediaWorkUniqueFile_(folder,name);
  if(existing){var saved=existing.getBlob().getBytes();if(saved.length!==bytes.length||mediaPocSha256_(saved)!==input.sha256.toLowerCase())apiFail_('MEDIA_UPLOAD_CHUNK_CONFLICT','A different Work media chunk exists at this position');}
  else {var file=folder.createFile(Utilities.newBlob(bytes,'application/octet-stream',name));file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);if(file.getSharingAccess()!==DriveApp.Access.PRIVATE)apiFail_('MEDIA_UPLOAD_FOLDER_NOT_PRIVATE','Staged Work media is not private');}
  return {uploadId:session.uploadId,chunkIndex:input.chunkIndex,stored:true,idempotent:!!existing};
}
function mediaWorkDeleteStaged_(session) {
  var folder=mediaWorkPrivateFolder_('CXL_WORK_MEDIA_STAGING_FOLDER_ID'),deleted=0;
  for(var i=0;i<session.totalChunks;i++){var file=mediaWorkUniqueFile_(folder,mediaWorkChunkName_(session.uploadId,i));if(file){file.setTrashed(true);deleted++;}}
  return deleted;
}
function mediaWorkFinalize_(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(function(key){return key!=='uploadId';})||!mediaPocUuid_(input.uploadId))
    apiFail_('INVALID_MEDIA_UPLOAD_REQUEST','Invalid Work media finalize request');
  var session=mediaWorkSession_(input.uploadId),manifest=mediaWorkReadJson_(mediaWorkManifestKey_(session.mediaId));
  if(manifest){
    if(!mediaWorkMetadataMatches_(manifest,session,session.ownerUserId))apiFail_('MEDIA_UPLOAD_IDEMPOTENCY_CONFLICT','Finalized Work media does not match this upload');
    mediaWorkDeleteStaged_(session);return mediaWorkResult_(session,true);
  }
  var staging=mediaWorkPrivateFolder_('CXL_WORK_MEDIA_STAGING_FOLDER_ID'),bytes=[],total=0;
  for(var index=0;index<session.totalChunks;index++){
    var chunk=mediaWorkUniqueFile_(staging,mediaWorkChunkName_(session.uploadId,index));
    if(!chunk)apiFail_('MEDIA_UPLOAD_CHUNK_MISSING','A Work media chunk is missing');
    var part=chunk.getBlob().getBytes(),expected=Math.min(session.rawChunkSize,session.totalFileSize-index*session.rawChunkSize);
    if(part.length!==expected)apiFail_('MEDIA_UPLOAD_CHUNK_CHECKSUM','A Work media chunk has an invalid size');
    for(var b=0;b<part.length;b++)bytes.push(part[b]);total+=part.length;part=null;
  }
  if(total!==session.totalFileSize||bytes.length!==session.totalFileSize)apiFail_('MEDIA_UPLOAD_CHUNK_CHECKSUM','Work media upload size did not match');
  if(mediaPocSha256_(bytes)!==session.sha256)apiFail_('MEDIA_UPLOAD_FINAL_CHECKSUM','Work media checksum did not match');
  if(mediaPocExpectedMime_(bytes)!==session.mimeType)apiFail_('MEDIA_UPLOAD_MIME_MISMATCH','Work media type did not match its binary signature');
  var folder=mediaWorkPrivateFolder_('CXL_WORK_MEDIA_FOLDER_ID'),name=mediaWorkCanonicalName_(session.mediaId,session.mimeType),file=mediaWorkUniqueFile_(folder,name);
  if(file){var current=file.getBlob().getBytes();if(current.length!==bytes.length||mediaPocSha256_(current)!==session.sha256)apiFail_('MEDIA_UPLOAD_IDEMPOTENCY_CONFLICT','Canonical Work media identity is already in use');}
  else file=folder.createFile(Utilities.newBlob(bytes,session.mimeType,name));
  file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);
  if(file.getSharingAccess()!==DriveApp.Access.PRIVATE||file.getSize()!==session.totalFileSize)apiFail_('MEDIA_UPLOAD_MEDIA_INVALID','Canonical Work media is not private or has an invalid size');
  manifest={uploadId:session.uploadId,mediaId:session.mediaId,workId:session.workId,ownerUserId:session.ownerUserId,drive_file_id:file.getId(),
    totalFileSize:session.totalFileSize,mimeType:session.mimeType,sha256:session.sha256,purpose:session.purpose,contextId:session.contextId,
    sortOrder:session.sortOrder,isCover:session.isCover,totalChunks:session.totalChunks,delivery:'vercel_proxy',state:'finalized',
    sharing_access:'private',createdAt:new Date().toISOString()};
  mediaWorkStoreJson_(mediaWorkManifestKey_(session.mediaId),manifest);
  session.status='complete';mediaWorkStoreJson_(mediaWorkSessionKey_(session.uploadId),session);
  mediaWorkDeleteStaged_(session);
  return mediaWorkResult_(session,true);
}
function mediaWorkUploadDispatch_(action,args,ownerUserId) {
  var operation=function(){
    if(action==='media.upload.begin'&&args.length===1)return mediaWorkBegin_(args[0],ownerUserId);
    if(action==='media.upload.chunk'&&args.length===1)return mediaWorkChunk_(args[0]);
    if(action==='media.upload.finalize'&&args.length===1)return mediaWorkFinalize_(args[0]);
    apiFail_('INVALID_MEDIA_UPLOAD_REQUEST','Invalid Work media upload request');
  };
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{return operation();}finally{lock.releaseLock();}
}

function mediaPocUuid_(value) { return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value); }
function mediaPocHex_(bytes) { return bytes.map(function(value){var byte=(Number(value)+256)%256;return ('0'+byte.toString(16)).slice(-2);}).join(''); }
function mediaPocSha256_(bytes) { return mediaPocHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes)); }
function mediaPocProps_() { return props_(); }
function mediaPocSessionKey_(uploadId) { return MEDIA_POC_SESSION_PREFIX_+uploadId; }
function mediaPocManifestKey_(mediaId) { return MEDIA_POC_MANIFEST_PREFIX_+mediaId; }
function mediaPocReadJson_(key) {
  var raw=mediaPocProps_().getProperty(key);if(!raw)return null;
  try{return JSON.parse(raw);}catch(_error){apiFail_('MEDIA_POC_STATE_INVALID','Isolated media test state is invalid');}
}
function mediaPocStoreJson_(key,value) { mediaPocProps_().setProperty(key,JSON.stringify(value)); }
function mediaPocMimeExtension_(mime) { return {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[mime]||''; }
function mediaPocExpectedMime_(bytes) {
  if(bytes.length>=3&&(Number(bytes[0])+256)%256===0xff&&(Number(bytes[1])+256)%256===0xd8&&(Number(bytes[2])+256)%256===0xff)return 'image/jpeg';
  if(bytes.length>=8&&mediaPocHex_(bytes.slice(0,8))==='89504e470d0a1a0a')return 'image/png';
  if(bytes.length>=6&&String.fromCharCode.apply(null,bytes.slice(0,6))==='GIF87a'||bytes.length>=6&&String.fromCharCode.apply(null,bytes.slice(0,6))==='GIF89a')return 'image/gif';
  if(bytes.length>=12&&String.fromCharCode.apply(null,bytes.slice(0,4))==='RIFF'&&String.fromCharCode.apply(null,bytes.slice(8,12))==='WEBP')return 'image/webp';
  return '';
}
function mediaPocPrivateFolder_(propertyName) {
  var id=mediaPocProps_().getProperty(propertyName)||'';
  if(!id)apiFail_('MEDIA_POC_NOT_CONFIGURED','Isolated media test folders are not configured');
  var folder;
  try{folder=DriveApp.getFolderById(id);}catch(_error){apiFail_('MEDIA_POC_NOT_CONFIGURED','Isolated media test folders are not accessible');}
  if(!folder||typeof folder.getSharingAccess!=='function'||folder.getSharingAccess()!==DriveApp.Access.PRIVATE)
    apiFail_('MEDIA_POC_FOLDER_NOT_PRIVATE','Isolated media folders must be private');
  return folder;
}
function mediaPocSession_(uploadId) {
  if(!mediaPocUuid_(uploadId))apiFail_('INVALID_MEDIA_POC_REQUEST','Invalid isolated media test request');
  var session=mediaPocReadJson_(mediaPocSessionKey_(uploadId));
  if(!session)apiFail_('MEDIA_POC_SESSION_NOT_FOUND','Isolated media upload session was not found');
  if(Number(session.expiresAt)<=Date.now())apiFail_('MEDIA_POC_SESSION_EXPIRED','Isolated media upload session expired');
  return session;
}
function mediaPocPublicResult_(session,manifest) {
  return {uploadId:session.uploadId,workNonce:session.workNonce,workId:session.workId,mediaId:session.mediaId,ref:'media:'+session.mediaId,
    mimeType:session.mimeType,size:session.totalFileSize,sha256:session.sha256,totalChunks:session.totalChunks,
    state:manifest&&manifest.isPublic?'public':'private'};
}
function mediaPocBegin_(input,ownerUserId) {
  var started=Date.now();
  if(!input||typeof input!=='object'||Array.isArray(input)||!mediaPocUuid_(input.uploadId)||!mediaPocUuid_(input.mediaId)
    ||!mediaPocUuid_(input.workNonce)||!Number.isInteger(input.totalFileSize)||input.totalFileSize<1||input.totalFileSize>MEDIA_POC_MAX_BYTES_
    ||input.rawChunkSize!==MEDIA_POC_CHUNK_BYTES_||!Number.isInteger(input.totalChunks)
    ||input.totalChunks!==Math.ceil(input.totalFileSize/MEDIA_POC_CHUNK_BYTES_)||input.totalChunks<1||input.totalChunks>5
    ||MEDIA_POC_ALLOWED_MIME_.indexOf(input.mimeType)<0||typeof input.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(input.sha256))
    apiFail_('INVALID_MEDIA_POC_REQUEST','Invalid isolated media upload metadata');
  var canonicalFolder=mediaPocPrivateFolder_('CXL_MEDIA_FOLDER_ID'),stagingFolder=mediaPocPrivateFolder_('CXL_MEDIA_STAGING_FOLDER_ID');
  if(String(canonicalFolder.getId())===String(stagingFolder.getId()))apiFail_('MEDIA_POC_FOLDER_NOT_PRIVATE','Isolated media folders must be separate');
  var workId='asset_media_poc_'+input.workNonce,sessionKey=mediaPocSessionKey_(input.uploadId),old=mediaPocReadJson_(sessionKey);
  var expected={uploadId:input.uploadId,mediaId:input.mediaId,workNonce:input.workNonce,workId:workId,totalFileSize:input.totalFileSize,
    rawChunkSize:MEDIA_POC_CHUNK_BYTES_,totalChunks:input.totalChunks,mimeType:input.mimeType,sha256:input.sha256.toLowerCase(),
    ownerUserId:ownerUserId,expiresAt:Date.now()+24*60*60*1000,status:'uploading'};
  if(old){
    var keys=['uploadId','mediaId','workNonce','workId','totalFileSize','rawChunkSize','totalChunks','mimeType','sha256','ownerUserId'];
    if(keys.some(function(key){return String(old[key])!==String(expected[key]);}))apiFail_('MEDIA_POC_IDEMPOTENCY_CONFLICT','Upload identifier is already used for different test data');
    expected=old;
  } else {
    if(mediaPocReadJson_(mediaPocManifestKey_(input.mediaId)))apiFail_('MEDIA_POC_IDEMPOTENCY_CONFLICT','Test media identifier is already in use');
    mediaPocStoreJson_(sessionKey,expected);
  }
  ownerTimingPhase_('chunk_receive',Date.now()-started);
  return mediaPocPublicResult_(expected,mediaPocReadJson_(mediaPocManifestKey_(expected.mediaId)));
}
function mediaPocBase64Bytes_(encoded) {
  if(typeof encoded!=='string'||!encoded.length||encoded.length>4*Math.ceil(MEDIA_POC_CHUNK_BYTES_/3)
    ||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
    apiFail_('INVALID_MEDIA_POC_CHUNK','Invalid isolated media chunk');
  var bytes;try{bytes=Utilities.base64Decode(encoded);}catch(_error){apiFail_('INVALID_MEDIA_POC_CHUNK','Invalid isolated media chunk');}
  if(Utilities.base64Encode(bytes)!==encoded)apiFail_('INVALID_MEDIA_POC_CHUNK','Invalid isolated media chunk');
  return bytes;
}
function mediaPocChunkName_(uploadId,index) { return 'cxl-media-poc-chunk-'+uploadId+'-'+('0'+index).slice(-2)+'.bin'; }
function mediaPocUniqueFile_(folder,name) {
  var files=folder.getFilesByName(name),found=[];while(files.hasNext())found.push(files.next());
  if(found.length>1)apiFail_('MEDIA_POC_DUPLICATE_FILE','Isolated media storage contains duplicate test files');
  return found[0]||null;
}
function mediaPocChunk_(input) {
  var receiveStarted=Date.now();
  if(!input||typeof input!=='object'||Array.isArray(input)||!Number.isInteger(input.chunkIndex))apiFail_('INVALID_MEDIA_POC_CHUNK','Invalid isolated media chunk');
  var session=mediaPocSession_(input.uploadId);
  if(session.status!=='uploading')apiFail_('MEDIA_POC_SESSION_CLOSED','Isolated media upload session is closed');
  if(input.chunkIndex<0||input.chunkIndex>=session.totalChunks||typeof input.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(input.sha256))apiFail_('INVALID_MEDIA_POC_CHUNK','Invalid isolated media chunk');
  var bytes=mediaPocBase64Bytes_(input.base64),expectedSize=Math.min(session.rawChunkSize,session.totalFileSize-input.chunkIndex*session.rawChunkSize);
  if(bytes.length!==expectedSize||mediaPocSha256_(bytes)!==input.sha256.toLowerCase())apiFail_('MEDIA_POC_CHUNK_CHECKSUM','Isolated media chunk checksum or size did not match');
  ownerTimingPhase_('chunk_receive',Date.now()-receiveStarted);var writeStarted=Date.now(),folder=mediaPocPrivateFolder_('CXL_MEDIA_STAGING_FOLDER_ID');
  var name=mediaPocChunkName_(session.uploadId,input.chunkIndex),existing=mediaPocUniqueFile_(folder,name),chunkHash=mediaPocSha256_(bytes);
  if(existing){var saved=existing.getBlob().getBytes();if(saved.length!==bytes.length||mediaPocSha256_(saved)!==chunkHash)apiFail_('MEDIA_POC_CHUNK_CONFLICT','A different chunk already exists for this upload position');}
  else {
    var blob=Utilities.newBlob(bytes,'application/octet-stream',name),file=folder.createFile(blob);
    file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);
    if(file.getSharingAccess()!==DriveApp.Access.PRIVATE)apiFail_('MEDIA_POC_FOLDER_NOT_PRIVATE','Staged media chunk is not private');
  }
  ownerTimingPhase_('chunk_persist',Date.now()-writeStarted);
  return {uploadId:session.uploadId,chunkIndex:input.chunkIndex,stored:true,idempotent:!!existing};
}
function mediaPocDeleteStaged_(session) {
  var folder=mediaPocPrivateFolder_('CXL_MEDIA_STAGING_FOLDER_ID'),deleted=0;
  for(var i=0;i<session.totalChunks;i++){
    var file=mediaPocUniqueFile_(folder,mediaPocChunkName_(session.uploadId,i));
    if(file){file.setTrashed(true);deleted++;}
  }
  return deleted;
}
function mediaPocFinalize_(input) {
  var lookupStarted=Date.now();if(!input||typeof input!=='object'||Array.isArray(input)||!mediaPocUuid_(input.uploadId))apiFail_('INVALID_MEDIA_POC_REQUEST','Invalid isolated media finalize request');
  var session=mediaPocReadJson_(mediaPocSessionKey_(input.uploadId));
  if(!session)apiFail_('MEDIA_POC_SESSION_NOT_FOUND','Isolated media upload session was not found');
  var manifestKey=mediaPocManifestKey_(session.mediaId),manifest=mediaPocReadJson_(manifestKey);
  if(manifest){
    if(manifest.uploadId!==session.uploadId||manifest.sha256!==session.sha256||manifest.totalFileSize!==session.totalFileSize)apiFail_('MEDIA_POC_IDEMPOTENCY_CONFLICT','Finalized test media does not match this upload');
    var cleanupStarted=Date.now();mediaPocDeleteStaged_(session);ownerTimingPhase_('staging_cleanup',Date.now()-cleanupStarted);
    return mediaPocPublicResult_(session,manifest);
  }
  if(Number(session.expiresAt)<=Date.now())apiFail_('MEDIA_POC_SESSION_EXPIRED','Isolated media upload session expired');
  ownerTimingPhase_('finalize_lookup',Date.now()-lookupStarted);var assemblyStarted=Date.now(),staging=mediaPocPrivateFolder_('CXL_MEDIA_STAGING_FOLDER_ID'),bytes=[],total=0;
  for(var index=0;index<session.totalChunks;index++){
    var chunk=mediaPocUniqueFile_(staging,mediaPocChunkName_(session.uploadId,index));
    if(!chunk)apiFail_('MEDIA_POC_CHUNK_MISSING','An isolated media chunk is missing');
    var part=chunk.getBlob().getBytes(),expected=Math.min(session.rawChunkSize,session.totalFileSize-index*session.rawChunkSize);
    if(part.length!==expected)apiFail_('MEDIA_POC_CHUNK_CHECKSUM','An isolated media chunk has an invalid size');
    for(var b=0;b<part.length;b++)bytes.push(part[b]);total+=part.length;part=null;
  }
  if(total!==session.totalFileSize)apiFail_('MEDIA_POC_CHUNK_CHECKSUM','Isolated media upload size did not match');
  ownerTimingPhase_('final_assembly',Date.now()-assemblyStarted);var checksumStarted=Date.now();
  if(bytes.length!==session.totalFileSize||mediaPocSha256_(bytes)!==session.sha256)apiFail_('MEDIA_POC_FINAL_CHECKSUM','Isolated media checksum did not match');
  ownerTimingPhase_('checksum_validation',Date.now()-checksumStarted);var binaryStarted=Date.now(),detectedMime=mediaPocExpectedMime_(bytes);
  if(!detectedMime||detectedMime!==session.mimeType)apiFail_('MEDIA_POC_MIME_MISMATCH','Isolated media type did not match its binary signature');
  ownerTimingPhase_('binary_validation',Date.now()-binaryStarted);var writeStarted=Date.now(),folder=mediaPocPrivateFolder_('CXL_MEDIA_FOLDER_ID');
  var fileName='cxl-media-poc-'+session.mediaId+'.'+mediaPocMimeExtension_(session.mimeType),file=mediaPocUniqueFile_(folder,fileName);
  if(file){var existingBytes=file.getBlob().getBytes();if(existingBytes.length!==bytes.length||mediaPocSha256_(existingBytes)!==session.sha256)apiFail_('MEDIA_POC_IDEMPOTENCY_CONFLICT','Canonical test media name is already in use');}
  else file=folder.createFile(Utilities.newBlob(bytes,session.mimeType,fileName));
  file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);
  if(file.getSharingAccess()!==DriveApp.Access.PRIVATE)apiFail_('MEDIA_POC_FOLDER_NOT_PRIVATE','Canonical test media is not private');
  ownerTimingPhase_('canonical_drive_write',Date.now()-writeStarted);
  manifest={uploadId:session.uploadId,workNonce:session.workNonce,workId:session.workId,mediaId:session.mediaId,fileId:file.getId(),mimeType:session.mimeType,
    totalFileSize:session.totalFileSize,sha256:session.sha256,active:true,isPublic:false,ownerUserId:session.ownerUserId,createdAt:new Date().toISOString()};
  mediaPocStoreJson_(manifestKey,manifest);session.status='complete';mediaPocStoreJson_(mediaPocSessionKey_(session.uploadId),session);
  var cleanupStarted=Date.now();mediaPocDeleteStaged_(session);ownerTimingPhase_('staging_cleanup',Date.now()-cleanupStarted);
  return mediaPocPublicResult_(session,manifest);
}
function mediaPocSetPublic_(input,ownerUserId) {
  if(!input||typeof input!=='object'||Array.isArray(input)||!mediaPocUuid_(input.mediaId)||!mediaPocUuid_(input.workNonce)||typeof input.isPublic!=='boolean')apiFail_('INVALID_MEDIA_POC_REQUEST','Invalid isolated media visibility request');
  var manifest=mediaPocReadJson_(mediaPocManifestKey_(input.mediaId));
  if(!manifest||manifest.ownerUserId!==ownerUserId||manifest.workId!=='asset_media_poc_'+input.workNonce)apiFail_('MEDIA_POC_MEDIA_NOT_FOUND','Isolated media test item was not found');
  var file;try{file=DriveApp.getFileById(manifest.fileId);}catch(_error){apiFail_('MEDIA_POC_MEDIA_NOT_FOUND','Isolated media test item was not found');}
  if(!file||file.getSharingAccess()!==DriveApp.Access.PRIVATE||file.getSize()!==manifest.totalFileSize)apiFail_('MEDIA_POC_MEDIA_INVALID','Isolated media test item is invalid');
  manifest.isPublic=input.isPublic;manifest.active=true;mediaPocStoreJson_(mediaPocManifestKey_(input.mediaId),manifest);
  return {workId:manifest.workId,mediaId:manifest.mediaId,ref:'media:'+manifest.mediaId,state:manifest.isPublic?'public':'private'};
}
function mediaPocDriveChunk_(fileId,start,expectedLength,totalSize,action,chunkIndex) {
  var end=start+expectedLength-1,url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId)+'?alt=media';
  var response,readStarted=Date.now(),tokenStarted=Date.now();
  mediaPocReadLog_(action,'oauth_token_started',{chunkIndex:chunkIndex});
  var accessToken;
  try{accessToken=ScriptApp.getOAuthToken();}
  catch(_tokenError){mediaPocReadLog_(action,'oauth_token_failed',{expectedBytes:expectedLength,durationMs:Date.now()-tokenStarted,chunkIndex:chunkIndex});
    mediaPocReadLog_(action,'read_failed',{code:'MEDIA_POC_MEDIA_READ_FAILED',expectedBytes:expectedLength,durationMs:Date.now()-readStarted,chunkIndex:chunkIndex});apiFail_('MEDIA_POC_MEDIA_READ_FAILED','Isolated media bytes could not be read');}
  mediaPocReadLog_(action,'oauth_token_acquired',{durationMs:Date.now()-tokenStarted,chunkIndex:chunkIndex});
  var fetchStarted=Date.now();mediaPocReadLog_(action,'drive_fetch_started',{expectedBytes:expectedLength,chunkIndex:chunkIndex});
  try{response=UrlFetchApp.fetch(url,{method:'get',headers:{Authorization:'Bearer '+accessToken,Range:'bytes='+start+'-'+end},muteHttpExceptions:true});}
  catch(fetchError){mediaPocReadLog_(action,'drive_fetch_failed',{failureClass:mediaPocSafeFetchFailureClass_(fetchError),expectedBytes:expectedLength,
      durationMs:Date.now()-fetchStarted,chunkIndex:chunkIndex});
    mediaPocReadLog_(action,'read_failed',{code:'MEDIA_POC_MEDIA_READ_FAILED',expectedBytes:expectedLength,durationMs:Date.now()-readStarted,chunkIndex:chunkIndex});apiFail_('MEDIA_POC_MEDIA_READ_FAILED','Isolated media bytes could not be read');}
  var status=response.getResponseCode(),content=response.getContent();
  mediaPocReadLog_(action,'drive_fetch_completed',{httpStatus:status,expectedBytes:expectedLength,actualBytes:content.length,
    durationMs:Date.now()-fetchStarted,chunkIndex:chunkIndex});
  if(status===206){
    if(content.length!==expectedLength){mediaPocReadLog_(action,'read_failed',{code:'MEDIA_POC_MEDIA_INVALID',httpStatus:status,
      expectedBytes:expectedLength,actualBytes:content.length,durationMs:Date.now()-fetchStarted,chunkIndex:chunkIndex});apiFail_('MEDIA_POC_MEDIA_INVALID','Isolated media byte range has an invalid size');}
    mediaPocReadLog_(action,'drive_range_validated',{httpStatus:status,expectedBytes:expectedLength,actualBytes:content.length,
      durationMs:Date.now()-fetchStarted,chunkIndex:chunkIndex});return content;
  }
  if(status===200&&content.length===totalSize){var full=content.slice(start,end+1);if(full.length===expectedLength){
    mediaPocReadLog_(action,'drive_range_validated',{httpStatus:status,expectedBytes:expectedLength,actualBytes:full.length,
      durationMs:Date.now()-fetchStarted,chunkIndex:chunkIndex});return full;
  }}
  mediaPocReadLog_(action,'read_failed',{code:'MEDIA_POC_MEDIA_READ_FAILED',httpStatus:status,expectedBytes:expectedLength,
    actualBytes:content.length,durationMs:Date.now()-fetchStarted,chunkIndex:chunkIndex});
  apiFail_('MEDIA_POC_MEDIA_READ_FAILED','Isolated media bytes could not be read');
}
function mediaPocReadChunk_(input,ownerUserId,isPublic) {
  var phaseStarted=Date.now();
  if(!input||typeof input!=='object'||Array.isArray(input)||!mediaPocUuid_(input.mediaId)||!mediaPocUuid_(input.workNonce)
    ||!Number.isInteger(input.chunkIndex)||input.chunkIndex<0)apiFail_('INVALID_MEDIA_POC_REQUEST','Invalid isolated media read request');
  var manifest=mediaPocReadJson_(mediaPocManifestKey_(input.mediaId)),expectedWorkId='asset_media_poc_'+input.workNonce;
  if(!manifest||!manifest.active||manifest.workId!==expectedWorkId||input.ref!=='media:'+input.mediaId)
    apiFail_('MEDIA_POC_MEDIA_NOT_FOUND','Isolated media test item was not found');
  if(isPublic){ownerTimingPhase_('public_media_authorization',Date.now()-phaseStarted);if(manifest.isPublic!==true)apiFail_('MEDIA_POC_MEDIA_NOT_PUBLIC','Isolated media test item is private');}
  else if(manifest.ownerUserId!==ownerUserId)apiFail_('MEDIA_POC_MEDIA_NOT_FOUND','Isolated media test item was not found');
  else ownerTimingPhase_('owner_media_read',Date.now()-phaseStarted);
  var count=Math.ceil(manifest.totalFileSize/MEDIA_POC_CHUNK_BYTES_);
  if(input.chunkIndex>=count)apiFail_('INVALID_MEDIA_POC_REQUEST','Invalid isolated media chunk index');
  var readStarted=Date.now(),file;try{file=DriveApp.getFileById(manifest.fileId);}catch(_error){apiFail_('MEDIA_POC_MEDIA_NOT_FOUND','Isolated media test item was not found');}
  if(!file||file.getSharingAccess()!==DriveApp.Access.PRIVATE)apiFail_('MEDIA_POC_MEDIA_NOT_FOUND','Isolated media test item was not found');
  if(file.getSize()!==manifest.totalFileSize)apiFail_('MEDIA_POC_MEDIA_INVALID','Isolated media test item is invalid');
  var start=input.chunkIndex*MEDIA_POC_CHUNK_BYTES_,expectedLength=Math.min(MEDIA_POC_CHUNK_BYTES_,manifest.totalFileSize-start);
  var action=isPublic?'media.poc.publicChunk':'media.poc.ownerChunk';
  mediaPocReadLog_(action,'manifest_validated',{expectedBytes:expectedLength,chunkIndex:input.chunkIndex});
  var chunkBytes=mediaPocDriveChunk_(manifest.fileId,start,expectedLength,manifest.totalFileSize,action,input.chunkIndex);
  ownerTimingPhase_(isPublic?'public_media_read':'owner_media_read',Date.now()-readStarted);
  return {workId:manifest.workId,mediaId:manifest.mediaId,ref:'media:'+manifest.mediaId,mimeType:manifest.mimeType,
    totalFileSize:manifest.totalFileSize,totalChunks:count,chunkIndex:input.chunkIndex,sha256:manifest.sha256,
    chunkSha256:mediaPocSha256_(chunkBytes),base64:Utilities.base64Encode(chunkBytes)};
}
function mediaPocCleanup_() {
  var started=Date.now(),all=mediaPocProps_().getProperties(),sessions=Object.keys(all).filter(function(key){if(key.indexOf(MEDIA_POC_SESSION_PREFIX_)!==0)return false;try{return Number(JSON.parse(all[key]).expiresAt)<=Date.now();}catch(_error){return false;}}).slice(0,MEDIA_POC_MAX_CLEANUP_SESSIONS_),deletedSessions=0,deletedChunks=0;
  var staging=mediaPocPrivateFolder_('CXL_MEDIA_STAGING_FOLDER_ID');
  sessions.forEach(function(key){var session;try{session=JSON.parse(all[key]);}catch(_error){session=null;}
    if(!session||Number(session.expiresAt)>Date.now())return;
    for(var i=0;i<Math.min(Number(session.totalChunks)||0,5);i++){var file=mediaPocUniqueFile_(staging,mediaPocChunkName_(session.uploadId,i));if(file){file.setTrashed(true);deletedChunks++;}}
    mediaPocProps_().deleteProperty(key);deletedSessions++;
  });
  var remaining=Object.keys(mediaPocProps_().getProperties()).filter(function(key){return key.indexOf(MEDIA_POC_SESSION_PREFIX_)===0;}).length;
  ownerTimingPhase_('staging_cleanup',Date.now()-started);return {deletedSessions:deletedSessions,deletedChunks:deletedChunks,remaining:remaining};
}

function config_() {
  var p = props_();
  return { rootId:p.getProperty('ROOT_ID'), privateId:p.getProperty('PRIVATE_ID'), publicId:p.getProperty('PUBLIC_ID'), incomingId:p.getProperty('INCOMING_ID'), privateSheetId:p.getProperty('PRIVATE_SHEET_ID'), publicSheetId:p.getProperty('PUBLIC_SHEET_ID'), cxlMediaFolderId:p.getProperty('CXL_MEDIA_FOLDER_ID'), cxlMediaStagingFolderId:p.getProperty('CXL_MEDIA_STAGING_FOLDER_ID') };
}

function cxlAssetFromRecord_(record) {
  if(record.cxlAsset){var saved=JSON.parse(JSON.stringify(record.cxlAsset));saved.revision=Number(record.revision)||1;saved.media=(record.mediaRecords||[]).map(function(m){return {id:m.id,assetId:m.asset_id,storagePath:m.storage_path,delivery:m.delivery==='vercel_proxy'?'vercel_proxy':undefined,
    purpose:m.purpose,contextId:m.context_id||null,mimeType:m.mime_type,fileSize:Number(m.file_size||0),sortOrder:Number(m.sort_order||0),isCover:!!m.is_cover,
    naturalWidth:m.natural_width,naturalHeight:m.natural_height,createdAt:m.created_at,updatedAt:m.updated_at};});return saved;}
  var r=record.row||{};
  return {id:r.id,userId:r.user_id||'google-owner',authorName:r.author_name||'Creator',authorAvatar:r.author_avatar,
    title:r.title||'',icon:r.icon||{type:'emoji',value:'✨'},category:r.category||'character',shortDescription:r.short_description||'',
    contentTypeLabels:r.content_type_labels||[],contentTypes:r.content_types||[],presentationMetadata:r.presentation_metadata,
    publicCollaboration:r.public_collaboration||null,collaborationAssetId:r.collaboration_asset_id&&r.collaboration_asset_id!=='null'?r.collaboration_asset_id:null,collaboration:record.collaborationDraft||null,
    contentBlocks:r.content_blocks||[],content:r.content||'',uiCodeSnippet:r.ui_code_snippet||'',previewImage:r.preview_image||'',
    previewImages:r.preview_images||[],media:(record.mediaRecords||[]).map(function(m){return {id:m.id,assetId:r.id,storagePath:m.storage_path,delivery:m.delivery==='vercel_proxy'?'vercel_proxy':undefined,
      purpose:m.purpose,contextId:m.context_id||null,mimeType:m.mime_type,fileSize:Number(m.file_size||0),sortOrder:Number(m.sort_order||0),
      isCover:!!m.is_cover,naturalWidth:m.natural_width,naturalHeight:m.natural_height,createdAt:m.created_at,updatedAt:m.updated_at};}),
    folderId:r.folder_id&&r.folder_id!=='null'?r.folder_id:null,isPublic:isPublic_(r),visibility:r.visibility||'private',status:r.status||'draft',tags:r.tags||[],
    createdAt:r.created_at,updatedAt:r.updated_at,deletedAt:r.deleted_at||null,likesCount:Number(r.likes_count||0),forkCount:Number(r.fork_count||0),
    forkedFromId:r.forked_from_id&&r.forked_from_id!=='null'?r.forked_from_id:null,forkedFromAuthor:r.forked_from_author&&r.forked_from_author!=='null'?r.forked_from_author:null,linkedAssetIds:r.linked_asset_ids||[],versions:r.versions||[]};
}

function cxlOwnerFolders_(ownerUserId) {
  if(!ownerUserId)apiFail_('OWNER_REQUIRED','Authenticated Owner is required');
  var started=Date.now(),allFolders=getFolders_(),driveReadMs=Date.now()-started;ownerTimingPhase_('folders_drive_read',driveReadMs);
  started=Date.now();var folders=allFolders.filter(function(folder){return folder&&String(folder.user_id||'')===String(ownerUserId);}).map(function(folder){
    if(!folder.id||!folder.name||!folder.created_at||!folder.updated_at)apiFail_('FOLDER_SCHEMA_INVALID','Folder source does not match the CXL Folder contract');
    return {id:String(folder.id),userId:String(ownerUserId),name:String(folder.name),icon:folder.icon||'📁',color:folder.color||'purple',createdAt:String(folder.created_at),updatedAt:String(folder.updated_at)};
  });
  var projectionMs=Date.now()-started;ownerTimingPhase_('folders_projection',projectionMs);ownerTimingLog_('folders.fetch',{driveReadAndProjectionMs:driveReadMs+projectionMs});return folders;
}

function cxlRowInput_(asset,ownerUserId,request) {
  return {id:asset.id,ownerUserId:ownerUserId,revision:request.revision,title:asset.title,author_name:asset.authorName||'',author_avatar:asset.authorAvatar||'',icon:asset.icon,
    category:asset.category,status:asset.status,visibility:asset.visibility|| (asset.isPublic?'public':'private'),short_description:asset.shortDescription||'',
    content_type_labels:asset.contentTypeLabels||[],content_types:asset.contentTypes||[],presentation_metadata:asset.presentationMetadata||null,
    public_collaboration:asset.publicCollaboration||null,folder_id:asset.folderId||'',tags:asset.tags||[],content:asset.content||'',ui_code_snippet:asset.uiCodeSnippet||'',
    content_blocks:asset.contentBlocks||[],preview_image:asset.previewImage||'',preview_images:asset.previewImages||[],collaboration_asset_id:asset.collaborationAssetId||null,
    deleted_at:asset.deletedAt||null,createRequestId:request.createRequestId||'',writeRequestId:request.requestId,writeOperation:request.operation,writeFingerprint:request.fingerprint,mediaIds:request.mediaIds||[],
    cxlAsset:asset,collaborationDraft:null};
}

function cxlWriteResult_(record) { var asset=cxlAssetFromRecord_(record);return {data:asset,error:null}; }

function ensureHeaders_(sheet,headers) { var last=sheet.getLastColumn();if(last<headers.length)sheet.getRange(1,1,1,headers.length).setValues([headers]); }

function fail_(message) { throw new Error(message); }

function fetchCxlWorks_(options) {
  options=options||{};
  if(options.assetId)return {data:[cxlAssetFromRecord_(getOwnerWork_(options.assetId))],error:null};
  if(options.detail==='full')apiFail_('FULL_LIST_NOT_SUPPORTED','Full Work reads require one assetId');
  var totalStarted=Date.now(),phaseStarted=totalStarted,index=listOwnerIndex_(),indexReadMs=Date.now()-phaseStarted,searchReadMs=0,summaryMs=0;
  ownerTimingPhase_('owner_index_read',indexReadMs);
  if(index.some(function(row){return !privateSummaryReady_(row);}))apiFail_('PRIVATE_SUMMARY_NOT_READY','Owner Work summary index is incomplete; run the controlled summary backfill');
  if(options.userId)index=index.filter(function(row){return row.userId===options.userId;});
  if(options.onlyDeleted&&options.currentUserId)index=index.filter(function(row){return row.userId===options.currentUserId;});
  if(options.category&&options.category!=='all')index=index.filter(function(row){return row.category===options.category;});
  if(options.userId&&options.folderId!==undefined)index=index.filter(function(row){return row.folderId===options.folderId;});
  if(options.publicOnly)index=index.filter(function(row){return row.isPublic&&!row.deletedAt;});
  else if(options.onlyDeleted)index=index.filter(function(row){return !!row.deletedAt;});
  else if(!options.includeDeleted)index=index.filter(function(row){return !row.deletedAt;});
  index.sort(function(a,b){return Date.parse(b.createdAt||'')-Date.parse(a.createdAt||'');});
  if(options.limit)index=index.slice(0,Math.min(100,Math.max(1,Number(options.limit)||100)));
  if(options.search&&String(options.search).trim()){
    var q=normalizeOwnerSearch_(options.search);
    if(q.length>OWNER_SEARCH_MAX_QUERY_CHARS_)apiFail_('SEARCH_QUERY_TOO_LONG','Search query exceeds the supported length');
    phaseStarted=Date.now();var searchRows=listOwnerSearchIndex_(),matching=ownerSearchMatches_(index,searchRows,q);searchReadMs=Date.now()-phaseStarted;
    ownerTimingPhase_('owner_search_index_read',searchReadMs);
    index=index.filter(function(row){return !!matching[row.id];});
  }
  phaseStarted=Date.now();var works=index.map(function(row){return privateSummaryAsset_(row);});summaryMs=Date.now()-phaseStarted;
  ownerTimingPhase_('summary_parse_projection',summaryMs);
  ownerTimingLog_('works.fetch',{indexReadMs:indexReadMs,searchReadMs:searchReadMs,summaryMs:summaryMs,totalMs:Date.now()-totalStarted});
  return {data:works,error:null};
}

function ownerTimingLog_(operation,phases) {
  if(typeof console!=='undefined'&&console&&typeof console.log==='function')console.log(JSON.stringify({event:'cxl_owner_timing',operation:operation,phases:phases}));
}

function privateSummaryAsset_(row) {
  var saved;
  try { saved=JSON.parse(row.summaryJson||''); } catch(_error) { saved=null; }
  if(Number(row.summaryVersion)!==PRIVATE_SUMMARY_VERSION||!saved||saved.summaryVersion!==PRIVATE_SUMMARY_VERSION||!saved.asset||typeof saved.asset!=='object')
    apiFail_('PRIVATE_SUMMARY_NOT_READY','Owner Work summary index is incomplete; run the controlled summary backfill');
  return saved.asset;
}

function normalizeOwnerSearch_(value) { return String(value||'').trim().toLowerCase(); }

function privateText_(value,max) { return typeof value==='string'?value.slice(0,max):''; }

function ownerSearchText_(asset) {
  var values=[asset.title,asset.shortDescription,asset.content,asset.authorName,asset.uiCodeSnippet];
  (asset.contentBlocks||[]).forEach(function(block){if(block){values.push(block.title,block.body);}});
  (asset.tags||[]).forEach(function(tag){values.push(tag);});
  return values.filter(function(value){return typeof value==='string'&&value.length>0;}).join('\n').toLowerCase();
}

function ownerSearchChunks_(text) {
  text=String(text||'');if(!text)return [];
  var chunks=[],step=OWNER_SEARCH_CHUNK_CHARS_-OWNER_SEARCH_OVERLAP_CHARS_;
  for(var start=0;start<text.length;start+=step){
    var end=Math.min(text.length,start+OWNER_SEARCH_CHUNK_CHARS_);
    // Avoid splitting a UTF-16 surrogate pair at a boundary.
    if(end<text.length&&end>start&&/[\uD800-\uDBFF]/.test(text.charAt(end-1))&&/[\uDC00-\uDFFF]/.test(text.charAt(end)))end--;
    chunks.push(text.slice(start,end));if(end>=text.length)break;
  }
  return chunks;
}

function ownerSearchArtifacts_(asset) {
  var text=ownerSearchText_(asset),chunks=ownerSearchChunks_(text);
  return {text:text,chunks:chunks,version:OWNER_SEARCH_VERSION_,token:Utilities.getUuid(),updatedAt:new Date().toISOString()};
}

function compactOwnerRef_(value) {
  return typeof value==='string'&&value.length<=1024&&!/^data:/i.test(value)?value:'';
}

function privateSummaryJson_(record) {
  var asset=cxlAssetFromRecord_(record);
  var icon=asset.icon;
  if(icon&&icon.type==='image') {
    var ref=compactOwnerRef_(icon.value);
    icon=ref?{type:'image',value:ref,mediaId:icon.mediaId||undefined}:{type:'emoji',value:'✨'};
  } else if(icon&&typeof icon.value==='string') icon={type:icon.type,value:privateText_(icon.value,96)};
  var previewImage=compactOwnerRef_(asset.previewImage||'');
  var previewImages=(asset.previewImages||[]).map(compactOwnerRef_).filter(Boolean).slice(0,6);
  var summary={id:asset.id,userId:asset.userId,publicCreatorId:asset.publicCreatorId,authorName:privateText_(asset.authorName||'Creator',200),title:privateText_(asset.title||'',1000),
    icon:icon||{type:'emoji',value:'✨'},category:asset.category,shortDescription:privateText_(asset.shortDescription||'',800),
    contentTypeLabels:(asset.contentTypeLabels||[]).slice(0,20).map(function(x){return privateText_(x,100);}),contentTypes:(asset.contentTypes||[]).slice(0,20),presentationMetadata:privatePresentationMetadata_(asset.presentationMetadata),
    publicCollaboration:asset.publicCollaboration?privateCardCollaboration_(asset.publicCollaboration):null,collaborationAssetId:asset.collaborationAssetId||null,
    contentBlocks:(asset.contentBlocks||[]).map(function(block){return {id:privateText_(block.id||'',50),type:privateText_(block.type||'Text',30),title:privateText_(block.title||'',100),body:''};}).slice(0,24),
    content:String(asset.content||'').slice(0,600),uiCodeSnippet:String(asset.uiCodeSnippet||'').slice(0,600),
    previewImage:previewImage,previewImages:previewImages,media:[],folderId:asset.folderId||null,isPublic:!!asset.isPublic,
    visibility:asset.visibility||'private',status:asset.status||'draft',tags:(asset.tags||[]).slice(0,50).map(function(x){return privateText_(x,80);}),createdAt:asset.createdAt||'',updatedAt:asset.updatedAt||'',
    deletedAt:asset.deletedAt||null,likesCount:Number(asset.likesCount)||0,forkCount:Number(asset.forkCount)||0,
    forkedFromId:asset.forkedFromId||null,forkedFromAuthor:asset.forkedFromAuthor||null,linkedAssetIds:asset.linkedAssetIds||[],revision:Number(asset.revision)||1};
  var serialized=JSON.stringify({summaryVersion:PRIVATE_SUMMARY_VERSION,asset:summary});
  if(serialized.length>PRIVATE_SUMMARY_MAX_CHARS)apiFail_('PRIVATE_SUMMARY_TOO_LARGE','Owner Work summary exceeds the configured size limit');
  return serialized;
}

function privatePresentationMetadata_(value) {
  if(!value||typeof value!=='object')return null;
  function strings(items){return (Array.isArray(items)?items:[]).filter(function(x){return typeof x==='string';}).slice(0,12).map(function(x){return privateText_(x,80);});}
  return {contentTypes:strings(value.contentTypes),appPlatforms:strings(value.appPlatforms),audienceRating:privateText_(value.audienceRating||'general',40),
    contentWarnings:strings(value.contentWarnings),genres:strings(value.genres),imagePromptToolModel:privateText_(value.imagePromptToolModel||'',120),workStatus:privateText_(value.workStatus||'not_started',40)};
}

function privateCardCollaboration_(value) {
  var card=publicCardCollaboration_(value);if(!card)return null;
  card.name=privateText_(card.name,300);card.sharedTag=privateText_(card.sharedTag,120);
  card.platforms=(card.platforms||[]).slice(0,12).map(function(x){return privateText_(x,80);});
  card.deadlines=(card.deadlines||[]).slice(0,20).map(function(x){return {label:privateText_(x.label,80),date:privateText_(x.date,40)};});
  card.sharedInformation=(card.sharedInformation||[]).slice(0,20);card.participants=(card.participants||[]).slice(0,50);
  return card;
}

function backfillOwnerSummaryIndex_(limit) {
  var batch=Math.min(20,Math.max(1,Number(limit)||20)),sh=sheet_(config_().privateSheetId);
  ensurePrivateHeaders_(sh);var searchSh=ownerSearchSheet_(true),rows=objectRows_(sh),searchRows=objectRows_(searchSh),groupedSearchRows=groupOwnerSearchRows_(searchRows);
  rows.forEach(function(row){var state=ownerSearchState_(row,groupedSearchRows);if(state.ready&&state.staleChunks)removeStaleOwnerSearchChunks_(searchSh,row.id,state.token);});
  cleanOwnerSearchIndex_(searchSh,rows);
  var pending=rows.filter(function(row){return !privateSummaryReady_(row)||!ownerSearchState_(row,groupedSearchRows).ready||hasLegacySearchText_(sh,row);}).slice(0,batch),updated=0,driveReads=0;
  pending.forEach(function(row){
    var record=parse_(row.file_id);driveReads++; // Read canonical JSON only for a stale/missing index entry.
    var artifacts=ownerSearchArtifacts_(cxlAssetFromRecord_(record)),metadata=privateMeta_(record,row.file_id,artifacts);
    appendOwnerSearchChunks_(searchSh,row.id,artifacts);
    setPrivateIndexRow_(sh,metadata,row._sheetRow);
    removeStaleOwnerSearchChunks_(searchSh,row.id,artifacts.token);
    updated++;
  });
  removeLegacySearchColumnIfEmpty_(sh);
  var finalRows=objectRows_(sh),finalSearchRows=objectRows_(searchSh),summaryStats=ownerSummaryReadiness_(finalRows),searchStats=ownerSearchReadiness_(finalRows,finalSearchRows);
  return {processed:updated,driveReads:driveReads,remaining:summaryStats.missing+summaryStats.invalid+searchStats.missingWorks+searchStats.invalidWorks,ready:summaryStats.missing+summaryStats.invalid+searchStats.missingWorks+searchStats.invalidWorks===0,batchLimit:batch,
    missingSummaries:summaryStats.missing,invalidSummaries:summaryStats.invalid,missingSearchWorks:searchStats.missingWorks,invalidSearchWorks:searchStats.invalidWorks,missingSearchChunks:searchStats.missingChunks,invalidSearchChunks:searchStats.invalidChunks,staleExtraChunks:searchStats.staleExtraChunks};
}

function verifyOwnerSummaryReadiness_() {
  var sh=sheet_(config_().privateSheetId),rows=objectRows_(sh),searchSh=ownerSearchSheet_(false),searchRows=searchSh?objectRows_(searchSh):[],summary=ownerSummaryReadiness_(rows),search=ownerSearchReadiness_(rows,searchRows);
  return {total:rows.length,validSummaries:summary.valid,missingSummaries:summary.missing,invalidSummaries:summary.invalid,
    validSearchWorks:search.validWorks,missingSearchWorks:search.missingWorks,invalidSearchWorks:search.invalidWorks,
    missingSearchChunks:search.missingChunks,invalidSearchChunks:search.invalidChunks,staleExtraChunks:search.staleExtraChunks,
    ready:summary.missing+summary.invalid+search.missingWorks+search.invalidWorks===0,summaryVersion:PRIVATE_SUMMARY_VERSION,searchVersion:OWNER_SEARCH_VERSION_};
}

function compactOwnerSearchIndex_(limit) {
  var batch=Math.min(20,Math.max(1,Number(limit)||20)),lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var privateRows=objectRows_(sheet_(config_().privateSheetId)),byId=Object.create(null);
    privateRows.forEach(function(row){var id=String(row.id);if(Object.prototype.hasOwnProperty.call(byId,id))apiFail_('INDEX_ROW_AMBIGUOUS','Private Index contains duplicate Work rows');byId[id]=String(row.search_index_token||'');});
    var searchSh=ownerSearchSheet_(false);if(!searchSh)return {deleted:0,remaining:0,batchLimit:batch};
    var stale=objectRows_(searchSh).filter(function(row){var token=byId[String(row.work_id||'')];return !token||String(row.index_token||'')!==token;});
    var selected=stale.slice(0,batch).map(function(row){return row._sheetRow;});
    deleteSheetRowsDescending_(searchSh,selected);
    return {deleted:selected.length,remaining:stale.length-selected.length,batchLimit:batch};
  } finally {lock.releaseLock();}
}

function privateSummaryReady_(row) {
  var version=row.summary_version===undefined?row.summaryVersion:row.summary_version;
  var json=row.summary_json===undefined?row.summaryJson:row.summary_json;
  if(Number(version)!==PRIVATE_SUMMARY_VERSION)return false;
  try { var value=JSON.parse(json||'');return value&&value.summaryVersion===PRIVATE_SUMMARY_VERSION&&value.asset&&value.asset.id===row.id; }
  catch(_error) { return false; }
}

function ownerSearchState_(row,searchRows) {
  var workId=String(row.id||''),token=String(row.search_index_token||row.searchIndexToken||''),version=Number(row.search_version||row.searchVersion||0),expected=Number(row.search_chunk_count===undefined?row.searchChunkCount:row.search_chunk_count);
  if(!Number.isInteger(expected)||expected<0)expected=-1;
  var grouped=Array.isArray(searchRows)?groupOwnerSearchRows_(searchRows):(searchRows||{}),workRows=grouped[workId]||[];
  var active=workRows.filter(function(x){return String(x.index_token||x.indexToken||'')===token&&Number(x.search_version||x.searchVersion)===OWNER_SEARCH_VERSION_;});
  var indices={},invalid=0;
  active.forEach(function(x){var n=Number(x.chunk_index===undefined?x.chunkIndex:x.chunk_index),text=x.search_text===undefined?x.searchText:x.search_text;if(!Number.isInteger(n)||n<0||n>=expected||indices[n]||typeof text!=='string'||text.length>OWNER_SEARCH_CHUNK_CHARS_)invalid++;else indices[n]=true;});
  var valid=version===OWNER_SEARCH_VERSION_&&!!token&&expected>=0&&active.length===expected&&invalid===0;
  if(valid)for(var i=0;i<expected;i++)if(!indices[i]){valid=false;break;}
  var totalForWork=workRows.length;
  return {ready:valid,missingChunks:valid?0:Math.max(0,(expected<0?0:expected)-active.length),invalidChunks:invalid+(expected>=0&&active.length>expected?active.length-expected:0),active:active,token:token,expected:expected,staleChunks:Math.max(0,totalForWork-active.length)};
}

function ownerSearchMatches_(index,searchRows,query) {
  var result={},byId={},grouped=groupOwnerSearchRows_(searchRows||[]);(index||[]).forEach(function(row){byId[String(row.id)]=row;});
  (index||[]).forEach(function(row){var state=ownerSearchState_(row,grouped);if(!state.ready)apiFail_('OWNER_SEARCH_INDEX_NOT_READY','Owner Work search index is incomplete; run the controlled index backfill');});
  Object.keys(grouped).forEach(function(id){var row=byId[id];if(!row)return;var state=ownerSearchState_(row,grouped);if(!state.ready)return;state.active.forEach(function(chunk){if(String(chunk.search_text||chunk.searchText||'').indexOf(query)>=0)result[id]=true;});});
  return result;
}

function groupOwnerSearchRows_(rows) { var grouped={};(rows||[]).forEach(function(row){var id=String(row.work_id||row.workId||'');if(!grouped[id])grouped[id]=[];grouped[id].push(row);});return grouped; }

function ownerSummaryReadiness_(rows) { var missing=0,invalid=0;(rows||[]).forEach(function(row){var json=row.summary_json||row.summaryJson||'';if(!json)missing++;else if(!privateSummaryReady_(row))invalid++;});return {valid:(rows||[]).length-missing-invalid,missing:missing,invalid:invalid}; }

function ownerSearchReadiness_(rows,searchRows) {
  var missingWorks=0,invalidWorks=0,missingChunks=0,invalidChunks=0,activeRowCount=0,grouped=groupOwnerSearchRows_(searchRows||[]);
  (rows||[]).forEach(function(row){var state=ownerSearchState_(row,grouped);activeRowCount+=state.active.length;if(!state.ready){if(!row.search_index_token&&!row.searchIndexToken)missingWorks++;else invalidWorks++;missingChunks+=state.missingChunks;invalidChunks+=state.invalidChunks;}});
  return {validWorks:(rows||[]).length-missingWorks-invalidWorks,missingWorks:missingWorks,invalidWorks:invalidWorks,missingChunks:missingChunks,invalidChunks:invalidChunks,staleExtraChunks:Math.max(0,(searchRows||[]).length-activeRowCount)};
}

function cleanOwnerSearchIndex_(searchSh,privateRows) {
  var ids={};(privateRows||[]).forEach(function(row){ids[String(row.id)]=true;});
  var rows=objectRows_(searchSh),numbers=rows.filter(function(row){return !ids[String(row.work_id||'')];}).map(function(row){return row._sheetRow;}).sort(function(a,b){return b-a;});
  numbers.forEach(function(rowNumber){searchSh.deleteRow(rowNumber);});
}

function ownerSearchSheet_(createIfMissing) {
  var book=SpreadsheetApp.openById(config_().privateSheetId),sh=book.getSheetByName(OWNER_SEARCH_SHEET_);
  if(!sh&&createIfMissing)sh=book.insertSheet(OWNER_SEARCH_SHEET_);
  if(sh){var actualLast=sh.getLastColumn(),headers=actualLast?sh.getRange(1,1,1,actualLast).getValues()[0].map(String):[];
    if(!headers.some(function(value){return !!value;}))sh.getRange(1,1,1,OWNER_SEARCH_HEADERS_.length).setValues([OWNER_SEARCH_HEADERS_]);
    else {var missing=OWNER_SEARCH_HEADERS_.filter(function(key){return headers.indexOf(key)<0;});if(missing.length)sh.getRange(1,actualLast+1,1,missing.length).setValues([missing]);}}
  return sh;
}

function listOwnerSearchIndex_() { var sh=ownerSearchSheet_(false);return sh?objectRows_(sh):[]; }

function appendOwnerSearchChunks_(sh,workId,artifacts) {
  var last=sh.getLastColumn(),headers=sh.getRange(1,1,1,last).getValues()[0].map(String);
  var rows=artifacts.chunks.map(function(text,index){var item={work_id:workId,chunk_index:index,search_text:text,search_version:artifacts.version,updated_at:artifacts.updatedAt,index_token:artifacts.token};return headers.map(function(key){return item[key]===undefined?'':item[key];});});
  if(rows.length)sh.getRange(sh.getLastRow()+1,1,rows.length,last).setValues(rows);
}

function removeStaleOwnerSearchChunks_(sh,workId,keepToken) {
  var lastRow=sh.getLastRow(),lastColumn=sh.getLastColumn();if(lastRow<2||lastColumn<1)return;
  var headers=sh.getRange(1,1,1,lastColumn).getValues()[0].map(String),workColumn=headers.indexOf('work_id')+1,tokenColumn=headers.indexOf('index_token')+1;
  if(!workColumn||!tokenColumn)return;
  var matching=findSheetRowsByCellValue_(sh,workColumn,workId),stale=[];
  contiguousRowGroups_(matching).forEach(function(group){var tokens=sh.getRange(group.start,tokenColumn,group.count,1).getValues();for(var i=0;i<group.count;i++)if(String(tokens[i][0]||'')!==String(keepToken))stale.push(group.start+i);});
  deleteSheetRowsDescending_(sh,stale);
}

function deleteSheetRowsDescending_(sh,numbers) {
  if(!numbers.length)return;
  numbers.sort(function(a,b){return b-a;});var start=numbers[0],count=1;
  for(var j=1;j<numbers.length;j++){
    if(numbers[j]===start-1){start=numbers[j];count++;}
    else {sh.deleteRows(start,count);start=numbers[j];count=1;}
  }
  sh.deleteRows(start,count);
}

function hasLegacySearchText_(sh,row) {
  return !!row.search_text;
}

function removeLegacySearchColumnIfEmpty_(sh) {
  var headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),index=headers.indexOf('search_text');
  if(index<0)return;
  var lastRow=sh.getLastRow();if(lastRow>1&&sh.getRange(2,index+1,lastRow-1,1).getValues().some(function(row){return !!row[0];}))return;
  sh.deleteColumn(index+1);
}

function setPrivateIndexRow_(sh,metadata,rowNumber,knownRow) {
  var last=Math.max(1,sh.getLastColumn()),headers=sh.getRange(1,1,1,last).getValues()[0].map(String),found=rowNumber?{_sheetRow:rowNumber}:rowById_(sh,metadata.id);
  if(knownRow&&String(knownRow.id)!==String(metadata.id))apiFail_('INDEX_ROW_AMBIGUOUS','Locked Private Index row does not match the Work');
  var values=knownRow&&found?headers.map(function(header){return Object.prototype.hasOwnProperty.call(knownRow,header)?knownRow[header]:'';}):found?sh.getRange(found._sheetRow,1,1,last).getValues()[0]:headers.map(function(){return '';});
  headers.forEach(function(header,index){if(header==='search_text'){values[index]='';return;}if(Object.prototype.hasOwnProperty.call(metadata,header))values[index]=metadata[header]===undefined||metadata[header]===null?'':metadata[header];});
  if(found)sh.getRange(found._sheetRow,1,1,last).setValues([values]);else sh.appendRow(values);
}

function ensurePrivateHeaders_(sh) {
  var last=Math.max(1,sh.getLastColumn()),headers=sh.getRange(1,1,1,last).getValues()[0].map(String),missing=PRIVATE_HEADERS.filter(function(key){return headers.indexOf(key)<0;});
  if(missing.length)sh.getRange(1,last+1,1,missing.length).setValues([missing]);
}

function publicProjectionAction_(wasPublic,nowPublic) { return nowPublic?'upsert':(wasPublic?'deactivate':'none'); }

function finishCxlPublicProjection_(record,ownerUserId) {
  if(publicProjectionAction_(false,isPublic_(record.row))!=='upsert')return;
  try { upsertWorkCreatorMap_(record.row.id,privatePublicCreatorId_(ownerUserId));syncPublic_(record); }
  catch(error){error.apiCode='PUBLIC_SYNC_PENDING';error.privateSaved=true;error.workId=record.row.id;error.message='บันทึก Work ใน Owner แล้ว แต่ Public projection ยัง sync ไม่สำเร็จ ให้กดบันทึกซ้ำเพื่อซ่อมรายการเดิม (อย่าสร้างงานใหม่)';throw error;}
}

function flag_(value) { return value===true || String(value).toLowerCase()==='true'; }

function folder_(id) { if (!id) fail_('ยังไม่ได้ตั้งค่าพื้นที่เก็บข้อมูล'); return DriveApp.getFolderById(id); }

function getFolders_() {
  var it=folder_(config_().incomingId).getFilesByName('folders.jsonl'); if(!it.hasNext())return [];
  return it.next().getBlob().getDataAsString('UTF-8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function getOwnerWork_(id) { var x=rowById_(sheet_(config_().privateSheetId),id); if(!x)fail_('ไม่พบงาน'); return parse_(x.file_id); }

function isPublic_(r) { return r.visibility==='public' && flag_(r.is_public) && !r.deleted_at; }

function listOwnerIndex_() {
  var c=config_(); if(!c.privateSheetId)return [];
  return objectRows_(sheet_(c.privateSheetId)).map(function(x){return {id:x.id,title:x.title,category:x.category,status:x.status,visibility:x.visibility,isPublic:flag_(x.is_public),deletedAt:x.deleted_at||null,folderId:x.folder_id||null,tags:JSON.parse(x.tags||'[]'),updatedAt:x.updated_at,createdAt:x.created_at||'',userId:x.user_id||'',revision:Number(x.revision),hasDraft:flag_(x.has_collab_draft),mediaCount:Number(x.media_count)||0,coverRef:x.cover_ref||'',summaryJson:x.summary_json||'',summaryVersion:Number(x.summary_version)||0,searchVersion:Number(x.search_version)||0,searchChunkCount:Number(x.search_chunk_count)||0,searchIndexToken:x.search_index_token||''};});
}

function objectRows_(sheet) { var h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]; return values_(sheet).map(function(v,i){var o={_sheetRow:i+2}; h.forEach(function(k,j){o[k]=v[j];}); return o;}); }

function parse_(fileId) { return JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8')); }

function privateMeta_(record,fileId,artifacts) {
  var r=record.row,asset=cxlAssetFromRecord_(record);
  artifacts=artifacts||ownerSearchArtifacts_(asset);
  return { id:r.id,title:r.title||'',category:r.category||'character',status:r.status||'draft',visibility:r.visibility||'private',is_public:r.is_public===true?'true':'false',deleted_at:r.deleted_at||'',folder_id:r.folder_id||'',tags:JSON.stringify(r.tags||[]),updated_at:r.updated_at||'',revision:record.revision||1,file_id:fileId,has_collab_draft:record.collaborationDraft?'true':'false',media_count:(record.mediaRecords||[]).length,cover_ref:r.preview_image||'',create_request_id:record.createRequestId||'',user_id:r.user_id||asset.userId||'',created_at:r.created_at||asset.createdAt||'',summary_json:privateSummaryJson_(record),summary_version:PRIVATE_SUMMARY_VERSION,search_version:artifacts.version,search_chunk_count:artifacts.chunks.length,search_index_token:artifacts.token };
}

function privatePublicCreatorId_(ownerUserId) {
  var book=SpreadsheetApp.openById(config_().privateSheetId),sh=book.getSheetByName('PrivateCreatorMap');
  if(!sh)apiFail_('CREATOR_MAPPING_MISSING','Private creator mapping is not configured');
  var matches=objectRows_(sh).filter(function(row){return String(row.internalProfileId||'')===String(ownerUserId);});
  if(matches.length!==1||!/^cxlc_[a-f0-9]{32}$/i.test(String(matches[0].publicCreatorId||'')))apiFail_('CREATOR_MAPPING_MISSING','Private creator mapping is missing or ambiguous');
  return String(matches[0].publicCreatorId);
}

function projection_(record) {
  var r=record.row;
  var collab=r.category==='collab'?(record.collaborationDraft?publicSnapshot_(record.collaborationDraft):(r.public_collaboration||null)):null;
  var refs=[r.preview_image].concat(r.preview_images||[]);
  if(r.icon&&r.icon.type==='image')refs.push(r.icon.value||'',r.icon.mediaId?'media:'+r.icon.mediaId:'');
  (r.content_blocks||[]).forEach(function(block){if(block&&block.type==='Image')refs.push(block.body||'',block.mediaId?'media:'+block.mediaId:'');});
  if(collab)(collab.participants||[]).forEach(function(p){(p.referenceImages||[]).forEach(function(x){refs.push(typeof x==='string'?x:(x.src||x.storageKey||''));});});
  return {id:r.id,title:r.title,author_name:r.author_name,author_avatar:r.author_avatar,icon:r.icon,category:r.category,short_description:r.short_description,content_type_labels:r.content_type_labels||[],content_types:r.content_types||[],presentation_metadata:r.presentation_metadata||null,content:r.content||'',ui_code_snippet:r.ui_code_snippet||'',content_blocks:r.content_blocks||[],preview_image:r.preview_image||'',preview_images:r.preview_images||[],tags:r.tags||[],status:r.status,created_at:r.created_at,updated_at:r.updated_at,collaboration_asset_id:r.category==='collab'?null:(r.collaboration_asset_id||null),public_collaboration:collab,mediaRecords:(record.mediaRecords||[]).filter(function(m){return refs.indexOf('media:'+m.id)>=0||refs.indexOf(m.storage_path)>=0;}).map(function(m){return {id:m.id,storage_path:m.delivery==='vercel_proxy'?null:m.storage_path,purpose:m.purpose,mime_type:m.mime_type,sort_order:m.sort_order,is_cover:m.is_cover,delivery:m.delivery==='vercel_proxy'?'vercel_proxy':null,drive_file_id:m.delivery==='vercel_proxy'?null:(m.drive_file_id||null),drive_url:m.delivery==='vercel_proxy'?null:(m.drive_url||null),original_ref:m.original_ref||null};}),cxlAsset:record.cxlAsset?sanitizeCxlAsset_(record.cxlAsset):null};
}

function props_() { return PropertiesService.getScriptProperties(); }

function publicCardCollaboration_(value) {
  if(!value||typeof value!=='object')return null;
  return {name:String(value.name||''),sharedTag:String(value.sharedTag||''),platforms:summaryStrings_(value.platforms),
    sharedInformation:summaryArray_(value.sharedInformation).map(function(){return {}; }),
    deadlines:summaryArray_(value.deadlines).filter(function(x){return x&&typeof x==='object'&&(x.label||x.date);}).map(function(x){return {label:String(x.label||''),date:String(x.date||'')};}),
    participants:summaryArray_(value.participants).map(function(){return {};})};
}

function publicSnapshot_(d) {
  if (!d) return null;
  var p=d.visibilityPolicy||{};
  var policy={showParticipantStatuses:!!p.showParticipantStatuses,showParticipantNotes:!!p.showParticipantNotes,showParticipantDeadlineOverrides:!!p.showParticipantDeadlineOverrides};
  return {name:d.name||'',sharedTag:d.sharedTag||'',platforms:d.platforms||[],sharedInformation:(d.sharedInformation||[]).filter(function(x){return x.title||x.content;}).map(function(x){return {id:x.id,title:x.title,type:x.type,content:x.content,appScope:x.appScope,platforms:x.platforms||[]};}),deadlines:(d.deadlines||[]).filter(function(x){return x.label||x.date;}),participants:(d.participants||[]).filter(function(x){return x.creatorName||x.externalWorkName||(x.referenceImages||[]).length;}).map(function(x){var q={id:x.id,isOwner:!!x.isOwner,creatorName:x.creatorName||'',houseTag:x.houseTag||'',platforms:x.platforms||[],externalWorkName:x.externalWorkName||'',referenceImages:x.referenceImages||[],linkedWorkIds:x.linkedWorkIds||[]};if(policy.showParticipantStatuses){q.dataStatus=x.dataStatus;q.imageStatus=x.imageStatus;}if(policy.showParticipantNotes)q.notes=x.notes||'';if(policy.showParticipantDeadlineOverrides&&x.useDeadlineOverrides)q.deadlineOverrides=x.deadlineOverrides||{};return q;}),visibilityPolicy:policy};
}

function publicSummaryEnvelope_(pub) {
  pub=pub||{};var a=pub.cxlAsset&&typeof pub.cxlAsset==='object'?pub.cxlAsset:{};
  var rawCollab=a.publicCollaboration||pub.public_collaboration||null;
  var presentation=a.presentationMetadata||pub.presentation_metadata||{};
  var cover=String(a.previewImage||pub.preview_image||'');if(/^data:image\//i.test(cover))cover='';
  var mediaSource=summaryArray_(a.media).concat(summaryArray_(pub.mediaRecords||pub.media_records));
  var coverId=cover.indexOf('media:')===0?cover.slice(6):'';
  var media=mediaSource.filter(function(m){return m&&((m.purpose||'')==='icon'||!!(m.isCover||m.is_cover)||String(m.id||'')===coverId);}).map(function(m){return {
    id:String(m.id||''),assetId:String(m.assetId||m.asset_id||pub.id||a.id||''),purpose:String(m.purpose||''),contextId:m.contextId||m.context_id||null,
    mimeType:m.mimeType||m.mime_type||'',fileSize:Number(m.fileSize||m.file_size||0),sortOrder:Number(m.sortOrder||m.sort_order||0),
    isCover:!!(m.isCover||m.is_cover),createdAt:m.createdAt||m.created_at||'',updatedAt:m.updatedAt||m.updated_at||''};});
  var platforms=summaryStrings_(presentation.appPlatforms);
  var asset={id:String(a.id||pub.id||''),title:String(a.title||pub.title||''),authorName:String(a.authorName||pub.author_name||'Creator'),
    category:String(a.category||pub.category||'character'),shortDescription:String(a.shortDescription||pub.short_description||''),
    contentTypeLabels:summaryStrings_(a.contentTypeLabels||pub.content_type_labels),contentTypes:summaryStrings_(a.contentTypes||pub.content_types),
    presentationMetadata:platforms.length?{appPlatforms:platforms.map(String)}:undefined,publicCollaboration:publicCardCollaboration_(rawCollab),
    collaborationAssetId:a.collaborationAssetId||pub.collaboration_asset_id||null,icon:publicSummaryIcon_(a.icon||pub.icon,media),content:'',contentBlocks:[],uiCodeSnippet:'',
    previewImage:cover,previewImages:cover?[cover]:[],media:media,folderId:null,isPublic:true,visibility:'public',
    status:String(a.status||pub.status||'finished'),tags:summaryStrings_(a.tags||pub.tags),createdAt:String(a.createdAt||pub.created_at||''),
    updatedAt:String(a.updatedAt||pub.updated_at||''),deletedAt:null,likesCount:Number(a.likesCount||pub.likes_count||0),
    forkedFromAuthor:a.forkedFromAuthor||pub.forked_from_author||null,versions:[]};
  return {summaryVersion:PUBLIC_SUMMARY_VERSION,asset:asset};
}

function publicSummaryIcon_(icon,media) {
  if(!icon||typeof icon!=='object')return {type:'emoji',value:'✨'};
  var type=String(icon.type||''),value=typeof icon.value==='string'?icon.value:'';
  if((type==='emoji'||type==='kaomoji')&&value&&value.length<=96)return {type:type,value:value};
  if(type!=='image')return {type:'emoji',value:'✨'};
  var mediaId=String(icon.mediaId||'');
  if(!mediaId&&value.indexOf('media:')===0)mediaId=value.slice(6);
  var iconMedia=mediaId?(media||[]).filter(function(m){return m.id===mediaId&&m.purpose==='icon';})[0]:null;
  if(iconMedia)return {type:'image',value:'media:'+mediaId,mediaId:mediaId,mimeType:iconMedia.mimeType||''};
  if(/^cxl-media:[a-f0-9]{64}$/.test(value))return {type:'image',value:value};
  if(/^https:\/\//i.test(value)&&value.length<=2048)return {type:'image',value:value};
  return {type:'emoji',value:'✨'};
}

function publicSummaryJson_(pub) {
  var json=JSON.stringify(publicSummaryEnvelope_(pub));
  return json.length<=PUBLIC_SUMMARY_MAX_CHARS?json:JSON.stringify({summaryVersion:0,error:'summary_too_large',chars:json.length});
}

function putJsonRevision_(folderId,name,value) {
  var matches=folder_(folderId).getFilesByName(name),file=matches.hasNext()?matches.next():null;
  if(file){if(matches.hasNext())apiFail_('DUPLICATE_REVISION_FILE','Duplicate Work revision file');file.setContent(JSON.stringify(value));return file.getId();}
  return putJson_(folderId,name,value);
}

function putJson_(folderId,name,value) { return folder_(folderId).createFile(Utilities.newBlob(JSON.stringify(value),'application/json',name)).getId(); }

function mediaWorkReferenceMap_(asset) {
  var refs={};
  function add(value,purpose,contextId,sortOrder,isCover,declaredMediaId) {
    var match=typeof value==='string'?value.match(/^media:([A-Za-z0-9_-]+)$/i):null;
    if(!match)return;
    var id=match[1];
    if(declaredMediaId&&String(declaredMediaId)!==id)apiFail_('UNSUPPORTED_MEDIA_MUTATION','Work media identity does not match its canonical reference.');
    if(refs[id])apiFail_('UNSUPPORTED_MEDIA_MUTATION','A Work media identity cannot be used for more than one media placement.');
    refs[id]={id:id,purpose:purpose,contextId:contextId||null,sortOrder:Number(sortOrder)||0,isCover:!!isCover};
  }
  var icon=asset&&asset.icon;
  if(icon&&icon.type==='image')add(icon.value,'icon',null,0,false,icon.mediaId);
  var preview=asset&&Array.isArray(asset.previewImages)?asset.previewImages:[];
  preview.forEach(function(value,index){add(value,'gallery',null,index,value===asset.previewImage);});
  if(asset&&typeof asset.previewImage==='string'&&asset.previewImage&&preview.indexOf(asset.previewImage)<0)
    add(asset.previewImage,'gallery',null,preview.length,true);
  (asset&&Array.isArray(asset.contentBlocks)?asset.contentBlocks:[]).forEach(function(block,index){
    if(block&&block.type==='Image')add(block.body,'prompt_example',block.id,index,false,block.mediaId);
  });
  return refs;
}

function mediaWorkAllReferences_(asset) {
  var found=[];
  function walk(value,key) {
    if(typeof value==='string'){
      if(/^\s*(?:data:image\/|blob:)/i.test(value)||key==='localBlobKey'||key==='storageKey')apiFail_('UNSUPPORTED_MEDIA_MUTATION','Inline media must be uploaded before saving a Work.');
      var match=value.match(/^(media:[A-Za-z0-9_-]+|cxl-media:[a-f0-9]{64})$/i);if(match)found.push(match[1]);
      return;
    }
    if(Array.isArray(value)){value.forEach(function(item){walk(item,key);});return;}
    if(value&&typeof value==='object')Object.keys(value).forEach(function(child){walk(value[child],child);});
  }
  walk(asset,'');
  return found;
}

function rejectUnsupportedWorkMedia_(asset,existing,mediaIds) {
  if(asset&&asset.category==='collab'&&(mediaIds||[]).length)
    apiFail_('UNSUPPORTED_COLLAB_DRAFT','Collaboration media uploads are deferred to GO 8.');
  var refs=mediaWorkAllReferences_(asset),uniqueRefs=refs.filter(function(ref,index){return refs.indexOf(ref)===index;});
  var oldRefs=existing?mediaWorkAllReferences_(existing):[],oldSet={};oldRefs.forEach(function(ref){oldSet[ref]=true;});
  if(existing&&oldRefs.some(function(ref){return uniqueRefs.indexOf(ref)<0;}))
    apiFail_('UNSUPPORTED_MEDIA_MUTATION','Replacing or removing Work media is deferred to GO 7B.3.');
  var newRefs=uniqueRefs.filter(function(ref){return !oldSet[ref];});
  var newMediaIds=newRefs.filter(function(ref){return ref.indexOf('media:')===0;}).map(function(ref){return ref.slice(6);}).sort();
  if(newRefs.some(function(ref){return ref.indexOf('media:')!==0;}))apiFail_('UNSUPPORTED_MEDIA_MUTATION','New legacy media references are not supported.');
  var supplied=(mediaIds||[]).slice().sort();
  if(newMediaIds.join('|')!==supplied.join('|'))apiFail_('UNSUPPORTED_MEDIA_MUTATION','Every new Work media reference must match a finalized upload.');
  var placements=mediaWorkReferenceMap_(asset);
  if(newMediaIds.some(function(id){return !placements[id];}))apiFail_('UNSUPPORTED_MEDIA_MUTATION','New Work media must use an icon, gallery, or content image placement.');
  if(existing){
    var oldMedia=JSON.stringify(existing.media||[]),newMedia=Object.prototype.hasOwnProperty.call(asset,'media')?JSON.stringify(asset.media||[]):oldMedia;
    if(oldMedia!==newMedia)apiFail_('UNSUPPORTED_MEDIA_MUTATION','Work media record mutation is deferred to GO 7B.3.');
  }
}

function mediaWorkAttach_(record,asset,mediaIds,workId,ownerUserId) {
  var placements=mediaWorkReferenceMap_(asset),ids=(mediaIds||[]).slice(),unique={};
  if(ids.some(function(id){if(!mediaPocUuid_(id)||unique[id])return true;unique[id]=true;return false;}))
    apiFail_('UNSUPPORTED_MEDIA_MUTATION','Work media attachment list is invalid.');
  var existingById={};(record.mediaRecords||[]).forEach(function(m){existingById[m.id]=m;});
  var manifests=[];
  ids.forEach(function(id){
    var placement=placements[id],manifest=mediaWorkReadJson_(mediaWorkManifestKey_(id));
    if(!placement||!manifest||manifest.ownerUserId!==ownerUserId||manifest.workId!==workId||manifest.mediaId!==id
      ||manifest.delivery!=='vercel_proxy'||['finalized','attached'].indexOf(manifest.state)<0
      ||manifest.purpose!==placement.purpose||String(manifest.contextId||'')!==String(placement.contextId||'')
      ||Number(manifest.sortOrder)!==Number(placement.sortOrder)||Boolean(manifest.isCover)!==Boolean(placement.isCover))
      apiFail_('UNSUPPORTED_MEDIA_MUTATION','Work media upload does not match this Owner, Work, or image placement.');
    var file,validPrivateFile=false;
    try{file=DriveApp.getFileById(manifest.drive_file_id);validPrivateFile=!!file&&file.getSharingAccess()===DriveApp.Access.PRIVATE&&file.getSize()===Number(manifest.totalFileSize);}
    catch(_error){apiFail_('MEDIA_UPLOAD_MEDIA_INVALID','Finalized Work media is unavailable or invalid.');}
    if(!validPrivateFile)
      apiFail_('MEDIA_UPLOAD_MEDIA_INVALID','Finalized Work media is not private or has an invalid size.');
    var existing=existingById[id];
    if(existing&&String(existing.drive_file_id||'')!==String(manifest.drive_file_id||''))apiFail_('UNSUPPORTED_MEDIA_MUTATION','Work media identity is already attached to a different file.');
    if(!existing){
      existing={id:id,asset_id:workId,storage_path:'google-work-media/'+id,purpose:manifest.purpose,context_id:manifest.contextId||null,
        mime_type:manifest.mimeType,file_size:Number(manifest.totalFileSize),sort_order:Number(manifest.sortOrder),is_cover:!!manifest.isCover,
        drive_file_id:manifest.drive_file_id,drive_url:null,delivery:'vercel_proxy',sharing_access:'private',sha256:manifest.sha256,
        created_at:manifest.createdAt,updated_at:new Date().toISOString()};
      record.mediaRecords.push(existing);existingById[id]=existing;
    }
    manifests.push(manifest);
  });
  Object.keys(placements).forEach(function(id){
    var item=existingById[id],placement=placements[id];if(!item)return;
    item.purpose=placement.purpose;item.context_id=placement.contextId;item.sort_order=placement.sortOrder;item.is_cover=placement.isCover;
  });
  return manifests;
}

function mediaWorkMarkAttached_(manifests,workId,revision) {
  (manifests||[]).forEach(function(manifest){
    var current=mediaWorkReadJson_(mediaWorkManifestKey_(manifest.mediaId));
    if(!current||current.workId!==workId||current.drive_file_id!==manifest.drive_file_id)return;
    current.state='attached';current.workRevision=revision;current.attachedAt=new Date().toISOString();
    mediaWorkStoreJson_(mediaWorkManifestKey_(current.mediaId),current);
  });
}

function mediaWorkRepairCommitted_(record,workId,ownerUserId) {
  (record&&record.mediaRecords||[]).forEach(function(item){
    if(item.delivery!=='vercel_proxy')return;
    var manifest=mediaWorkReadJson_(mediaWorkManifestKey_(item.id));
    if(manifest&&manifest.ownerUserId===ownerUserId&&manifest.workId===workId&&manifest.drive_file_id===item.drive_file_id&&manifest.state==='finalized'){
      manifest.state='attached';manifest.workRevision=record.revision;manifest.attachedAt=new Date().toISOString();mediaWorkStoreJson_(mediaWorkManifestKey_(item.id),manifest);
    }
  });
}
var CXL_WRITE_FIELDS_=['authorName','authorAvatar','title','icon','category','shortDescription','contentTypeLabels','contentTypes','presentationMetadata','publicCollaboration','collaborationAssetId','contentBlocks','content','uiCodeSnippet','previewImage','previewImages','folderId','isPublic','visibility','status','tags','linkedAssetIds','deletedAt','likesCount','forkCount','forkedFromId','forkedFromAuthor','versions','media','collaboration'];

function findSheetRowsByCellValue_(sheet,column,value) {
  if(!column||sheet.getLastRow()<2)return [];
  var matches=sheet.getRange(2,column,sheet.getLastRow()-1,1).createTextFinder(String(value)).matchEntireCell(true).matchCase(true).useRegularExpression(false).findAll()||[];
  return matches.map(function(cell){return cell.getRow();}).sort(function(a,b){return a-b;});
}

function contiguousRowGroups_(rows) {
  var groups=[];(rows||[]).slice().sort(function(a,b){return a-b;}).forEach(function(row){var last=groups[groups.length-1];if(last&&row===last.start+last.count)last.count++;else groups.push({start:row,count:1});});return groups;
}

function rowByColumnValue_(sheet,columnName,value) {
  if(sheet.getLastRow()<2)return null;
  var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String),column=headers.indexOf(columnName)+1;
  if(!column)return null;
  var matches=findSheetRowsByCellValue_(sheet,column,value);
  if(matches.length>1)apiFail_('INDEX_ROW_AMBIGUOUS','Index contains duplicate '+columnName+' rows');
  if(!matches.length)return null;
  var rowNumber=matches[0],values=sheet.getRange(rowNumber,1,1,headers.length).getValues()[0],result={_sheetRow:rowNumber};
  headers.forEach(function(header,index){result[header]=values[index];});return result;
}

function rowAtSheetNumber_(sheet,rowNumber) {
  if(!Number.isInteger(Number(rowNumber))||Number(rowNumber)<2||Number(rowNumber)>sheet.getLastRow())return null;
  var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String),values=sheet.getRange(Number(rowNumber),1,1,headers.length).getValues()[0],result={_sheetRow:Number(rowNumber)};
  headers.forEach(function(header,index){result[header]=values[index];});return result;
}

function rowByCreateRequestId_(sheet,requestId) { return rowByColumnValue_(sheet,'create_request_id',requestId); }

function rowById_(sheet,id) { return rowByColumnValue_(sheet,'id',id); }

function sanitizeCxlAsset_(asset) {
  var clone=JSON.parse(JSON.stringify(asset));delete clone.userId;delete clone.revision;delete clone.authorEmail;delete clone.email;delete clone.collaboration;
  if(clone.publicCollaboration)(clone.publicCollaboration.participants||[]).forEach(function(p){delete p.contact;delete p.email;});
  return clone;
}

function saveCxlWorkApi_(operation,payload,options,ownerUserId) {
  var totalStarted=Date.now(),phaseStarted=totalStarted;
  if(!ownerUserId)apiFail_('OWNER_REQUIRED','Authenticated Owner is required');
  if(!options||!/^([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.test(String(options.requestId||'')))apiFail_('INVALID_REQUEST_ID','A stable requestId is required');
  var mediaIds=options.mediaIds===undefined?[]:options.mediaIds;
  if(!Array.isArray(mediaIds)||mediaIds.length>20||mediaIds.some(function(id,index){return !mediaPocUuid_(id)||mediaIds.indexOf(id)!==index;}))apiFail_('INVALID_MEDIA_UPLOAD_REQUEST','Work media attachment list is invalid');
  var requestId=String(options.requestId).toLowerCase(),assetInput=operation==='create'?payload:payload&&payload.updates,id=operation==='create'?'asset_'+requestId.replace(/-/g,'' ):String(payload&&payload.id||'');
  validateCxlWritePayload_(assetInput,operation);
  var fingerprint=writeFingerprint_(operation,operation==='create'?assetInput:{id:id,updates:assetInput,expectedRevision:options.expectedRevision});
  ownerTimingPhase_('revision_idempotency_validation',Date.now()-phaseStarted);phaseStarted=Date.now();
  var sh=sheet_(config_().privateSheetId),indexed=operation==='create'?rowByCreateRequestId_(sh,requestId):rowById_(sh,id),record=null;
  ownerTimingPhase_('existing_work_index_lookup',Date.now()-phaseStarted);phaseStarted=Date.now();
  if(indexed)record=parse_(indexed.file_id);
  ownerTimingPhase_('canonical_drive_json_read',Date.now()-phaseStarted);phaseStarted=Date.now();
  if(operation==='create'&&record){
    if(record.createRequestId!==requestId||record.lastWriteFingerprint!==fingerprint)apiFail_('IDEMPOTENCY_KEY_REUSED','Create requestId was already used with different Work data');
    mediaWorkRepairCommitted_(record,id,ownerUserId);
    ownerTimingPhase_('revision_idempotency_validation',Date.now()-phaseStarted);phaseStarted=Date.now();finishCxlPublicProjection_(record,ownerUserId);ownerTimingPhase_('public_projection_sync',Date.now()-phaseStarted);
    phaseStarted=Date.now();var idempotentCreateResult=cxlWriteResult_(record);ownerTimingPhase_('response_construction',Date.now()-phaseStarted);return idempotentCreateResult;
  }
  if(operation==='update'&&record&&record.lastWriteRequestId===requestId){
    if(record.lastWriteFingerprint!==fingerprint)apiFail_('IDEMPOTENCY_KEY_REUSED','Update requestId was already used with different Work data');
    mediaWorkRepairCommitted_(record,id,ownerUserId);
    ownerTimingPhase_('revision_idempotency_validation',Date.now()-phaseStarted);phaseStarted=Date.now();finishCxlPublicProjection_(record,ownerUserId);ownerTimingPhase_('public_projection_sync',Date.now()-phaseStarted);
    phaseStarted=Date.now();var idempotentUpdateResult=cxlWriteResult_(record);ownerTimingPhase_('response_construction',Date.now()-phaseStarted);return idempotentUpdateResult;
  }
  ownerTimingPhase_('revision_idempotency_validation',Date.now()-phaseStarted);phaseStarted=Date.now();
  var now=new Date().toISOString(),asset;
  if(operation==='create'){
    var requestRow=rowById_(sh,id);if(requestRow)apiFail_('IDEMPOTENCY_KEY_REUSED','Create requestId conflicts with an existing Work');
    asset=JSON.parse(JSON.stringify(assetInput));asset.id=id;asset.userId=ownerUserId;asset.authorName=asset.authorName||'Creator';asset.createdAt=now;asset.updatedAt=now;
    asset.visibility=asset.visibility||(asset.isPublic===false?'private':'public');asset.isPublic=asset.visibility==='public';asset.status=asset.status||'finished';asset.deletedAt=null;
    asset.likesCount=0;asset.forkCount=0;asset.forkedFromId=null;asset.forkedFromAuthor=null;asset.linkedAssetIds=[];asset.versions=[{version:1,updatedAt:now,title:asset.title,summary:'สร้างผลงานเริ่มต้น'}];asset.media=[];
    rejectUnsupportedWorkMedia_(asset,null,mediaIds);
  } else {
    if(!record)apiFail_('WORK_NOT_FOUND','Work was not found for this Owner');
    var revisionStarted=Date.now();
    if(!Number.isInteger(Number(options.expectedRevision))||Number(options.expectedRevision)<1)apiFail_('REVISION_REQUIRED','Expected revision is required for update');
    if(Number(options.expectedRevision)!==Number(record.revision))apiFail_('REVISION_CONFLICT','Work revision is stale; reload before saving');
    ownerTimingPhase_('revision_idempotency_validation',Date.now()-revisionStarted);
    var existingAsset=cxlAssetFromRecord_(record);if(String(existingAsset.userId||'')!==String(ownerUserId)&&String(record.row.user_id||'')!==String(ownerUserId))apiFail_('WORK_NOT_OWNED','Work is not owned by this authenticated Owner');
    asset=Object.assign({},existingAsset,assetInput);asset.id=id;asset.userId=ownerUserId;asset.createdAt=existingAsset.createdAt;asset.updatedAt=now;
    asset.visibility=assetInput.visibility|| (assetInput.isPublic===undefined?existingAsset.visibility:(assetInput.isPublic?'public':'private'));asset.isPublic=asset.visibility==='public';
    asset.media=existingAsset.media||[];
    var changed=assetInput.title!==undefined||assetInput.content!==undefined||assetInput.uiCodeSnippet!==undefined;
    asset.versions=changed?(existingAsset.versions||[]).concat([{version:(existingAsset.versions||[]).at(-1)?.version+1||1,updatedAt:now,title:asset.title,summary:'บันทึกการแก้ไขเนื้อหา'}]):existingAsset.versions||[];
    rejectUnsupportedWorkMedia_(asset,existingAsset,mediaIds);
  }
  ownerTimingPhase_('write_payload_prepare',Date.now()-phaseStarted);phaseStarted=Date.now();
  validateOwnerFolder_(asset.folderId,ownerUserId);
  var request={operation:operation,requestId:requestId,fingerprint:fingerprint,revision:operation==='update'?Number(options.expectedRevision):0,createRequestId:operation==='create'?requestId:'',mediaIds:mediaIds};
  ownerTimingPhase_('write_payload_prepare',Date.now()-phaseStarted);phaseStarted=Date.now();
  var validationAndPreloadMs=Date.now()-phaseStarted;phaseStarted=Date.now();var saved=saveOwnerWork_(cxlRowInput_(asset,ownerUserId,request),{deferPublicSync:true,idempotent:true,privateSheet:sh,preloadedIndexRow:operation==='update'?indexed:null,preloadedRecord:operation==='update'?record:null});
  var saveMs=Date.now()-phaseStarted;record=saved.record;if(!record)apiFail_('OWNER_WRITE_STATE_INVALID','Saved Work response is unavailable');
  phaseStarted=Date.now();finishCxlPublicProjection_(record,ownerUserId);var publicSyncMs=Date.now()-phaseStarted;
  ownerTimingPhase_('public_projection_sync',publicSyncMs);
  phaseStarted=Date.now();var response=cxlWriteResult_(record);ownerTimingPhase_('response_construction',Date.now()-phaseStarted);
  ownerTimingLog_('works.'+operation,{validationAndPreloadMs:validationAndPreloadMs,saveMs:saveMs,publicSyncMs:publicSyncMs,totalMs:Date.now()-totalStarted});
  return response;
}

function saveOwnerWork_(input,options) {
  options=options||{};var totalStarted=Date.now(),phaseStarted;
  var lock=LockService.getScriptLock(); lock.waitLock(30000);
  ownerTimingPhase_('script_lock_wait',Date.now()-totalStarted);
  try {
    var lockWaitMs=Date.now()-totalStarted,setupStarted=Date.now(),c=config_(),sh=options.privateSheet||sheet_(c.privateSheetId),preloaded=options.preloadedIndexRow||null;
    var existing=input.id&&preloaded?rowAtSheetNumber_(sh,preloaded._sheetRow):null,record;
    if(input.id&&(!existing||String(existing.id)!==String(input.id)))existing=rowById_(sh,input.id);
    ownerTimingPhase_('existing_work_index_lookup',Date.now()-setupStarted);phaseStarted=Date.now();
    if(preloaded&&!existing)apiFail_('REVISION_CONFLICT','Work was removed before save; reload before saving');
    if(existing){
      var preloadedMatches=preloaded&&options.preloadedRecord&&String(existing.id)===String(preloaded.id)&&Number(existing.revision)===Number(preloaded.revision)&&String(existing.file_id||'')===String(preloaded.file_id||'');
      if(preloadedMatches)record=options.preloadedRecord;
      else {record=parse_(existing.file_id);ownerTimingPhase_('canonical_drive_json_read',Date.now()-phaseStarted);phaseStarted=Date.now();}
      var canonicalOwner=String(record.row&&record.row.user_id||record.cxlAsset&&record.cxlAsset.userId||'');
      if(canonicalOwner!==String(input.ownerUserId||''))apiFail_('WORK_NOT_OWNED','Work is not owned by this authenticated Owner');
      if(String(record.row.id)!==String(input.id)||Number(record.revision)!==Number(existing.revision))apiFail_('REVISION_CONFLICT','Work revision changed before save; reload before saving');
      if(preloaded&&!preloadedMatches){
        if(record.lastWriteRequestId===input.writeRequestId){
          if(record.lastWriteFingerprint!==input.writeFingerprint)apiFail_('IDEMPOTENCY_KEY_REUSED','Update requestId was already used with different Work data');
          return {id:record.row.id,revision:record.revision,updatedAt:record.row.updated_at,record:record};
        }
        apiFail_('REVISION_CONFLICT','Work revision changed before save; reload before saving');
      }
      if(Number(input.revision)!==Number(existing.revision))apiFail_('REVISION_CONFLICT','Work revision is stale; reload before saving');
      ownerTimingPhase_('locked_revision_read',Date.now()-phaseStarted);phaseStarted=Date.now();
    }
    else {var id=input.id||('asset_'+Date.now()+'_'+Utilities.getUuid().slice(0,6));record={schemaVersion:1,sourceSha256:null,revision:0,row:{id:id,user_id:input.ownerUserId||'google-temporary-owner',created_at:new Date().toISOString(),versions:[]},collaborationDraft:null,collaborationDraftMeta:null,mediaRecords:[]};}
    record.mediaRecords=record.mediaRecords||[];
    var attachedWorkMedia=mediaWorkAttach_(record,input.cxlAsset||{},input.mediaIds||[],input.id,input.ownerUserId);
    var wasPublic=!!existing&&isPublic_(record.row),loadAndValidateStarted=setupStarted,r=record.row, fields=['title','author_name','author_avatar','icon','category','content_type_labels','content_types','presentation_metadata','public_collaboration','content','ui_code_snippet','short_description','status','visibility','folder_id','tags','content_blocks','preview_image','preview_images','collaboration_asset_id','deleted_at'];
    fields.forEach(function(k){if(Object.prototype.hasOwnProperty.call(input,k))r[k]=input[k];});
    if(!String(r.title||'').trim())fail_('ต้องระบุชื่อผลงาน');
    if(['character','lore','ui_code','prompts','collab','app_data'].indexOf(r.category)<0)fail_('หมวดหมู่ไม่ถูกต้อง');
    if(['idea','draft','in_progress','finished','archived'].indexOf(r.status)<0)fail_('สถานะไม่ถูกต้อง');
    if(['public','private'].indexOf(r.visibility)<0)fail_('การมองเห็นไม่ถูกต้อง');
    if(r.category==='collab')r.collaboration_asset_id=null;
    if(r.collaboration_asset_id){var linked=rowById_(sh,r.collaboration_asset_id);if(!linked||linked.category!=='collab'||linked.id===r.id)fail_('คอลแลปที่เชื่อมไม่ถูกต้อง');}
    if(Object.prototype.hasOwnProperty.call(input,'mediaUpdates'))(input.mediaUpdates||[]).forEach(function(update){var m=(record.mediaRecords||[]).filter(function(x){return x.id===update.id;})[0];if(!m)fail_('ไม่พบภาพสำหรับจัดหมวด');if(['gallery','icon','collab','collab_reference','unassigned'].indexOf(update.purpose)<0)fail_('ประเภทภาพไม่ถูกต้อง');m.purpose=update.purpose;m.context_id=update.context_id||null;if(Object.prototype.hasOwnProperty.call(update,'sort_order'))m.sort_order=Number(update.sort_order)||0;m.is_cover=!!update.is_cover;});
    r.is_public=r.visibility==='public';r.updated_at=new Date().toISOString();
    if(Object.prototype.hasOwnProperty.call(input,'collaborationDraft'))record.collaborationDraft=input.collaborationDraft;
    if(Object.prototype.hasOwnProperty.call(input,'cxlAsset'))record.cxlAsset=input.cxlAsset;
    if(input.createRequestId)record.createRequestId=input.createRequestId;
    if(input.writeRequestId){record.lastWriteRequestId=input.writeRequestId;record.lastWriteOperation=input.writeOperation||'';record.lastWriteFingerprint=input.writeFingerprint||'';}
    if(r.visibility==='public'&&(record.mediaRecords||[]).some(function(m){if(!m.drive_file_id)return false;if(m.purpose==='unassigned')return true;if(m.purpose!=='collab'&&m.purpose!=='collab_reference')return false;return !(record.collaborationDraft?.participants||[]).some(function(p){return (p.referenceImages||[]).some(function(x){return (typeof x==='string'?x:(x.src||x.storageKey||''))==='media:'+m.id;});});}))fail_('ยังมีรูปที่ไม่ได้ระบุว่าเป็นภาพรวมงานหรือของผู้เข้าร่วม');
    shareRecordMedia_(record,isPublic_(r));
    record.revision=(record.revision||0)+1;
    var publicAction=publicProjectionAction_(wasPublic,isPublic_(r));
    phaseStarted=Date.now();if(publicAction==='deactivate'){var publicSheet=sheet_(c.publicSheetId),pub=rowById_(publicSheet,r.id);if(pub){pub.active='false';setRow_(publicSheet,PUBLIC_HEADERS,pub,pub);}}
    ownerTimingPhase_('private_public_transition',Date.now()-phaseStarted);
    ensurePrivateHeaders_(sh);
    var loadAndValidateMs=Date.now()-loadAndValidateStarted;phaseStarted=Date.now();var artifacts=ownerSearchArtifacts_(cxlAssetFromRecord_(record));ownerTimingPhase_('search_artifact_generation',Date.now()-phaseStarted);phaseStarted=Date.now();
    var metadata=privateMeta_(record,'',artifacts),searchSh=ownerSearchSheet_(true);
    var searchPrepareMs=Date.now()-phaseStarted;phaseStarted=Date.now();
    appendOwnerSearchChunks_(searchSh,r.id,artifacts);
    ownerTimingPhase_('search_chunk_write',Date.now()-phaseStarted);
    var searchChunkAppendMs=Date.now()-phaseStarted;phaseStarted=Date.now();
    var fileId=options.idempotent?putJsonRevision_(c.privateId,r.id+'__r'+record.revision+'.json',record):putJson_(c.privateId,r.id+'__r'+record.revision+'.json',record);
    var driveRevisionWriteMs=Date.now()-phaseStarted;phaseStarted=Date.now();metadata.file_id=fileId;setPrivateIndexRow_(sh,metadata,existing&&existing._sheetRow,existing);
    mediaWorkMarkAttached_(attachedWorkMedia,r.id,record.revision);
    ownerTimingPhase_('drive_revision_write',driveRevisionWriteMs);
    ownerTimingPhase_('private_index_update',Date.now()-phaseStarted);
    var privateIndexWriteMs=Date.now()-phaseStarted,staleChunkCleanupMs=0;
    ownerTimingPhase_('stale_search_cleanup',staleChunkCleanupMs);
    if(!options.deferPublicSync&&publicAction==='upsert')syncPublic_(record);
    ownerTimingLog_('works.write.persistence',{lockWaitMs:lockWaitMs,loadAndValidateMs:loadAndValidateMs,searchPrepareMs:searchPrepareMs,searchChunkAppendMs:searchChunkAppendMs,driveRevisionWriteMs:driveRevisionWriteMs,privateIndexWriteMs:privateIndexWriteMs,staleChunkCleanupMs:staleChunkCleanupMs,totalMs:Date.now()-totalStarted});
    return {id:r.id,revision:record.revision,updatedAt:r.updated_at,record:record};
  } finally {lock.releaseLock();}
}

function setRow_(sheet,headers,row,knownRow) { ensureHeaders_(sheet,headers);var found=arguments.length>=4?knownRow:rowById_(sheet,row.id); var arr=headers.map(function(k){return row[k]===undefined||row[k]===null?'':row[k];}); if(found) sheet.getRange(found._sheetRow,1,1,headers.length).setValues([arr]); else sheet.appendRow(arr); }

function shareRecordMedia_(record,publicAccess) {
  var refs=[record.row.preview_image].concat(record.row.preview_images||[]);
  (record.collaborationDraft?.participants||[]).forEach(function(p){(p.referenceImages||[]).forEach(function(x){refs.push(typeof x==='string'?x:(x.src||x.storageKey||''));});});
  (record.mediaRecords||[]).forEach(function(m){if(!m.drive_file_id)return;if(m.delivery==='vercel_proxy'){try{var privateFile=DriveApp.getFileById(m.drive_file_id);privateFile.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);if(privateFile.getSharingAccess()!==DriveApp.Access.PRIVATE)apiFail_('MEDIA_UPLOAD_MEDIA_INVALID','Google Work media must remain private.');m.sharing_access='private';}catch(_error){if(_error&&_error.apiCode==='MEDIA_UPLOAD_MEDIA_INVALID')throw _error;apiFail_('MEDIA_UPLOAD_MEDIA_INVALID','Google Work media must remain private.');}return;}var visible=publicAccess&&(refs.indexOf('media:'+m.id)>=0||refs.indexOf(m.storage_path)>=0),access=visible?'public':'private';if(m.sharing_access===access)return;DriveApp.getFileById(m.drive_file_id).setSharing(visible?DriveApp.Access.ANYONE_WITH_LINK:DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);m.sharing_access=access;});
}

function sheet_(id) { if (!id) fail_('ยังไม่ได้ตั้งค่า Sheets'); return SpreadsheetApp.openById(id).getSheets()[0]; }

function summaryArray_(value) { return Array.isArray(value)?value:[]; }

function summaryStrings_(value) { return summaryArray_(value).filter(function(x){return typeof x==='string';}); }

function syncPublic_(record) {
  var c=config_(), sh=sheet_(c.publicSheetId), old=rowById_(sh,record.row.id), active=isPublic_(record.row);
  if(!active){ if(old){old.active='false';setRow_(sh,PUBLIC_HEADERS,old,old);} return; }
  var pub=projection_(record);
  var fileId=putJson_(c.publicId,record.row.id+'__r'+record.revision+'.json',pub);
  setRow_(sh,PUBLIC_HEADERS,{id:pub.id,title:pub.title,category:pub.category,status:pub.status,updated_at:pub.updated_at,tags:JSON.stringify(pub.tags),short_description:pub.short_description||'',file_id:fileId,active:'true',cover_ref:pub.preview_image||'',summary_json:publicSummaryJson_(pub)},old);
}

function upsertWorkCreatorMap_(workId,publicCreatorId) {
  var book=SpreadsheetApp.openById(config_().publicSheetId),sh=book.getSheetByName('WorkCreatorMap');
  if(!sh)apiFail_('CREATOR_MAPPING_MISSING','Public Work creator map is not configured');
  var lastColumn=sh.getLastColumn(),headers=sh.getRange(1,1,1,lastColumn).getValues()[0].map(String),schemaIndex=headers.indexOf('schemaVersion'),workIndex=headers.indexOf('workId'),creatorIndex=headers.indexOf('publicCreatorId');
  if(schemaIndex<0||workIndex<0||creatorIndex<0)apiFail_('CREATOR_MAPPING_MISSING','Public Work creator map schema is invalid');
  var matches=[];if(sh.getLastRow()>1){sh.getRange(2,1,sh.getLastRow()-1,lastColumn).getValues().forEach(function(row,index){if(String(row[workIndex]||'')===String(workId))matches.push({row:row,number:index+2});});}
  if(matches.length>1)apiFail_('CREATOR_MAPPING_AMBIGUOUS','Work has duplicate public creator mappings');
  if(matches.length){var old=matches[0].row;if(String(old[creatorIndex])!==String(publicCreatorId)&&String(old[creatorIndex]))apiFail_('CREATOR_MAPPING_CONFLICT','Work is mapped to a different public creator');old[schemaIndex]=1;old[creatorIndex]=publicCreatorId;sh.getRange(matches[0].number,1,1,lastColumn).setValues([old]);}
  else {var row=headers.map(function(){return '';});row[schemaIndex]=1;row[workIndex]=workId;row[creatorIndex]=publicCreatorId;sh.appendRow(row);}
}

function validateCxlWritePayload_(asset,operation) {
  if(!asset||typeof asset!=='object'||Array.isArray(asset))apiFail_('INVALID_WORK','Work payload is invalid');
  var allowed=CXL_WRITE_FIELDS_.concat(operation==='create'?['userId']:[]);
  if(Object.keys(asset).some(function(key){return allowed.indexOf(key)<0;}))apiFail_('INVALID_WORK','Work payload contains unsupported fields');
  if(operation==='create'&&!String(asset.title||'').trim())apiFail_('INVALID_WORK','Work title is required');
  if(asset.title!==undefined&&!String(asset.title||'').trim()||asset.category!==undefined&&typeof asset.category!=='string'||asset.tags!==undefined&&!Array.isArray(asset.tags))apiFail_('INVALID_WORK','Work title, category, or tags are invalid');
  if(asset.collaboration)apiFail_('UNSUPPORTED_COLLAB_DRAFT','Private collaboration draft changes are deferred to GO 8.');
}

function validateOwnerFolder_(folderId,ownerUserId) {
  if(!folderId)return;
  if(!cxlOwnerFolders_(ownerUserId).some(function(folder){return folder.id===String(folderId);}))apiFail_('INVALID_FOLDER','Selected folder is unavailable for this Owner');
}

function values_(sheet) { return sheet.getLastRow()<2?[]:sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues(); }

function writeFingerprint_(operation,value) {
  var digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify({operation:operation,value:value}),Utilities.Charset.UTF_8);
  return Utilities.base64Encode(digest);
}
