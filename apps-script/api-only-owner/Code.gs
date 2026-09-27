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
var API_OWNER_ACTIONS_ = ['works.fetch','folders.fetch','works.create','works.update'];
var API_MAX_POST_CHARS_ = 5000000;

function doGet() {
  return apiJson_({ok:false,error:'Method not allowed',code:'METHOD_NOT_ALLOWED',httpStatus:405});
}
function doPost(e) {
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

  try {
    var args=body.args;
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
    return apiJson_({ok:false,error:'Invalid action arguments',code:'INVALID_REQUEST',httpStatus:400});
  } catch(error) {
    return apiJson_({ok:false,error:String(error&&error.message||error),code:error&&error.apiCode||'OWNER_API_ERROR',
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
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function apiFail_(code,message) { var error=new Error(message);error.apiCode=code;throw error; }

function config_() {
  var p = props_();
  return { rootId:p.getProperty('ROOT_ID'), privateId:p.getProperty('PRIVATE_ID'), publicId:p.getProperty('PUBLIC_ID'), incomingId:p.getProperty('INCOMING_ID'), mediaId:p.getProperty('MEDIA_ID'), privateSheetId:p.getProperty('PRIVATE_SHEET_ID'), publicSheetId:p.getProperty('PUBLIC_SHEET_ID') };
}

function cxlAssetFromRecord_(record) {
  if(record.cxlAsset){var saved=JSON.parse(JSON.stringify(record.cxlAsset));saved.revision=Number(record.revision)||1;saved.media=(record.mediaRecords||[]).map(function(m){return {id:m.id,assetId:m.asset_id,storagePath:m.storage_path,
    purpose:m.purpose,contextId:m.context_id||null,mimeType:m.mime_type,fileSize:Number(m.file_size||0),sortOrder:Number(m.sort_order||0),isCover:!!m.is_cover,
    naturalWidth:m.natural_width,naturalHeight:m.natural_height,createdAt:m.created_at,updatedAt:m.updated_at};});return saved;}
  var r=record.row||{};
  return {id:r.id,userId:r.user_id||'google-owner',authorName:r.author_name||'Creator',authorAvatar:r.author_avatar,
    title:r.title||'',icon:r.icon||{type:'emoji',value:'✨'},category:r.category||'character',shortDescription:r.short_description||'',
    contentTypeLabels:r.content_type_labels||[],contentTypes:r.content_types||[],presentationMetadata:r.presentation_metadata,
    publicCollaboration:r.public_collaboration||null,collaborationAssetId:r.collaboration_asset_id&&r.collaboration_asset_id!=='null'?r.collaboration_asset_id:null,collaboration:record.collaborationDraft||null,
    contentBlocks:r.content_blocks||[],content:r.content||'',uiCodeSnippet:r.ui_code_snippet||'',previewImage:r.preview_image||'',
    previewImages:r.preview_images||[],media:(record.mediaRecords||[]).map(function(m){return {id:m.id,assetId:r.id,storagePath:m.storage_path,
      purpose:m.purpose,contextId:m.context_id||null,mimeType:m.mime_type,fileSize:Number(m.file_size||0),sortOrder:Number(m.sort_order||0),
      isCover:!!m.is_cover,naturalWidth:m.natural_width,naturalHeight:m.natural_height,createdAt:m.created_at,updatedAt:m.updated_at};}),
    folderId:r.folder_id&&r.folder_id!=='null'?r.folder_id:null,isPublic:isPublic_(r),visibility:r.visibility||'private',status:r.status||'draft',tags:r.tags||[],
    createdAt:r.created_at,updatedAt:r.updated_at,deletedAt:r.deleted_at||null,likesCount:Number(r.likes_count||0),forkCount:Number(r.fork_count||0),
    forkedFromId:r.forked_from_id&&r.forked_from_id!=='null'?r.forked_from_id:null,forkedFromAuthor:r.forked_from_author&&r.forked_from_author!=='null'?r.forked_from_author:null,linkedAssetIds:r.linked_asset_ids||[],versions:r.versions||[]};
}

function cxlOwnerFolders_(ownerUserId) {
  if(!ownerUserId)apiFail_('OWNER_REQUIRED','Authenticated Owner is required');
  return getFolders_().filter(function(folder){return folder&&String(folder.user_id||'')===String(ownerUserId);}).map(function(folder){
    if(!folder.id||!folder.name||!folder.created_at||!folder.updated_at)apiFail_('FOLDER_SCHEMA_INVALID','Folder source does not match the CXL Folder contract');
    return {id:String(folder.id),userId:String(ownerUserId),name:String(folder.name),icon:folder.icon||'📁',color:folder.color||'purple',createdAt:String(folder.created_at),updatedAt:String(folder.updated_at)};
  });
}

function cxlRowInput_(asset,ownerUserId,request) {
  return {id:asset.id,ownerUserId:ownerUserId,revision:request.revision,title:asset.title,author_name:asset.authorName||'',author_avatar:asset.authorAvatar||'',icon:asset.icon,
    category:asset.category,status:asset.status,visibility:asset.visibility|| (asset.isPublic?'public':'private'),short_description:asset.shortDescription||'',
    content_type_labels:asset.contentTypeLabels||[],content_types:asset.contentTypes||[],presentation_metadata:asset.presentationMetadata||null,
    public_collaboration:asset.publicCollaboration||null,folder_id:asset.folderId||'',tags:asset.tags||[],content:asset.content||'',ui_code_snippet:asset.uiCodeSnippet||'',
    content_blocks:asset.contentBlocks||[],preview_image:asset.previewImage||'',preview_images:asset.previewImages||[],collaboration_asset_id:asset.collaborationAssetId||null,
    deleted_at:asset.deletedAt||null,createRequestId:request.createRequestId||'',writeRequestId:request.requestId,writeOperation:request.operation,writeFingerprint:request.fingerprint,
    cxlAsset:asset,collaborationDraft:null};
}

function cxlWriteResult_(record) { var asset=cxlAssetFromRecord_(record);return {data:asset,error:null}; }

function ensureHeaders_(sheet,headers) { var last=sheet.getLastColumn();if(last<headers.length)sheet.getRange(1,1,1,headers.length).setValues([headers]); }

function fail_(message) { throw new Error(message); }

function fetchCxlWorks_(options) {
  options=options||{};
  if(options.assetId)return {data:[cxlAssetFromRecord_(getOwnerWork_(options.assetId))],error:null};
  if(options.detail==='full')apiFail_('FULL_LIST_NOT_SUPPORTED','Full Work reads require one assetId');
  var index=listOwnerIndex_();
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
    var searchRows=listOwnerSearchIndex_(),matching=ownerSearchMatches_(index,searchRows,q);
    index=index.filter(function(row){return !!matching[row.id];});
  }
  var works=index.map(function(row){return privateSummaryAsset_(row);});
  return {data:works,error:null};
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
  return {processed:updated,driveReads:driveReads,remaining:summaryStats.missing+summaryStats.invalid+searchStats.missingWorks+searchStats.invalidWorks+searchStats.staleExtraChunks,ready:summaryStats.missing+summaryStats.invalid+searchStats.missingWorks+searchStats.invalidWorks+searchStats.staleExtraChunks===0,batchLimit:batch,
    missingSummaries:summaryStats.missing,invalidSummaries:summaryStats.invalid,missingSearchWorks:searchStats.missingWorks,invalidSearchWorks:searchStats.invalidWorks,missingSearchChunks:searchStats.missingChunks,invalidSearchChunks:searchStats.invalidChunks,staleExtraChunks:searchStats.staleExtraChunks};
}

function verifyOwnerSummaryReadiness_() {
  var sh=sheet_(config_().privateSheetId),rows=objectRows_(sh),searchSh=ownerSearchSheet_(false),searchRows=searchSh?objectRows_(searchSh):[],summary=ownerSummaryReadiness_(rows),search=ownerSearchReadiness_(rows,searchRows);
  return {total:rows.length,validSummaries:summary.valid,missingSummaries:summary.missing,invalidSummaries:summary.invalid,
    validSearchWorks:search.validWorks,missingSearchWorks:search.missingWorks,invalidSearchWorks:search.invalidWorks,
    missingSearchChunks:search.missingChunks,invalidSearchChunks:search.invalidChunks,staleExtraChunks:search.staleExtraChunks,
    ready:summary.missing+summary.invalid+search.missingWorks+search.invalidWorks+search.staleExtraChunks===0,summaryVersion:PRIVATE_SUMMARY_VERSION,searchVersion:OWNER_SEARCH_VERSION_};
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
  var rows=objectRows_(sh),numbers=rows.filter(function(row){return String(row.work_id||'')===String(workId)&&String(row.index_token||'')!==String(keepToken);}).map(function(row){return row._sheetRow;}).sort(function(a,b){return b-a;});
  numbers.forEach(function(rowNumber){sh.deleteRow(rowNumber);});
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

function setPrivateIndexRow_(sh,metadata,rowNumber) {
  var last=Math.max(1,sh.getLastColumn()),headers=sh.getRange(1,1,1,last).getValues()[0].map(String),found=rowNumber?{_sheetRow:rowNumber}:rowById_(sh,metadata.id),values=found?sh.getRange(found._sheetRow,1,1,last).getValues()[0]:headers.map(function(){return '';});
  headers.forEach(function(header,index){if(header==='search_text'){values[index]='';return;}if(Object.prototype.hasOwnProperty.call(metadata,header))values[index]=metadata[header]===undefined||metadata[header]===null?'':metadata[header];});
  if(found)sh.getRange(found._sheetRow,1,1,last).setValues([values]);else sh.appendRow(values);
}

function ensurePrivateHeaders_(sh) {
  var last=Math.max(1,sh.getLastColumn()),headers=sh.getRange(1,1,1,last).getValues()[0].map(String),missing=PRIVATE_HEADERS.filter(function(key){return headers.indexOf(key)<0;});
  if(missing.length)sh.getRange(1,last+1,1,missing.length).setValues([missing]);
}

function finishCxlPublicProjection_(record,ownerUserId) {
  try { if(isPublic_(record.row))upsertWorkCreatorMap_(record.row.id,privatePublicCreatorId_(ownerUserId));syncPublic_(record); }
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
  if(collab)(collab.participants||[]).forEach(function(p){(p.referenceImages||[]).forEach(function(x){refs.push(typeof x==='string'?x:(x.src||x.storageKey||''));});});
  return {id:r.id,title:r.title,author_name:r.author_name,author_avatar:r.author_avatar,icon:r.icon,category:r.category,short_description:r.short_description,content_type_labels:r.content_type_labels||[],content_types:r.content_types||[],presentation_metadata:r.presentation_metadata||null,content:r.content||'',ui_code_snippet:r.ui_code_snippet||'',content_blocks:r.content_blocks||[],preview_image:r.preview_image||'',preview_images:r.preview_images||[],tags:r.tags||[],status:r.status,created_at:r.created_at,updated_at:r.updated_at,collaboration_asset_id:r.category==='collab'?null:(r.collaboration_asset_id||null),public_collaboration:collab,mediaRecords:(record.mediaRecords||[]).filter(function(m){return refs.indexOf('media:'+m.id)>=0||refs.indexOf(m.storage_path)>=0;}).map(function(m){return {id:m.id,storage_path:m.storage_path,purpose:m.purpose,mime_type:m.mime_type,sort_order:m.sort_order,is_cover:m.is_cover,drive_file_id:m.drive_file_id||null,drive_url:m.drive_url||null,original_ref:m.original_ref||null};}),cxlAsset:record.cxlAsset?sanitizeCxlAsset_(record.cxlAsset):null};
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

function rejectUnsupportedWorkMedia_(asset,existing) {
  var inline=false,refs=[];
  function walk(value,key) {
    if(typeof value==='string'){
      if(/^\s*(?:data:image\/|blob:)/i.test(value)||key==='localBlobKey'||key==='storageKey')inline=true;
      var match=value.match(/^(media:[A-Za-z0-9_-]+|cxl-media:[a-f0-9]{64})$/i);if(match)refs.push(match[1]);
      return;
    }
    if(Array.isArray(value)){value.forEach(function(item){walk(item,key);});return;}
    if(value&&typeof value==='object')Object.keys(value).forEach(function(child){walk(value[child],child);});
  }
  walk(asset,'');
  if(inline)apiFail_('UNSUPPORTED_MEDIA_MUTATION','New, inline, replace, and delete media operations are deferred to GO 7; save the Work without changing media.');
  if(!existing&&refs.length)apiFail_('UNSUPPORTED_MEDIA_MUTATION','A new Work cannot attach media before GO 7 media support.');
  if(existing){var oldRefs=[];walk(existing,'');if(inline)apiFail_('UNSUPPORTED_MEDIA_MUTATION','Existing media contains an unsupported inline reference.');oldRefs=refs;refs=[];walk(asset,'');
    var oldMedia=JSON.stringify(existing.media||[]),newMedia=Object.prototype.hasOwnProperty.call(asset,'media')?JSON.stringify(asset.media||[]):oldMedia;
    if(oldRefs.sort().join('|')!==refs.sort().join('|')||oldMedia!==newMedia)apiFail_('UNSUPPORTED_MEDIA_MUTATION','Media upload, replace, and delete operations are deferred to GO 7.');
  }
}
var CXL_WRITE_FIELDS_=['authorName','authorAvatar','title','icon','category','shortDescription','contentTypeLabels','contentTypes','presentationMetadata','publicCollaboration','collaborationAssetId','contentBlocks','content','uiCodeSnippet','previewImage','previewImages','folderId','isPublic','visibility','status','tags','linkedAssetIds','deletedAt','likesCount','forkCount','forkedFromId','forkedFromAuthor','versions','media','collaboration'];

function rowByCreateRequestId_(sheet,requestId) { return objectRows_(sheet).filter(function(row){return String(row.create_request_id||'')===String(requestId);})[0]||null; }

function rowById_(sheet,id) { return objectRows_(sheet).filter(function(x){return x.id===id;})[0]||null; }

function sanitizeCxlAsset_(asset) {
  var clone=JSON.parse(JSON.stringify(asset));delete clone.userId;delete clone.revision;delete clone.authorEmail;delete clone.email;delete clone.collaboration;
  if(clone.publicCollaboration)(clone.publicCollaboration.participants||[]).forEach(function(p){delete p.contact;delete p.email;});
  return clone;
}

function saveCxlWorkApi_(operation,payload,options,ownerUserId) {
  if(!ownerUserId)apiFail_('OWNER_REQUIRED','Authenticated Owner is required');
  if(!options||!/^([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.test(String(options.requestId||'')))apiFail_('INVALID_REQUEST_ID','A stable requestId is required');
  var requestId=String(options.requestId).toLowerCase(),assetInput=operation==='create'?payload:payload&&payload.updates,id=operation==='create'?'asset_'+requestId.replace(/-/g,'' ):String(payload&&payload.id||'');
  validateCxlWritePayload_(assetInput,operation);
  var fingerprint=writeFingerprint_(operation,operation==='create'?assetInput:{id:id,updates:assetInput,expectedRevision:options.expectedRevision}),sh=sheet_(config_().privateSheetId),indexed=operation==='create'?rowByCreateRequestId_(sh,requestId):rowById_(sh,id),record=null;
  if(indexed)record=parse_(indexed.file_id);
  if(operation==='create'&&record){
    if(record.createRequestId!==requestId||record.lastWriteFingerprint!==fingerprint)apiFail_('IDEMPOTENCY_KEY_REUSED','Create requestId was already used with different Work data');
    finishCxlPublicProjection_(record,ownerUserId);return cxlWriteResult_(record);
  }
  if(operation==='update'&&record&&record.lastWriteRequestId===requestId){
    if(record.lastWriteFingerprint!==fingerprint)apiFail_('IDEMPOTENCY_KEY_REUSED','Update requestId was already used with different Work data');
    finishCxlPublicProjection_(record,ownerUserId);return cxlWriteResult_(record);
  }
  var now=new Date().toISOString(),asset;
  if(operation==='create'){
    var requestRow=rowById_(sh,id);if(requestRow)apiFail_('IDEMPOTENCY_KEY_REUSED','Create requestId conflicts with an existing Work');
    asset=JSON.parse(JSON.stringify(assetInput));asset.id=id;asset.userId=ownerUserId;asset.authorName=asset.authorName||'Creator';asset.createdAt=now;asset.updatedAt=now;
    asset.visibility=asset.visibility||(asset.isPublic===false?'private':'public');asset.isPublic=asset.visibility==='public';asset.status=asset.status||'finished';asset.deletedAt=null;
    asset.likesCount=0;asset.forkCount=0;asset.forkedFromId=null;asset.forkedFromAuthor=null;asset.linkedAssetIds=[];asset.versions=[{version:1,updatedAt:now,title:asset.title,summary:'สร้างผลงานเริ่มต้น'}];asset.media=[];
    rejectUnsupportedWorkMedia_(asset,null);
  } else {
    if(!record)apiFail_('WORK_NOT_FOUND','Work was not found for this Owner');
    if(!Number.isInteger(Number(options.expectedRevision))||Number(options.expectedRevision)<1)apiFail_('REVISION_REQUIRED','Expected revision is required for update');
    if(Number(options.expectedRevision)!==Number(record.revision))apiFail_('REVISION_CONFLICT','Work revision is stale; reload before saving');
    var existingAsset=cxlAssetFromRecord_(record);if(String(existingAsset.userId||'')!==String(ownerUserId)&&String(record.row.user_id||'')!==String(ownerUserId))apiFail_('WORK_NOT_OWNED','Work is not owned by this authenticated Owner');
    asset=Object.assign({},existingAsset,assetInput);asset.id=id;asset.userId=ownerUserId;asset.createdAt=existingAsset.createdAt;asset.updatedAt=now;
    asset.visibility=assetInput.visibility|| (assetInput.isPublic===undefined?existingAsset.visibility:(assetInput.isPublic?'public':'private'));asset.isPublic=asset.visibility==='public';
    asset.media=existingAsset.media||[];
    var changed=assetInput.title!==undefined||assetInput.content!==undefined||assetInput.uiCodeSnippet!==undefined;
    asset.versions=changed?(existingAsset.versions||[]).concat([{version:(existingAsset.versions||[]).at(-1)?.version+1||1,updatedAt:now,title:asset.title,summary:'บันทึกการแก้ไขเนื้อหา'}]):existingAsset.versions||[];
    rejectUnsupportedWorkMedia_(asset,existingAsset);
  }
  validateOwnerFolder_(asset.folderId,ownerUserId);
  var request={operation:operation,requestId:requestId,fingerprint:fingerprint,revision:operation==='update'?Number(options.expectedRevision):0,createRequestId:operation==='create'?requestId:''};
  var saved=saveOwnerWork_(cxlRowInput_(asset,ownerUserId,request),{deferPublicSync:true,idempotent:true});
  record=getOwnerWork_(saved.id);finishCxlPublicProjection_(record,ownerUserId);return cxlWriteResult_(record);
}

function saveOwnerWork_(input,options) {
  options=options||{};
  var lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var c=config_(), sh=sheet_(c.privateSheetId), existing=input.id?rowById_(sh,input.id):null, record;
    if(existing){if(Number(input.revision)!==Number(existing.revision))fail_('งานถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดใหม่ก่อนบันทึก');record=parse_(existing.file_id);}
    else {var id=input.id||('asset_'+Date.now()+'_'+Utilities.getUuid().slice(0,6));record={schemaVersion:1,sourceSha256:null,revision:0,row:{id:id,user_id:input.ownerUserId||'google-temporary-owner',created_at:new Date().toISOString(),versions:[]},collaborationDraft:null,collaborationDraftMeta:null,mediaRecords:[]};}
    var r=record.row, fields=['title','author_name','author_avatar','icon','category','content_type_labels','content_types','presentation_metadata','public_collaboration','content','ui_code_snippet','short_description','status','visibility','folder_id','tags','content_blocks','preview_image','preview_images','collaboration_asset_id','deleted_at'];
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
    if(existing&&isPublic_(parse_(existing.file_id).row)&&!isPublic_(r)){var pub=rowById_(sheet_(c.publicSheetId),r.id);if(pub){pub.active='false';setRow_(sheet_(c.publicSheetId),PUBLIC_HEADERS,pub);}}
    ensurePrivateHeaders_(sh);
    var artifacts=ownerSearchArtifacts_(cxlAssetFromRecord_(record)),metadata=privateMeta_(record,'',artifacts),searchSh=ownerSearchSheet_(true);
    appendOwnerSearchChunks_(searchSh,r.id,artifacts);
    var fileId=options.idempotent?putJsonRevision_(c.privateId,r.id+'__r'+record.revision+'.json',record):putJson_(c.privateId,r.id+'__r'+record.revision+'.json',record);
    metadata.file_id=fileId;setPrivateIndexRow_(sh,metadata);
    removeStaleOwnerSearchChunks_(searchSh,r.id,artifacts.token);
    if(!options.deferPublicSync)syncPublic_(record);
    return {id:r.id,revision:record.revision,updatedAt:r.updated_at};
  } finally {lock.releaseLock();}
}

function setRow_(sheet,headers,row) { ensureHeaders_(sheet,headers);var found=rowById_(sheet,row.id); var arr=headers.map(function(k){return row[k]===undefined||row[k]===null?'':row[k];}); if(found) sheet.getRange(found._sheetRow,1,1,headers.length).setValues([arr]); else sheet.appendRow(arr); }

function shareRecordMedia_(record,publicAccess) {
  var refs=[record.row.preview_image].concat(record.row.preview_images||[]);
  (record.collaborationDraft?.participants||[]).forEach(function(p){(p.referenceImages||[]).forEach(function(x){refs.push(typeof x==='string'?x:(x.src||x.storageKey||''));});});
  (record.mediaRecords||[]).forEach(function(m){if(!m.drive_file_id)return;var visible=publicAccess&&(refs.indexOf('media:'+m.id)>=0||refs.indexOf(m.storage_path)>=0),access=visible?'public':'private';if(m.sharing_access===access)return;DriveApp.getFileById(m.drive_file_id).setSharing(visible?DriveApp.Access.ANYONE_WITH_LINK:DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);m.sharing_access=access;});
}

function sheet_(id) { if (!id) fail_('ยังไม่ได้ตั้งค่า Sheets'); return SpreadsheetApp.openById(id).getSheets()[0]; }

function summaryArray_(value) { return Array.isArray(value)?value:[]; }

function summaryStrings_(value) { return summaryArray_(value).filter(function(x){return typeof x==='string';}); }

function syncPublic_(record) {
  var c=config_(), sh=sheet_(c.publicSheetId), old=rowById_(sh,record.row.id), active=isPublic_(record.row);
  if(!active){ if(old){old.active='false';setRow_(sh,PUBLIC_HEADERS,old);} return; }
  var pub=projection_(record);
  var fileId=putJson_(c.publicId,record.row.id+'__r'+record.revision+'.json',pub);
  setRow_(sh,PUBLIC_HEADERS,{id:pub.id,title:pub.title,category:pub.category,status:pub.status,updated_at:pub.updated_at,tags:JSON.stringify(pub.tags),short_description:pub.short_description||'',file_id:fileId,active:'true',cover_ref:pub.preview_image||'',summary_json:publicSummaryJson_(pub)});
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
