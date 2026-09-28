/* CXL public reader. This project contains no mutation functions. */
var PUBLIC_SUMMARY_MAX_CHARS=45000;
var PUBLIC_SUMMARY_VERSIONS_=[1,2];
var PUBLIC_TIMING_ACTION_='works.list';
var PUBLIC_TIMING_PHASES_=['public_sheet_open','public_index_read','public_creator_map_read','public_summary_parse','public_projection','response_construction'];
var PUBLIC_SUMMARY_ASSET_FIELDS=['id','title','authorName','category','shortDescription','contentTypeLabels','contentTypes','presentationMetadata','publicCollaboration','collaborationAssetId','icon','content','contentBlocks','uiCodeSnippet','previewImage','previewImages','media','folderId','isPublic','visibility','status','tags','createdAt','updatedAt','deletedAt','likesCount','forkCount','forkedFromId','forkedFromAuthor','versions'];
var PUBLIC_CREATOR_ID_RE_=/^cxlc_[a-f0-9]{32}$/i;
var PUBLIC_CREATOR_FIELDS_=['publicCreatorId','slug','displayName','bio','avatarRef','coverRef','active','updatedAt','schemaVersion'];
var CREATOR_SETTINGS_FIELDS_=['layout','lockedPreset','portfolioDisplayLimit','widgets','freePlacements','widgetRail','spans','widgetTitles','freeOrder','widgetConfigs','widgetInstances'];
var PUBLIC_WIDGET_TYPES_=['folder','playlist','todo','status','note','links','goal','gallery','clock','weather','calendar','single_image','decoration'];
var PUBLIC_WIDGET_CONFIG_FIELDS_={
  status:['status','description'],note:['title','text','icon','noteKicker','noteBadge','noteFooterLeft','noteFooterRight'],
  links:['description','links'],goal:['goal','goalType','goalStyle','goalTitle','goalDescription','goalIcon','goalCurrent','goalTarget','goalUnit','goalItems','goalStartDate','goalDeadline','showPercent','showFraction','showRemaining'],
  todo:['todoListTitle','todoTasks','todoCategories','todoListStyle','todoCheckboxStyle','todoCompletedBehavior','todoProgressMode','todoShowPriority','todoResetSchedule','todoLastResetAt','todoTransparentBackground'],
  playlist:['musicType','musicSource','musicUrl','musicCoverUrl','musicTitle','musicArtist','musicCaption','playlistName','playlistTracks','activeTrackIndex','musicStyle','showCover','showTitle','showArtist','showProgress','showControls','showDuration','showTrackList','showTrackNumbers','showTrackDuration','autoplay','loop','startMuted'],
  gallery:['galleryType','galleryTitle','galleryCaption','galleryTemplate','galleryCollageLayout','galleryGap','galleryImageFit','galleryOuterRadius','galleryInnerRadius','galleryFocusPoint','galleryAutoplay','galleryLoop','galleryPauseOnHover','galleryShowCaption','galleryShowCounter','galleryShowSourceLabel'],
  decoration:['decorationType','decorationStickerIcon','decorationSize','decorationRotation','decorationAlign','decorationOpacity','decorationText','decorationTextStyle','decorationTextSize','decorationPattern','decorationDensity','decorationScale','decorationDividerStyle','decorationDividerText','decorationDividerWidth','decorationDividerThickness','decorationAnimation','decorationAnimationSpeed','decorationLoop','decorationPauseOnHover'],
  clock:['clockMode','clockStyle','clockTimeZoneMode','clockTimeZone','clockCities','clockTimeFormat','clockDateFormat','clockShowTime','clockShowSeconds','clockShowDate','clockShowCity','clockShowTimeZone','clockShowGreeting','clockGreetings','clockTextAlign','clockTimeSize','clockDialMarker','clockHandStyle','clockFlipAnimation','clockFlipSound'],
  weather:['weatherLocation','weatherTimeZone','weatherUnit','weatherCondition','weatherDayNightMode','weatherCurrentCelsius','weatherFeelsLikeCelsius','weatherHighCelsius','weatherLowCelsius','weatherHumidity','weatherWindKph','weatherPrecipitation','weatherMessage','weatherMessageMode','weatherShowCondition','weatherShowFeelsLike','weatherShowHumidity','weatherShowWind','weatherShowPrecipitation','weatherShowMessage','weatherShowForecast','weatherForecast'],
  calendar:['calendarView','calendarStartWeek','calendarTodayStyle','calendarCaption','calendarEvents','calendarEventMode','calendarMaxEventsPerDay','calendarShowMonthYear','calendarShowToday','calendarShowWeekends','calendarShowWeekNumbers','calendarShowEvents','calendarShowUpcoming','calendarShowCaption','calendarSource'],
  folder:['folderTitle','folderSubtitle','folderIcon','folderStyle','folderShowItemCount','folderShowPreviewItems','folderShowDescription','folderShowItemIcons']
};
function doGet(e) {
  if(e&&e.parameter&&e.parameter.cxlApi) return publicApi_(e.parameter);
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('CXL Studio · คลังผลงาน');
}
function publicApi_(p) {
  var action=String(p.cxlApi||''),timing=action===PUBLIC_TIMING_ACTION_&&p.includeTiming==='1'?{action:action,startedAt:Date.now(),phases:{}}:null;
  try {
    var data;
    if(action==='works.list'){
      var book=publicTimed_(timing,'public_sheet_open',function(){return publicBook_();});
      var indexRows=publicTimed_(timing,'public_index_read',function(){return rows_(book);}),publicIds={};
      var summaries=publicTimed_(timing,'public_summary_parse',function(){return indexRows.map(function(row){return parsePublicSummary_(row.summaryJson);});});
      if(summaries.some(function(asset){return !asset;}))throw new Error('Public summary index is not ready');
      indexRows.forEach(function(row){publicIds[row.id]=true;});
      var creatorMap=publicTimed_(timing,'public_creator_map_read',function(){return workCreatorMap_(book);});
      data=publicTimed_(timing,'public_projection',function(){return indexRows.map(function(row,index){var asset=summaries[index];
        if(asset.collaborationAssetId&&!publicIds[asset.collaborationAssetId])asset.collaborationAssetId=null;
        if(creatorMap[row.id])asset.publicCreatorId=creatorMap[row.id];
        return sanitizeCxlPublic_(asset);
      });});
    }
    else if(action==='works.search')data=searchPublicContent(p.q||'');
    else if(action==='works.detail'){var detailBook=publicBook_(),detailRows=rows_(detailBook),detailRow=detailRows.filter(function(x){return x.id===p.id;})[0];
      var record=publicRecord_(p.id,detailRow),creatorMap=workCreatorMap_(detailBook);data=record.cxlAsset?sanitizeCxlPublic_(record.cxlAsset):sanitizeCxlPublic_(legacyPublicToCxl_(record));
      if(creatorMap[p.id])data.publicCreatorId=creatorMap[p.id];}
    else if(action==='profiles.getCreator')data=publicCreatorBySlug_(p.slug);
    else if(action==='profiles.getPublic')data=publicCreatorsByIds_(p.ids);
    else if(action==='settings.readCreatorSpace')data=publicCreatorSettings_(p.publicCreatorId);
    else if(action==='works.creator')data=publicWorksByCreatorSlug_(p.slug);
    else if(action==='media.icon')data=publicIconData_(p.id,p.ref);
    else if(action==='media.metadata'){var work=publicRecord_(p.id);var publicWork=work.cxlAsset?sanitizeCxlPublic_(work.cxlAsset):work;data=(publicWork.media||publicWork.mediaRecords||[]).map(function(m){return {id:m.id,assetId:m.assetId||p.id,purpose:m.purpose,mimeType:m.mimeType||m.mime_type,fileSize:m.fileSize||m.file_size,sortOrder:m.sortOrder||m.sort_order,isCover:!!(m.isCover||m.is_cover),visibility:'public'};});}
    else return jsonResponse_({ok:false,error:'Unsupported public API action'});
    return publicApiResponse_({ok:true,data:data},timing);
  } catch(error) { return publicApiResponse_({ok:false,error:String(error&&error.message||error)},timing); }
}
function jsonResponse_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function publicTimed_(timing,phase,read) {
  if(!timing)return read();
  var started=Date.now();
  try{return read();}finally{if(PUBLIC_TIMING_PHASES_.indexOf(phase)>=0)timing.phases[phase]=Date.now()-started;}
}
function publicApiResponse_(body,timing) {
  if(!timing)return jsonResponse_(body);
  var started=Date.now(),meta={action:PUBLIC_TIMING_ACTION_,totalMs:0,phases:{}};
  body.meta={timing:meta};
  timing.phases.response_construction=Date.now()-started;
  meta.phases=timing.phases;
  meta.totalMs=Date.now()-timing.startedAt;
  return jsonResponse_(body);
}
function sanitizeCxlPublic_(asset) {
  var clone=JSON.parse(JSON.stringify(asset));delete clone.userId;delete clone.collaboration;delete clone.authorEmail;delete clone.email;
  clone.media=(clone.media||[]).map(function(m){var sanitized={id:m.id,assetId:m.assetId||clone.id,purpose:m.purpose,contextId:m.contextId||null,mimeType:m.mimeType,fileSize:m.fileSize,sortOrder:m.sortOrder,isCover:!!m.isCover,createdAt:m.createdAt,updatedAt:m.updatedAt};if(m.delivery==='vercel_proxy')sanitized.delivery='vercel_proxy';return sanitized;});
  if(clone.publicCollaboration){var c=clone.publicCollaboration,p=c.visibilityPolicy||{};(c.participants||[]).forEach(function(person){delete person.contact;delete person.email;if(!p.showParticipantStatuses){delete person.dataStatus;delete person.imageStatus;}if(!p.showParticipantNotes)delete person.notes;if(!p.showParticipantDeadlineOverrides)delete person.deadlineOverrides;});}
  return clone;
}
function legacyPublicToCxl_(record) {
  return {id:record.id,authorName:record.author_name||'Creator',authorAvatar:record.author_avatar,
    title:record.title||'',icon:record.icon||{type:'emoji',value:'✨'},category:record.category||'character',shortDescription:record.short_description||'',
    contentTypeLabels:record.content_type_labels||[],contentTypes:record.content_types||[],presentationMetadata:record.presentation_metadata,
    publicCollaboration:record.public_collaboration||null,collaborationAssetId:record.collaboration_asset_id||null,contentBlocks:record.content_blocks||[],
    content:record.content||'',uiCodeSnippet:record.ui_code_snippet||'',previewImage:record.preview_image||'',previewImages:record.preview_images||[],
    media:(record.mediaRecords||[]).map(function(m){return {id:m.id,assetId:record.id,purpose:m.purpose,contextId:m.context_id||null,
      mimeType:m.mime_type,fileSize:Number(m.file_size||0),sortOrder:Number(m.sort_order||0),isCover:!!m.is_cover,createdAt:m.created_at,updatedAt:m.updated_at};}),
    folderId:record.folder_id||null,isPublic:true,visibility:'public',status:record.status||'finished',tags:record.tags||[],createdAt:record.created_at,
    updatedAt:record.updated_at,deletedAt:null,likesCount:Number(record.likes_count||0),forkCount:Number(record.fork_count||0),
    forkedFromId:record.forked_from_id||null,forkedFromAuthor:record.forked_from_author||null,linkedAssetIds:record.linked_asset_ids||[],versions:record.versions||[]};
}
function settings_() {
  var p=PropertiesService.getScriptProperties();
  var x={sheetId:p.getProperty('PUBLIC_SHEET_ID'),mediaFolderId:p.getProperty('MEDIA_FOLDER_ID')};
  if(!x.sheetId)throw new Error('ยังไม่ได้ตั้งค่า PUBLIC_SHEET_ID');
  return x;
}
function flag_(value) { return value===true || String(value).toLowerCase()==='true'; }
function parsePublicSummary_(raw) {
  if(typeof raw!=='string'||!raw)return null;
  try {
    var envelope=JSON.parse(raw),a=envelope&&envelope.asset,keys=a&&Object.keys(a);
    if(!envelope||PUBLIC_SUMMARY_VERSIONS_.indexOf(envelope.summaryVersion)<0||Object.keys(envelope).sort().join(',')!=='asset,summaryVersion'||!a||!keys.every(function(k){return PUBLIC_SUMMARY_ASSET_FIELDS.indexOf(k)>=0;}))return null;
    if(a.icon&&(/^data:image\//i.test(String(a.icon.value||''))||String(a.icon.value||'').length>2048||Object.keys(a.icon).some(function(k){return ['type','value','mediaId','mimeType'].indexOf(k)<0;})))return null;
    if(a.presentationMetadata&&(Object.keys(a.presentationMetadata).some(function(k){return k!=='appPlatforms';})||!Array.isArray(a.presentationMetadata.appPlatforms)))return null;
    if(a.publicCollaboration){var c=a.publicCollaboration,collabKeys=['name','sharedTag','platforms','sharedInformation','deadlines','participants'];
      if(Object.keys(c).some(function(k){return collabKeys.indexOf(k)<0;})||!Array.isArray(c.platforms)||!Array.isArray(c.sharedInformation)||!Array.isArray(c.deadlines)||!Array.isArray(c.participants))return null;
      if(c.sharedInformation.some(function(x){return !x||Object.keys(x).length!==0;})||c.participants.some(function(x){return !x||Object.keys(x).length!==0;}))return null;
      if(c.deadlines.some(function(x){return !x||Object.keys(x).some(function(k){return k!=='label'&&k!=='date';});}))return null;
    }
    if(!Array.isArray(a.media)||a.media.some(function(m){return !m||Object.keys(m).some(function(k){return ['id','assetId','purpose','contextId','mimeType','fileSize','sortOrder','isCover','createdAt','updatedAt','delivery'].indexOf(k)<0;})||(Object.prototype.hasOwnProperty.call(m,'delivery')&&m.delivery!=='vercel_proxy');}))return null;
    if(typeof a.id==='string'&&typeof a.title==='string'&&typeof a.category==='string'&&typeof a.status==='string'&&
      a.visibility==='public'&&a.isPublic===true&&Array.isArray(a.tags)&&a.content===''&&Array.isArray(a.previewImages)&&
      Array.isArray(a.contentBlocks)&&a.contentBlocks.length===0&&a.uiCodeSnippet===''&&raw.length<=PUBLIC_SUMMARY_MAX_CHARS)return a;
    return null;
  }
  catch(_error) { return null; }
}
function publicBook_() { return SpreadsheetApp.openById(publicSheetId_()); }
function publicSheetId_() {
  var id=PropertiesService.getScriptProperties().getProperty('PUBLIC_SHEET_ID');
  if(!id)throw new Error('ยังไม่ได้ตั้งค่า PUBLIC_SHEET_ID');
  return id;
}
function rows_(book) {
  var sh=(book||publicBook_()).getSheets()[0], last=sh.getLastRow();
  if(last<2)return [];
  var values=sh.getRange(2,1,last-1,11).getValues(),out=[];
  values.forEach(function(v){if(!flag_(v[8]))return;out.push({id:v[0],title:v[1],category:v[2],status:v[3],updatedAt:v[4],tags:JSON.parse(v[5]||'[]'),description:v[6],fileId:v[7],active:true,coverRef:v[9]&&v[9]!=='none'?v[9]:'',summaryJson:v[10]||''});});
  return out;
}
function namedSheetRows_(book,name) {
  var sh=book.getSheetByName?book.getSheetByName(name):null;if(!sh)return [];
  var last=sh.getLastRow(),width=sh.getLastColumn();if(last<2||width<1)return [];
  var values=sh.getRange(1,1,last,width).getValues(),headers=values[0].map(function(x){return String(x||'');});
  return values.slice(1).filter(function(row){return row.some(function(value){return value!==''&&value!==null;});}).map(function(row){var out={};headers.forEach(function(header,index){if(header)out[header]=row[index];});return out;});
}
function workCreatorMap_(book) {
  var out={},duplicates={};
  namedSheetRows_(book,'WorkCreatorMap').forEach(function(row){
    var workId=String(row.workId||''),creatorId=String(row.publicCreatorId||'');
    if(!/^asset_[A-Za-z0-9_-]+$/.test(workId)||!PUBLIC_CREATOR_ID_RE_.test(creatorId)||Number(row.schemaVersion)!==1)return;
    if(out[workId])duplicates[workId]=true;else out[workId]=creatorId;
  });
  Object.keys(duplicates).forEach(function(workId){delete out[workId];});
  return out;
}
function creatorRows_(book) {
  return namedSheetRows_(book,'PublicCreatorIndex').filter(function(row){return flag_(row.active)&&Number(row.schemaVersion)===1
    &&PUBLIC_CREATOR_ID_RE_.test(String(row.publicCreatorId||''))&&/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(String(row.slug||''));});
}
function normalizePublicSlug_(value) {
  var slug=String(value||'').trim().replace(/^@+/,'').toLowerCase();
  return /^[a-z0-9][a-z0-9_.-]{2,31}$/.test(slug)?slug:'';
}
function safePublicCreatorImage_(value) {
  var url=String(value||'');if(!url||url.length>2048||/^data:/i.test(url))return null;
  var match=url.match(/^https:\/\/([^\/?#@]+)(?:\/[^?#]*)?$/i);if(!match)return null;
  var host=match[1].toLowerCase();if(/(^|\.)drive\.google\.com$/.test(host)||/(^|\.)googleusercontent\.com$/.test(host)||/(^|\.)script\.google\.com$/.test(host))return null;
  return url;
}
function safeCreatorSettingUrl_(value) {
  var safe=safePublicCreatorImage_(value);return safe&&safe.indexOf('?')<0&&safe.indexOf('#')<0?safe:null;
}
function publicCreatorProjection_(row) {
  var safe={id:String(row.publicCreatorId),publicCreatorId:String(row.publicCreatorId),username:String(row.slug),displayName:String(row.displayName||'Creator').slice(0,160),
    bio:String(row.bio||'').slice(0,4000),avatarUrl:safePublicCreatorImage_(row.avatarRef),coverUrl:safePublicCreatorImage_(row.coverRef),createdAt:''};
  return safe;
}
function publicCreatorBySlug_(rawSlug) {
  var slug=normalizePublicSlug_(rawSlug);if(!slug)return {data:null,error:'ไม่พบ Creator ที่ต้องการ',reason:'not-found'};
  var rows=creatorRows_(publicBook_()).filter(function(row){return String(row.slug).toLowerCase()===slug;});
  if(rows.length!==1)return {data:null,error:'ไม่พบ Creator ที่ต้องการ',reason:'not-found'};
  return {data:publicCreatorProjection_(rows[0]),error:null,reason:null};
}
function publicCreatorsByIds_(rawIds) {
  var ids;try{ids=JSON.parse(String(rawIds||'[]'));}catch(_error){throw new Error('Invalid public creator IDs');}
  if(!Array.isArray(ids)||ids.length>100||ids.some(function(id){return typeof id!=='string'||!PUBLIC_CREATOR_ID_RE_.test(id);}))throw new Error('Invalid public creator IDs');
  var requested=[],seen={};ids.forEach(function(id){if(!seen[id]){seen[id]=true;requested.push(id);}});
  var rows=creatorRows_(publicBook_()),byId={},duplicateIds={};rows.forEach(function(row){var id=String(row.publicCreatorId);if(byId[id])duplicateIds[id]=true;else if(!duplicateIds[id])byId[id]=row;});Object.keys(duplicateIds).forEach(function(id){delete byId[id];});
  return {data:requested.filter(function(id){return byId[id];}).map(function(id){return publicCreatorProjection_(byId[id]);}),error:null};
}
function sanitizeCreatorSettings_(raw) {
  var source=typeof raw==='string'?JSON.parse(raw):raw;if(!source||typeof source!=='object'||Array.isArray(source)||Number(source.settingsVersion)!==1)return null;
  var out={settingsVersion:1};CREATOR_SETTINGS_FIELDS_.forEach(function(key){if(!Object.prototype.hasOwnProperty.call(source,key))return;var value=source[key];
    if(key==='layout'&&['locked','free'].indexOf(value)>=0)out.layout=value;
    else if(key==='lockedPreset'&&['left','right','split'].indexOf(value)>=0)out.lockedPreset=value;
    else if(key==='portfolioDisplayLimit'&&[3,6,9,12,'all'].indexOf(value)>=0)out.portfolioDisplayLimit=value;
    else if(key==='widgets'&&Array.isArray(value))out.widgets=value.filter(function(type,index,array){return PUBLIC_WIDGET_TYPES_.indexOf(type)>=0&&array.indexOf(type)===index;});
    else if(key==='freePlacements'&&Array.isArray(value))out.freePlacements=value.slice(0,100).filter(function(item){return item&&['widget','portfolio','work'].indexOf(item.kind)>=0&&typeof item.refId==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(item.refId)
      &&Number.isInteger(item.x)&&item.x>=0&&item.x<=11&&Number.isInteger(item.y)&&item.y>=0&&item.y<=239&&Number.isInteger(item.w)&&item.w>=1&&item.w<=12&&Number.isInteger(item.h)&&item.h>=1&&item.h<=8
      &&(item.kind!=='work'||/^asset_[A-Za-z0-9_-]+$/.test(item.refId));}).map(function(item){var x={id:item.kind+':'+item.refId,kind:item.kind,refId:item.refId,x:item.x,y:item.y,w:item.w,h:item.h};if(item.heightMode==='auto')x.heightMode='auto';return x;});
    else if(['widgetRail','spans','widgetTitles'].indexOf(key)>=0&&value&&typeof value==='object'&&!Array.isArray(value)){var maps={},placementIds=(out.freePlacements||[]).map(function(item){return item.id;});Object.keys(value).forEach(function(mapKey){if(mapKey==='folder'||/^folder:/.test(mapKey)||(!PUBLIC_WIDGET_TYPES_.includes(mapKey)&&placementIds.indexOf(mapKey)<0))return;
      var v=value[mapKey];if(key==='widgetRail'&&['left','right'].includes(v))maps[mapKey]=v;else if(key==='spans'&&Number.isFinite(v)&&v>=1&&v<=12)maps[mapKey]=Math.trunc(v);else if(key==='widgetTitles'&&typeof v==='string')maps[mapKey]=v.slice(0,120);});if(Object.keys(maps).length)out[key]=maps;}
    else if(key==='freeOrder'&&Array.isArray(value))out.freeOrder=value.filter(function(id){return typeof id==='string'&&(out.freePlacements||[]).some(function(item){return item.id===id;});}).slice(0,100);
    else if(key==='widgetConfigs'&&value&&typeof value==='object'&&!Array.isArray(value)){var configs={};Object.keys(value).forEach(function(type){var allow=PUBLIC_WIDGET_CONFIG_FIELDS_[type];if(!allow||!value[type]||typeof value[type]!=='object'||Array.isArray(value[type])||type==='folder')return;var config={};allow.forEach(function(field){if(!Object.prototype.hasOwnProperty.call(value[type],field))return;var item=value[type][field];if(typeof item==='string'){if(!/^data:/i.test(item)){var clean=/url$/i.test(field)?safeCreatorSettingUrl_(item):item.slice(0,4000);if(clean)config[field]=clean;}}else if(typeof item==='boolean'||(typeof item==='number'&&Number.isFinite(item)))config[field]=item;
      else if(Array.isArray(item)){var nestedAllow=field==='links'?['label','url']:field==='todoTasks'?['label','done','categoryId','priority','time','status']:field==='todoCategories'?['label','color']:field==='goalItems'?['label','done']:field==='playlistTracks'?['title','artist','duration','url']:field==='clockCities'?['name','timeZone']:field==='weatherForecast'?['date','condition','highCelsius','lowCelsius']:field==='calendarEvents'?['date','title','label']:[];if(nestedAllow.length)config[field]=item.slice(0,100).map(function(entry){if(!entry||typeof entry!=='object')return null;var safe={};nestedAllow.forEach(function(k){var v=entry[k];if(typeof v==='string'&&!/^data:/i.test(v)){var clean=/url$/i.test(k)?safeCreatorSettingUrl_(v):v.slice(0,1000);if(clean)safe[k]=clean;}else if(typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)))safe[k]=v;});return safe;}).filter(Boolean);}
      else if(item&&typeof item==='object'&&!Array.isArray(item)&&field==='clockGreetings'){var greeting={};['morning','afternoon','evening','night'].forEach(function(k){if(typeof item[k]==='string'&&!/^data:/i.test(item[k]))greeting[k]=item[k].slice(0,500);});config[field]=greeting;}});configs[type]=config;});if(Object.keys(configs).length)out[key]=configs;}
    else if(key==='widgetInstances'&&Array.isArray(value))out.widgetInstances=value.slice(0,100).filter(function(item){return item&&PUBLIC_WIDGET_TYPES_.includes(item.widgetType)&&typeof item.id==='string'&&!/^data:/i.test(item.id);}).map(function(item){var config=sanitizeCreatorSettings_({settingsVersion:1,widgetConfigs:{[item.widgetType]:item.config||{}}}).widgetConfigs||{};var clean={id:item.id.slice(0,128),widgetType:item.widgetType};if(typeof item.title==='string')clean.title=item.title.slice(0,120);if(config[item.widgetType])clean.config=config[item.widgetType];return clean;});
  });
  return out;
}
function publicCreatorSettings_(publicCreatorId) {
  var id=String(publicCreatorId||'');if(!PUBLIC_CREATOR_ID_RE_.test(id))throw new Error('Invalid public creator ID');
  var book=publicBook_(),creator=creatorRows_(book).filter(function(row){return String(row.publicCreatorId)===id;});
  if(creator.length!==1)return {data:null,error:null,source:'none'};
  var matches=namedSheetRows_(book,'CreatorSettings').filter(function(row){return String(row.publicCreatorId||'')===id;});
  if(matches.length===0)return {data:null,error:null,source:'none'};
  if(matches.length!==1||Number(matches[0].settingsVersion)!==1)throw new Error('Creator settings are unavailable');
  var settings=sanitizeCreatorSettings_(matches[0].settingsJson);if(!settings)return {data:null,error:null,source:'none'};
  return {data:settings,error:null,source:'cloud'};
}
function publicWorksByCreatorSlug_(rawSlug) {
  var slug=normalizePublicSlug_(rawSlug);if(!slug)return [];
  var book=publicBook_(),creators=creatorRows_(book).filter(function(row){return String(row.slug).toLowerCase()===slug;});if(creators.length!==1)return [];
  var creatorId=String(creators[0].publicCreatorId),mapping=workCreatorMap_(book),index=rows_(book);
  if(index.some(function(row){return !validPublicSummaryJson_(row.summaryJson);}))throw new Error('Public summary index is not ready');
  return index.filter(function(row){return mapping[row.id]===creatorId;}).map(function(row){var asset=JSON.parse(row.summaryJson).asset;
    if(asset.collaborationAssetId&&!index.some(function(item){return item.id===asset.collaborationAssetId;}))asset.collaborationAssetId=null;
    asset.publicCreatorId=creatorId;return sanitizeCxlPublic_(asset);});
}
function listPublicWorks() { return rows_().map(function(x){return {id:x.id,title:x.title,category:x.category,status:x.status,updatedAt:x.updatedAt,tags:x.tags,description:x.description,coverRef:x.coverRef};}); }
function publicRecord_(id,indexRow) {
  if(!/^asset_[a-zA-Z0-9_-]+$/.test(id))throw new Error('ID ไม่ถูกต้อง');
  var row=indexRow||rows_().filter(function(x){return x.id===id;})[0];
  if(!row||row.id!==id)throw new Error('งานนี้ไม่เปิดเผยต่อสาธารณะ');
  return JSON.parse(DriveApp.getFileById(row.fileId).getBlob().getDataAsString('UTF-8'));
}
function publicIconData_(id,ref) {
  id=String(id||'');ref=String(ref||'');
  if(!/^asset_[a-zA-Z0-9_-]+$/.test(id)||!( /^media:[A-Za-z0-9_-]{1,128}$/.test(ref)||/^cxl-media:[a-f0-9]{64}$/.test(ref)))throw new Error('Public icon reference is invalid');
  var indexRow=rows_().filter(function(x){return x.id===id;})[0];
  if(!indexRow||!validPublicSummaryJson_(indexRow.summaryJson))throw new Error('Public icon is unavailable');
  var summary=JSON.parse(indexRow.summaryJson).asset,icon=summary.icon||{};
  if(icon.type!=='image'||(icon.value!==ref&&!(icon.mediaId&&ref==='media:'+icon.mediaId)))throw new Error('Public icon is unavailable');
  var record=publicRecord_(id,indexRow),dataUrl=publicMediaRefFromRecord_(record,id,ref,true);
  var match=String(dataUrl||'').match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if(!match||match[2].length>14*1024*1024)throw new Error('Public icon media is unavailable');
  return {mimeType:match[1].toLowerCase(),base64:match[2]};
}
function getPublicWork(id) { var r=publicRecord_(id);var linked=r.collaboration_asset_id;if(linked){var match=rows_().filter(function(x){return x.id===linked&&x.category==='collab';})[0];r.linkedCollaboration=match?{id:match.id,title:match.title}:null;delete r.collaboration_asset_id;}return r; }
function searchPublicContent(query) {
  var q=String(query||'').trim().toLocaleLowerCase();if(q.length<2)throw new Error('กรุณาใส่คำค้นอย่างน้อย 2 ตัวอักษร');
  var index=rows_();if(index.some(function(x){return !validPublicSummaryJson_(x.summaryJson);}))throw new Error('Public summary index is not ready');
  return index.filter(function(x){return publicSummarySearchText_(JSON.parse(x.summaryJson).asset).indexOf(q)>=0;}).map(function(x){return x.id;});
}
function publicSummarySearchText_(asset) {
  var c=asset.publicCollaboration||{},p=asset.presentationMetadata||{};
  return [asset.title,asset.shortDescription,asset.authorName,asset.category].concat(asset.tags||[],asset.contentTypeLabels||[],asset.contentTypes||[],p.appPlatforms||[],
    [c.name,c.sharedTag].concat(c.platforms||[],(c.deadlines||[]).reduce(function(a,x){return a.concat([x.label,x.date]);},[])))
    .filter(function(x){return typeof x==='string';}).join('\n').toLocaleLowerCase();
}
function getPublicMedia(id,hash) {
  return publicMediaDataFromRecord_(publicRecord_(id),id,hash,false);
}
function publicMediaDataFromRecord_(record,id,hash,thumbnail) {
  if(!/^[a-f0-9]{64}$/.test(hash))throw new Error('media ID ไม่ถูกต้อง');
  if(JSON.stringify(record).indexOf('cxl-media:'+hash)<0)throw new Error('สื่อนี้ไม่อยู่ในงานสาธารณะ');
  var folderId=settings_().mediaFolderId;
  if(!folderId)throw new Error('ยังไม่มีไฟล์สื่อ');
  var folder=DriveApp.getFolderById(folderId),extensions=['jpg','jpeg','png','gif','webp'];
  for(var i=0;i<extensions.length;i++){
    var matches=folder.getFilesByName(hash+'.'+extensions[i]);
    if(matches.hasNext()){var file=matches.next(),blob=thumbnail?file.getThumbnail():null;blob=blob||file.getBlob();return 'data:'+blob.getContentType()+';base64,'+Utilities.base64Encode(blob.getBytes());}
  }
  throw new Error('ยังไม่มีไฟล์สื่อ');
}
function getPublicMediaRef(id,ref,thumbnail) {
  return publicMediaRefFromRecord_(publicRecord_(id),id,ref,thumbnail);
}
function publicMediaRefFromRecord_(record,id,ref,thumbnail) {
  var key=String(ref||'');if(key.indexOf('cxl-media:')===0){if(JSON.stringify(record).indexOf(key)<0)throw new Error('สื่อนี้ไม่อยู่ในงานสาธารณะ');return publicMediaDataFromRecord_(record,id,key.slice(10),thumbnail);}
  var mediaId=key.indexOf('media:')===0?key.slice(6):'';
  var m=(record.mediaRecords||[]).filter(function(x){return x.id===mediaId||x.storage_path===key||x.original_ref===key;})[0];
  if(!m||!m.drive_file_id||JSON.stringify(record).indexOf(key)<0)throw new Error('ยังไม่มีไฟล์ภาพ');
  var f=DriveApp.getFileById(m.drive_file_id),blob=thumbnail?f.getThumbnail():null;blob=blob||f.getBlob();
  return 'data:'+blob.getContentType()+';base64,'+Utilities.base64Encode(blob.getBytes());
}
