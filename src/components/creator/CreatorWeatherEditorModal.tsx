import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CloudSun, Droplets, MapPin, Plus, Trash2, Umbrella, Wind, X } from 'lucide-react';
import { acquireViewportScrollLock } from '../../lib/viewportScrollLock';
import { CreatorWidgetRenderer } from './CreatorWidgetRenderer';
import {
  DEFAULT_WEATHER_DISPLAY_NAME, DEFAULT_WEATHER_LOCATION, DEFAULT_WEATHER_MESSAGE, DEFAULT_WEATHER_TIME_ZONE,
  WEATHER_CONDITIONS, WEATHER_DAY_NIGHT_MODES, WEATHER_MESSAGE_MODES, WEATHER_UNITS,
  getWeatherPresentation, isValidWeatherTimeZone, normalizeWeatherForecastItem, validateWeatherConfig,
  type CreatorWidgetConfig, type WeatherCondition, type WeatherDayNightMode, type WeatherMessageMode, type WeatherUnit
} from './creatorWidgetModel';

interface Props {
  config: CreatorWidgetConfig;
  displayName?: string;
  instanceId?: string;
  previewSpan?: number;
  previewDisplayName: string;
  onSave: (config: CreatorWidgetConfig, displayName: string) => void;
  onCancel: () => void;
}

const conditionLabels: Record<WeatherCondition, string> = { sunny: 'Pixel Sunny', rainy: 'Pixel Rainy', 'cozy-night': 'Pixel Cozy Night', thunder: 'Pixel Thunder' };
const numberFields: Array<[keyof CreatorWidgetConfig, string, string]> = [
  ['weatherCurrentCelsius', 'อุณหภูมิปัจจุบัน', '°C'], ['weatherHighCelsius', 'สูงสุด', '°C'], ['weatherLowCelsius', 'ต่ำสุด', '°C'],
  ['weatherFeelsLikeCelsius', 'Feels like', '°C'], ['weatherHumidity', 'ความชื้น', '%'], ['weatherWindKph', 'ลม', 'km/h'], ['weatherPrecipitation', 'โอกาสฝน', '%']
];

function createDraft(config: CreatorWidgetConfig, displayName?: string) {
  const weather = getWeatherPresentation(config, displayName);
  return {
    title: weather.displayName,
    config: {
      ...config,
      weatherLocation: weather.location,
      weatherTimeZone: weather.timeZone,
      weatherUnit: weather.unit,
      weatherCondition: weather.condition,
      weatherDayNightMode: weather.dayNightMode,
      weatherCurrentCelsius: weather.currentCelsius,
      weatherFeelsLikeCelsius: weather.feelsLikeCelsius,
      weatherHighCelsius: weather.highCelsius,
      weatherLowCelsius: weather.lowCelsius,
      weatherHumidity: weather.humidity,
      weatherWindKph: weather.windKph,
      weatherPrecipitation: weather.precipitation,
      weatherMessage: config.weatherMessage || DEFAULT_WEATHER_MESSAGE,
      weatherMessageMode: weather.messageMode,
      weatherShowCondition: weather.showCondition,
      weatherShowFeelsLike: weather.showFeelsLike,
      weatherShowHumidity: weather.showHumidity,
      weatherShowWind: weather.showWind,
      weatherShowPrecipitation: weather.showPrecipitation,
      weatherShowMessage: weather.showMessage,
      weatherShowForecast: weather.showForecast,
      weatherForecast: weather.forecast
    } as CreatorWidgetConfig
  };
}

export const CreatorWeatherEditorModal: React.FC<Props> = ({ config, displayName, instanceId, previewSpan = 4, previewDisplayName, onSave, onCancel }) => {
  const initial = useRef(createDraft(config, displayName));
  const [title, setTitle] = useState(initial.current.title);
  const [draft, setDraft] = useState<CreatorWidgetConfig>(initial.current.config);
  const [tab, setTab] = useState<'weather' | 'style' | 'display'>('weather');
  const [discard, setDiscard] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const initialJSON = useRef(JSON.stringify(initial.current));
  const dirty = JSON.stringify({ title, config: draft }) !== initialJSON.current;
  const errors = useMemo(() => validateWeatherConfig({ ...draft, title }, title), [draft, title]);
  const presentation = useMemo(() => getWeatherPresentation({ ...draft, title }, title), [draft, title]);
  const canSave = dirty && Object.keys(errors).length === 0;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = acquireViewportScrollLock(document);
    const focusFrame = requestAnimationFrame(() => titleRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); discard ? setDiscard(false) : dirty ? setDiscard(true) : onCancel(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
      if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { cancelAnimationFrame(focusFrame); document.removeEventListener('keydown', onKeyDown); release(); opener?.focus(); };
  }, [dirty, discard, onCancel]);

  const set = (patch: Partial<CreatorWidgetConfig>) => setDraft(previous => ({ ...previous, ...patch }));
  const requestClose = () => dirty ? setDiscard(true) : onCancel();
  const toggle = (key: keyof CreatorWidgetConfig) => set({ [key]: !Boolean(draft[key]) });
  const setNumber = (key: keyof CreatorWidgetConfig, value: string) => set({ [key]: value === '' ? 0 : Number(value) });
  const forecast = draft.weatherForecast || [];
  const updateForecast = (index: number, patch: Partial<(typeof forecast)[number]>) => set({ weatherForecast: forecast.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  const addForecast = () => { if (forecast.length >= 5) return; set({ weatherForecast: [...forecast, { id: `forecast-${Date.now()}`, day: `Day ${forecast.length + 1}`, condition: 'sunny', highCelsius: 30, lowCelsius: 24 }] }); };

  return <div className="csp-weather-editor-backdrop" data-widget-editor-instance-id={instanceId}>
    <div ref={dialogRef} className="csp-weather-editor-modal" role="dialog" aria-modal="true" aria-labelledby="csp-weather-editor-title">
      <div className="csp-weather-editor-ribbon"><span><i />บันทึกไว้ในเบราว์เซอร์เครื่องนี้ · ยังไม่ซิงก์กับฐานข้อมูล</span><small>Retro Pixel Weather</small></div>
      <header className="csp-weather-editor-header"><div className="csp-weather-editor-mark"><CloudSun aria-hidden="true" /></div><div><h2 id="csp-weather-editor-title">แก้ไข สภาพอากาศ (Notion Weather Widget)</h2><p>ตั้งค่าข้อมูลอากาศที่อยากแสดงบนหน้า Creator ด้วยตัวเอง</p></div><button type="button" onClick={requestClose} aria-label="ปิด Weather editor"><X /></button></header>
      <form onSubmit={event => { event.preventDefault(); if (canSave) onSave({ ...draft, title: title.trim() || DEFAULT_WEATHER_DISPLAY_NAME }, title.trim() || DEFAULT_WEATHER_DISPLAY_NAME); }}>
        <div className="csp-weather-editor-layout">
          <aside className="csp-weather-inspector">
            <div className="csp-weather-tabs">{(['weather', 'style', 'display'] as const).map(value => <button type="button" className={tab === value ? 'is-selected' : ''} onClick={() => setTab(value)} key={value}>{value === 'weather' ? '☀ สภาพอากาศ' : value === 'style' ? '◌ สไตล์' : '✦ การแสดงผล'}</button>)}</div>
            {tab === 'weather' && <div className="csp-weather-tab-panel">
              <label>ชื่อวิดเจ็ต<input ref={titleRef} maxLength={48} value={title} onChange={event => setTitle(event.target.value)} />{errors.displayName && <em>{errors.displayName}</em>}</label>
              <label>ตำแหน่งที่ตั้ง<input value={draft.weatherLocation || ''} onChange={event => set({ weatherLocation: event.target.value })} placeholder={DEFAULT_WEATHER_LOCATION} />{errors.weatherLocation && <em>{errors.weatherLocation}</em>}</label>
              <label>Timezone<input value={draft.weatherTimeZone || ''} onChange={event => set({ weatherTimeZone: event.target.value })} placeholder={DEFAULT_WEATHER_TIME_ZONE} />{errors.weatherTimeZone && <em>{errors.weatherTimeZone}</em>}</label>
              <div className="csp-weather-unit"><span>หน่วยอุณหภูมิ</span>{WEATHER_UNITS.map(unit => <button type="button" className={presentation.unit === unit ? 'is-selected' : ''} key={unit} onClick={() => set({ weatherUnit: unit })}>{unit === 'c' ? '°C เซลเซียส' : '°F ฟาเรนไฮต์'}</button>)}</div>
              <div className="csp-weather-number-grid">{numberFields.map(([key, label, unit]) => <label key={String(key)}>{label}<span><input type="number" value={Number(draft[key] ?? 0)} onChange={event => setNumber(key, event.target.value)} />{unit}</span></label>)}</div>
            </div>}
            {tab === 'style' && <div className="csp-weather-tab-panel">
              <span className="csp-weather-label">Pixel weather condition</span><div className="csp-weather-condition-grid">{WEATHER_CONDITIONS.map(condition => <button type="button" className={presentation.condition === condition && presentation.dayNightMode === 'manual' ? 'is-selected' : ''} key={condition} onClick={() => set({ weatherCondition: condition, weatherDayNightMode: 'manual' })}>{conditionLabels[condition]}</button>)}</div>
              <div className="csp-weather-unit"><span>Day / Night mood</span>{WEATHER_DAY_NIGHT_MODES.map(mode => <button type="button" className={presentation.dayNightMode === mode ? 'is-selected' : ''} key={mode} onClick={() => set({ weatherDayNightMode: mode })}>{mode === 'auto' ? 'Auto by timezone' : 'Manual'}</button>)}</div>
              <label className="csp-weather-check"><input type="checkbox" checked={presentation.showForecast} onChange={() => toggle('weatherShowForecast')} />แสดง forecast เมื่อการ์ดกว้าง 6+ คอลัมน์</label>
              {presentation.showForecast && <div className="csp-weather-forecast-editor"><div><strong>Forecast</strong><button type="button" onClick={addForecast} disabled={forecast.length >= 5}><Plus />เพิ่มวัน</button></div>{forecast.length === 0 && <p>ยังไม่มี forecast — การ์ดจะไม่สร้างข้อมูลขึ้นมาเอง</p>}{forecast.map((item, index) => <div key={item.id}><input value={item.day} onChange={event => updateForecast(index, { day: event.target.value })} aria-label="วัน" /><select value={item.condition} onChange={event => updateForecast(index, { condition: event.target.value as WeatherCondition })}>{WEATHER_CONDITIONS.map(condition => <option key={condition} value={condition}>{conditionLabels[condition]}</option>)}</select><input type="number" value={item.highCelsius} onChange={event => updateForecast(index, { highCelsius: Number(event.target.value) })} aria-label="สูงสุด" /><input type="number" value={item.lowCelsius} onChange={event => updateForecast(index, { lowCelsius: Number(event.target.value) })} aria-label="ต่ำสุด" /><button type="button" onClick={() => set({ weatherForecast: forecast.filter((_, itemIndex) => itemIndex !== index) })} aria-label="ลบ forecast"><Trash2 /></button></div>)}</div>}
            </div>}
            {tab === 'display' && <div className="csp-weather-tab-panel">
              <fieldset><legend>องค์ประกอบที่ต้องการแสดง</legend>{[['weatherShowCondition','สภาพอากาศ'],['weatherShowFeelsLike','Feels Like'],['weatherShowHumidity','ความชื้น'],['weatherShowWind','ความเร็วลม'],['weatherShowPrecipitation','โอกาสฝน'],['weatherShowMessage','Weather Care message']].map(([key,label]) => <label className="csp-weather-check" key={key}><input type="checkbox" checked={Boolean(draft[key as keyof CreatorWidgetConfig])} onChange={() => toggle(key as keyof CreatorWidgetConfig)} />{label}</label>)}</fieldset>
              <div className="csp-weather-unit"><span>Weather Care</span>{WEATHER_MESSAGE_MODES.map(mode => <button type="button" key={mode} className={presentation.messageMode === mode ? 'is-selected' : ''} onClick={() => set({ weatherMessageMode: mode })}>{mode === 'auto' ? 'Auto' : 'Custom'}</button>)}</div>
              {presentation.messageMode === 'custom' && <label>ข้อความ Care<textarea maxLength={140} value={draft.weatherMessage || ''} onChange={event => set({ weatherMessage: event.target.value })} /></label>}
              <div className="csp-weather-editor-locked"><CloudSun /><span><strong>Warm Cream / Retro Pixel</strong><small>ธีมล็อกไว้ให้ตรงกับการ์ดจริง</small></span></div>
            </div>}
          </aside>
          <section className="csp-weather-live-preview"><div className="csp-weather-preview-toolbar"><span><MapPin /> My Aesthetic Desk · Notion Dashboard</span><small>ตั้งค่าเอง · ไม่ใช่ข้อมูลสด</small></div><div className="csp-weather-preview-page"><h3>🌸 My Aesthetic Desk • Daily Hub</h3><p>Created for daily productivity, aesthetic morning check-ins &amp; focus blocks.</p><div className="csp-weather-preview-row"><div className="csp-weather-preview-widget"><CreatorWidgetRenderer type="weather" config={{ ...draft, title }} title={title} span={previewSpan} folders={[]} assets={[]} displayName={previewDisplayName} isOwner={false} /></div><div className="csp-weather-preview-filler">◷ Cozy Clock Widget<br /><br />Daily Priorities / Tasks</div></div></div></section>
        </div>
        <footer className="csp-weather-editor-actions"><span>{dirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ยังไม่มีการเปลี่ยนแปลง'}</span><div><button type="button" onClick={requestClose}>ยกเลิก</button><button type="submit" disabled={!canSave}><Check />บันทึกและเสร็จสิ้น</button></div></footer>
      </form>
      {discard && <div className="csp-weather-discard" role="alertdialog" aria-modal="true"><div><h3>ทิ้งการเปลี่ยนแปลง?</h3><p>ข้อมูล Weather ที่ยังไม่บันทึกจะหายไป</p><button type="button" onClick={() => setDiscard(false)}>กลับไปแก้ไข</button><button type="button" onClick={onCancel}>ทิ้งการเปลี่ยนแปลง</button></div></div>}
    </div>
  </div>;
};
