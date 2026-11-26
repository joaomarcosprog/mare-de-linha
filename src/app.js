import {spots, urls, officialStations, chmSource, format, compass, condition, requestJson, forecastRequest, forecastRows, riverRequest, riverRows,
  tides, astronomy, plusDay, prettyDate, localStamp, minuteLabel, clockMinute} from './data.js';
import {marker,escape,button,actionText,sourceLink,blank} from './ui.js';
import {profiles, levels, guideForecast, shiftHours, windowLabel} from './guide.js';
import {conditionInsights} from './insights.js';
import {assessment,dateName,dayWindow,factorPanel,guideControls,hourDetail,hourStrip,insightCard,methodology,missingNote,profileOptions,riskCard,solunarBars,statusChip,strongHours,weekList} from './guide-view.js';

const $ = (q) => document.querySelector(q);
const normalize = (value) => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
const read = (key,fallback) => { try { return JSON.parse(localStorage.getItem(`mare-${key}`)) ?? fallback; } catch { return fallback; } };
const write = (key,value) => { try { localStorage.setItem(`mare-${key}`,JSON.stringify(value)); return true; } catch { return false; } };
const units = (value,unit,digits=1) => Number.isFinite(value) ? `${format(value,digits)} <small>${unit}</small>` : '—';

const pages = [['home','Guia','compass'],['tide','Marés','waves'],['weather','Condições','wind'],['moon','Sol e Lua','moon-star'],['journal','Diário','notebook-pen']];
const cached = read('forecast',{});
const custom = read('places',[]);
const allPlaces = () => [...spots,...custom];
let favorites = read('favorites',[]);
let records = read('catches',[]);
let place = allPlaces().find(({id}) => id === read('selected','salvador')) || spots[0];
const storedProfile = read('profile','beach');
let profileId = Object.hasOwn(profiles,storedProfile) ? storedProfile : 'beach';
let mode = read('mode','simple') === 'detail'?'detail':'simple';
let page = 'home';
let pickedHour = null;
let tideMode = 'auto';
let tideView = 'day';
let weatherView = 'weather';
let weatherMetric = '';
let moonView = 'day';
let liveFailure = {};
let lastRequest = 0;
let forecastRevision = 0;
let loading = false;
let toastTimer;
const zone = () => place.zone || cached[place.id]?.weather?.data?.timezone || cached[place.id]?.marine?.data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const clock = () => localStamp(new Date(),zone());
const today = () => clock().slice(0,10);
let day = today();

const forecastMap = new WeakMap();
const rows = (type) => {
  const item = cached[place.id]?.[type]?.data;
  if (!item) return [];
  if (!forecastMap.has(item)) forecastMap.set(item,forecastRows(item));
  return forecastMap.get(item);
};
const actualRows = (type) => rows(type).filter(({time}) => time.startsWith(day));
const dayHour = () => pickedHour || (day === today() ? clock().slice(11,13) : '12');

let previousGuide;
function guide() {
  const time = clock();
  const store = cached[place.id] || {};
  const key = [place.id,zone(),day,time,profileId,forecastRevision].join('|');
  if (previousGuide?.key === key) return previousGuide.forecast;
  const forecast = guideForecast({place,zone:zone(),profileId,weather:rows('weather'),marine:rows('marine'),river:riverRows(store.river?.data),
    weatherEntry:store.weather,marineEntry:store.marine,riverEntry:store.river,now:Date.now(),current:time,selected:day});
  previousGuide = {key,forecast};
  return forecast;
}

const referenceTime = () => `${day}T${dayHour()}:00`;
const referenceRow = (forecast) => forecast.rows.get(referenceTime());
const localCaption = () => day===today() && !pickedHour?`Agora · ${dayHour()}h`:`${dateName(day,today())} · ${dayHour()}h`;

async function refresh() {
  const target = place;
  const id = ++lastRequest;
  const todayBefore = today();
  loading = true;
  liveFailure = {};
  render();
  const second = profileId==='river'?'river':'marine';
  const requests = [['weather',forecastRequest(target,false)],[second,second==='river'?riverRequest(target):forecastRequest(target,true)]];
  const results = await Promise.allSettled(requests.map(([,request])=>request));
  const targetCache = cached[target.id] || {};
  results.forEach((result,index) => {
    const type = requests[index][0];
    const data = result.status === 'fulfilled' ? result.value : null;
    if (data?.[type==='river'?'daily':'hourly']?.time?.length) {
      if (id === lastRequest || !targetCache[type]) {
        targetCache[type] = {data,stamp:Date.now()};
        forecastRevision++;
      }
    } else if (id === lastRequest) liveFailure[type] = true;
  });
  if (Object.keys(targetCache).length) cached[target.id] = targetCache;
  const latest = (item) => Math.max(item.weather?.stamp||0,item.marine?.stamp||0,item.river?.stamp||0);
  const recent = Object.entries(cached).sort(([,a],[,b]) => latest(b)-latest(a)).slice(0,12);
  write('forecast',Object.fromEntries(recent));
  if (id !== lastRequest) return;
  if (day === todayBefore) day = today();
  loading = false;
  render();
}

function statusBadge() {
  if (loading) return '<span class="badge">Atualizando previsão…</span>';
  const store = cached[place.id];
  const now = Date.now();
  const weather = Boolean(store?.weather && now - store.weather.stamp < 3600000 && !liveFailure.weather);
  const marine = Boolean(store?.marine && now - store.marine.stamp < 3600000 && !liveFailure.marine);
  if (weather && (marine || profileId==='river')) return `<span class="badge">${marker('check')} Previsão atualizada</span>`;
  const message = weather || marine ? 'Previsão parcial' : store ? 'Dados salvos' : 'Previsão indisponível';
  return `<span class="badge off">${marker('circle-alert')} ${message}</span>`;
}

function navBar() {
  const active = page==='planner'?'home':page;
  return `<div class="nav-wrap">${pages.map(([id,label,icon]) => `<button class="nav-item ${id===active?'active':''}" data-do="page:${id}" ${id===active?'aria-current="page"':''}><span class="nav-icon">${marker(icon)}</span>${label}</button>`).join('')}</div>`;
}

function header() {
  const isFavorite = favorites.includes(place.id);
  return `<div class="top wrap"><button class="brand" data-do="page:home" aria-label="Maré de Linha, início"><span class="brand-mark">${marker('fish')}</span>Maré de Linha</button><div class="top-actions">
  <button class="location-button" type="button" data-do="places" aria-label="Escolher ponto de pesca">${marker('map-pin')}<span>${escape(place.region || 'Meu ponto')}</span>${marker('chevron-down')}</button>
  ${button('favorite',isFavorite?'Remover dos favoritos':'Salvar nos favoritos','star',`icon-button ${isFavorite?'active':''}`,`aria-pressed="${isFavorite}"`)}${button('refresh','Atualizar previsão','refresh-cw','icon-button',loading?'disabled':'')}
  </div></div>`;
}

function dates(withHour=false) {
  const relative = dateName(day,today());
  return `<div class="datebar"><div class="date-main"><button data-do="date" class="date-label" type="button">${marker('calendar-days')}<span>${escape(relative)}<small>${escape(prettyDate(day,{day:'numeric',month:'long',year:'numeric'}))}</small></span></button></div>
    <div class="date-controls">${withHour?actionText('choose-hour',`${dayHour()}h`,'clock-4','hour-choice'):''}${button('prev','Dia anterior','chevron-left','')}${button('next','Próximo dia','chevron-right','')}</div></div>`;
}

function cardHeading(icon,title,extra='') {
  return `<div class="card-title"><div>${marker(icon)}<h2>${escape(title)}</h2></div>${extra}</div>`;
}

function graph(data, caption, dots=[], digits=1) {
  const valid = data.filter(({value}) => Number.isFinite(value));
  if (valid.length < 2) return blank('Sem dados para desenhar o gráfico neste dia.');
  const all = valid.concat(dots);
  const lo = Math.min(...all.map(({value}) => value));
  const hi = Math.max(...all.map(({value}) => value));
  const span = Math.max(hi-lo, 10 ** -digits);
  const bottom = lo - span*.07;
  const top = hi + span*.07;
  const x = (minute) => 38 + (minute / 1440) * 306;
  const y = (value) => 113 - ((value-bottom)/(top-bottom)) * 95;
  const segments = [];
  let segment = [];
  const minGap = Math.min(...valid.slice(1).map(({minute},i) => minute - valid[i].minute).filter((gap) => gap > 0),60);
  for (const p of valid) {
    if (segment.length && p.minute - segment[segment.length-1].minute > Math.max(20,minGap * 1.5)) {
      segments.push(segment); segment = [];
    }
    segment.push(p);
  }
  if (segment.length) segments.push(segment);
  const lines = segments.map((points) => {
    const d = points.map((p,i) => `${i?'L':'M'}${x(p.minute).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const first = points[0], last = points[points.length-1];
    return `<path d="${d} L${x(last.minute)},113 L${x(first.minute)},113 Z" fill="url(#chart-fill)"/><path class="chart-line" d="${d}"/>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 358 138" role="img" aria-label="${escape(caption)}"><defs><linearGradient id="chart-fill" x2="0" y2="1"><stop stop-color="#50c0a6" stop-opacity=".42"/><stop offset="1" stop-color="#50c0a6" stop-opacity=".05"/></linearGradient></defs>
    ${[hi,(hi+lo)/2,lo].map((v) => `<text x="1" y="${y(v)+3}">${format(v,digits)}</text><line class="chart-axis" x1="38" x2="344" y1="${y(v)}" y2="${y(v)}"/>`).join('')}${lines}
    ${dots.map(({minute,value}) => `<circle class="chart-dot" cx="${x(minute)}" cy="${y(value)}" r="3.8"/>`).join('')}
    ${[0,360,720,1080,1440].map((v) => `<text x="${x(v)}" y="131" text-anchor="middle">${v===1440?'24h':`${String(v/60).padStart(2,'0')}h`}</text>`).join('')}
    </svg>`;
}

const tideNames = {high:'Preamar',low:'Baixa-mar',turn:'Extremo'};
const tideIcons = {high:'arrow-up-right',low:'arrow-down-right',turn:'waves'};
const tideItem = ({type,minute,value}, simple=false) => `<div class="tide-item">${marker(tideIcons[type])}<div><strong>${minuteLabel(minute)} · ${format(value,2)} m</strong>${simple?({high:'Maré alta',low:'Maré baixa',turn:'Extremo de maré'})[type]:tideNames[type]}</div></div>`;
function tideCard(tideData) {
  const label = tideData.official ? `CHM · ${escape(place.name)}` : 'Open-Meteo · Modelo oceânico';
  return `<section class="card">${cardHeading('waves','Curva de maré',`<span class="badge">${tideData.official?'Tábua oficial':'Estimativa'}</span>`)}
  <p class="caption">${label} · ${tideData.datum}</p>
  ${graph(tideData.points,'Altura da maré em metros ao longo do dia',tideData.items)}
  ${tideData.items.length?`<div class="tide-items">${tideData.items.map((item)=>tideItem(item)).join('')}</div>`:''}
  <p class="fineprint">${tideData.official?'Curva interpolada entre os horários da tábua.':'Horários de maré aproximados. Consulte a tábua oficial para navegação.'}</p>
  </section>`;
}

function astroForDay(date) {
  try { return astronomy(place,date,zone()); } catch { return {phase:'—',sunUp:'—',sunDown:'—',moonUp:'—',moonDown:'—',events:[]}; }
}

const stat = (label,value) => `<div class="stat"><small>${label}</small><strong>${value}</strong></div>`;
function contextTitle(title) {
  return `<div class="section-head context-head"><div><p class="point-region">${escape(place.name)}</p><h1>${title}</h1></div></div>${guideControls(profiles[profileId],mode)}`;
}

function insights(forecast, row, tide=forecast.tide) {
  const previous = guideWeatherAt(forecast,shiftHours(row.time,-3));
  const next = guideWeatherAt(forecast,shiftHours(row.time,3));
  return conditionInsights(row,next,previous,forecast.profile,tide,day===today()&&!pickedHour?clockMinute(clock().slice(11)):Number(dayHour())*60);
}

function guideWeatherAt(forecast,time) {
  return forecast.rows.get(time) || {weather:rows('weather').find((x)=>x.time===time) || {},
    marine:forecast.profile.wave && forecast.nearMarine ? rows('marine').find((x)=>x.time===time) || {} : {}};
}

function home() {
  const forecast = guide();
  const row = referenceRow(forecast);
  const {best,next,selectedPlan} = forecast;
  const local = day===today()&&!pickedHour?next:forecast.hours(day).slice(Number(dayHour()),Number(dayHour())+7);
  const dayWarnings = selectedPlan.hazardTimes.length ? selectedPlan.hazardTimes : local.filter((item)=>item.hazards.length);
  const futureWarning = dayWarnings[0];
  const supporting = insights(forecast,row);
  const detailEntry = (id,dest) => {
    const item = supporting.find((x)=>x.id===id);
    return `<button class="quick-insight" data-do="${dest}"><span class="insight-icon">${marker(item.icon)}</span><span><small>${item.title}</small><strong>${escape(item.headline)}</strong></span>${marker('chevron-right')}</button>`;
  };
  return `<div class="point-head"><div><p class="point-region">${escape(place.region || 'Meu ponto')}</p><h1><button data-do="places">${escape(place.name)}${marker('chevron-down')}</button></h1></div>${statusBadge()}</div>
    ${guideControls(forecast.profile,mode)}${dates()}
    <div class="decision-grid">${assessment(row,localCaption(),loading,mode,forecast.profile.wave?'':'Leitura do tempo na margem.')}${dayWindow(selectedPlan,dateName(day,today()).toLowerCase())}</div>
    ${missingNote(row,forecast)}${futureWarning?'':Number.isFinite(row.score)?`<p class="data-note">${marker('shield-check')}<span>Sem sinal de risco nos horários avaliados. ${sourceLink(urls.alerts,'Confira os avisos oficiais.')}</span></p>`:''}
    ${riskCard(dayWarnings,liveFailure.weather||liveFailure.marine||!forecast.trust.weather||(forecast.profile.wave&&!forecast.trust.marine)?'Leitura baseada nos últimos dados disponíveis.':'Sinais da previsão do app. Consulte os avisos oficiais para verificar a área.')}
    ${hourStrip(local,day===today()&&!pickedHour?row.time:'')}
    ${best?`<button class="week-highlight" data-do="plan-day:${best.date}"><span class="week-icon">${marker('calendar-range')}</span><span><small>Melhor janela dos próximos 7 dias</small><strong>${dateName(best.date,today())} · ${windowLabel(best.best)}</strong></span><span class="week-score tone-${best.best.state}">${best.best.score}</span>${marker('chevron-right')}</button>`:''}
    <div class="section-head"><h2>O que pesa na avaliação</h2>${actionText('method','Ver critérios','info')}</div>${factorPanel(row,mode==='detail')}
    <section class="hour-section"><header class="section-head"><h2>Entenda o ponto</h2></header><div class="quick-grid">${detailEntry('wind','weather:weather')}${detailEntry(forecast.profile.wave?'waves':'river',`weather:${forecast.profile.wave?'marine':'river'}`)}${detailEntry(forecast.profile.wave?'tide':'rain',forecast.profile.wave?'page:tide':'weather:weather')}
    <button class="quick-insight" data-do="page:moon"><span class="insight-icon">${marker('moon-star')}</span><span><small>Sol e Lua</small><strong>${escape(row.lunar || 'Veja os horários')}</strong></span>${marker('chevron-right')}</button></div></section>`;
}

function plannerScreen() {
  const forecast = guide();
  const plan = forecast.selectedPlan;
  return `${contextTitle('Planejar a pescaria')}
    <p class="section-intro">Compare as melhores janelas previstas para a sua modalidade.</p><div id="week-overview">${weekList(forecast,today(),day)}</div>
    <section id="plan-detail" tabindex="-1"><div class="section-head"><h2>${escape(dateName(day,today()))} por hora</h2>${actionText('week-overview','Ver dias','calendar-range')}</div>
    ${strongHours(plan)}${riskCard(plan.hazardTimes)}${hourStrip(forecast.hours(day),'','Todos os horários',true)}
    ${mode==='detail'?table(['Hora','Avaliação','Índice','Luz','Solunar'],forecast.hours(day).map((hour)=>[
      hour.time.slice(11),levels[hour.state].label,hour.score ?? '—',hour.lighting || '—',hour.lunar || '—'])):''}
    <p class="fineprint">O melhor dia é aquele com a janela mais bem avaliada entre os sete dias disponíveis.</p></section>`;
}

function pills(items,selected,prefix) {
  return `<div class="wide-buttons">${items.map(([id,label]) => `<button type="button" class="pill ${id===selected?'active':''}" aria-pressed="${id===selected}" data-do="${prefix}:${id}">${label}</button>`).join('')}</div>`;
}

function table(columns,entries) {
  if (!entries.length) return blank('Sem previsão disponível para este dia.');
  return `<div class="rows" tabindex="0" aria-label="Tabela de dados"><table><thead><tr>${columns.map((name) => `<th scope="col">${name}</th>`).join('')}</tr></thead>
    <tbody>${entries.map((values) => `<tr>${values.map((value,i) => i===0?`<th scope="row">${value}</th>`:`<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function tideScreen() {
  const forecast = guide();
  if (!forecast.profile.wave) return `${contextTitle('Marés')}${blank('Na pesca de rio, acompanhe a vazão e o tempo. Em um trecho sob influência do mar, escolha Estuário ou Manguezal.')}${actionText('weather:river','Ver condições do rio','arrow-right','primary')}`;
  const marine = forecast.nearMarine ? rows('marine') : [];
  const datum = tides(place,day,marine,tideMode);
  if (mode==='simple') {
    const row = referenceRow(forecast);
    const hint = insights(forecast,row).find(({id})=>id==='tide');
    const source = forecast.tide.official?'CHM · Tábua oficial e nível interpolado':'Open-Meteo · Estimativa oceânica';
    return `${contextTitle('Marés')}${dates(true)}${insightCard(hint,true)}<section class="card daily-tides">
      ${cardHeading('calendar-days','Maré alta e baixa')}<p class="caption">${source}</p>
      ${forecast.tide.items.length?`<div class="tide-items">${forecast.tide.items.map((item)=>tideItem(item,true)).join('')}</div>`:blank('Sem horários de maré disponíveis para este ponto e dia.')}
      ${actionText('mode:detail','Abrir gráfico e tábua','arrow-right')}
      </section><p class="fineprint">A subida da maré e a força da corrente são leituras diferentes. Para navegar, use a ${sourceLink(urls.chm2026,'tábua oficial da estação')}.</p>`;
  }
  const first = `${day.slice(0,7)}-01`;
  const monthDates = Array.from({length:31},(_,i)=>plusDay(first,i)).filter((date)=>date.slice(0,7)===day.slice(0,7));
  const modelDays = Array.from({length:7},(_,i)=>plusDay(today(),i));
  const datesToShow = datum.official ? monthDates : modelDays;
  const periodTitle = datum.official ? 'Tábua do mês' : 'Previsão de 7 dias';
  const period = (date) => {
    const events = tides(place,date,marine,tideMode).items;
    return [escape(prettyDate(date,{day:'2-digit',month:'2-digit',weekday:'short'})),
      events.map(({minute,value,type}) => `${minuteLabel(minute)} ${type==='high'?'↑':type==='low'?'↓':'·'} ${format(value,2)} m`).join(' &nbsp; ') || '—'];
  };
  const hint = insights(forecast,referenceRow(forecast),datum).find(({id})=>id==='tide');
  return `${contextTitle('Marés')}${dates(true)}
    ${officialStations[place.id]?.table[day]?pills([['auto','Preferir tábua oficial'],['model','Modelo oceânico']],tideMode,'tide-mode'):''}
    ${pills([['day','Dia'],['period',periodTitle]],tideView,'tide-view')}
    ${tideView==='day'?`${tideCard(datum)}<p class="technical-reading">${datum.official===forecast.tide.official?`${hint.headline} · ${hint.outlook}`:'Curva oceânica de referência. A avaliação do guia prioriza a tábua oficial quando disponível.'}</p>`:`<section class="card">${cardHeading('calendar-days',periodTitle)}<p class="caption">${datum.official?`CHM · ${escape(place.name)} (NR)`:'Open-Meteo · Estimativa (nível médio global)'}</p>${table(['Data','Horários e alturas'],datesToShow.map(period))}</section>`}
    <p class="fineprint">Tábuas do Centro de Hidrografia da Marinha ${sourceLink(urls.chm2026,'2026')} e ${sourceLink(urls.chm2027,'2027')}.</p>`;
}

function weatherTable(forecast) {
  if (weatherView==='river') {
    const daily = riverRows(cached[place.id]?.river?.data).filter(({time})=>time>=today());
    return `<section class="card">${cardHeading('waves','Vazão média diária modelada')}${table(['Data (UTC)','Vazão (m³/s)'],daily.map(({time,value})=>[prettyDate(time,{day:'numeric',month:'short'}),format(value,0)]))}</section>`;
  }
  const kind = weatherView === 'marine' ? 'marine' : 'weather';
  const hourly = kind==='marine'&&!forecast.nearMarine?[]:actualRows(kind);
  const record = hourly.find(({time})=>time===referenceTime()) || {};
  const time = (r) => r.time.slice(11,16);
  if (weatherView === 'marine') return `<section class="card">${cardHeading('waves','Mar por hora')}
    <div class="trend">${stat('Ondulação',units(record.swell_wave_height,'m'))}${stat('Período da ondulação',units(record.swell_wave_period,'s'))}${stat('Água superficial',units(record.sea_surface_temperature,'°C'))}${stat('Corrente',units(record.ocean_current_velocity,'km/h'))}</div>
    ${table(['Hora','Ondas (m)','Período (s)','Ondas vêm de','Ondulação (m)','Período ond. (s)','Ondulação vem de','Água (°C)','Corrente (km/h)','Corrente vai para'],hourly.map((r)=>[time(r),format(r.wave_height),format(r.wave_period),compass(r.wave_direction),format(r.swell_wave_height),format(r.swell_wave_period),compass(r.swell_wave_direction),format(r.sea_surface_temperature),format(r.ocean_current_velocity),compass(r.ocean_current_direction)]))}</section>`;
  if (weatherView === 'pressure') {
    const previous = rows('weather').find((r)=>r.time===shiftHours(referenceTime(),-3));
    const change = Number.isFinite(record.pressure_msl) && Number.isFinite(previous?.pressure_msl) ? record.pressure_msl-previous.pressure_msl : NaN;
    return `<section class="card">${cardHeading('gauge','Pressão atmosférica')}<div class="trend">${stat('Ao nível do mar',units(record.pressure_msl,'hPa'))}${stat('Variação em 3 h',Number.isFinite(change)?`${change>0?'+':''}${format(change)} <small>hPa</small>`:'—')}${stat('Pressão na superfície',units(record.surface_pressure,'hPa'))}</div>
    ${table(['Hora','Nível do mar (hPa)','Superfície (hPa)'],hourly.map((r)=>[time(r),format(r.pressure_msl),format(r.surface_pressure)]))}</section>`;
  }
  return `<section class="card">${cardHeading('cloud-sun','Tempo e vento por hora')}
    <div class="trend">${stat('Temperatura',units(record.temperature_2m,'°C'))}${stat('Sensação',units(record.apparent_temperature,'°C'))}${stat('Chuva',units(record.precipitation_probability,'%',0))}${stat('Rajadas',units(record.wind_gusts_10m,'km/h',0))}</div>
    ${table(['Hora','Tempo','Ar (°C)','Vento (km/h)','Rajadas','Vem de','Chance de chuva','Precipitação (mm)','Umidade','Nuvens','Visib. (km)'],hourly.map((r)=>[time(r),condition(r.weather_code),format(r.temperature_2m),format(r.wind_speed_10m,0),format(r.wind_gusts_10m,0),compass(r.wind_direction_10m),units(r.precipitation_probability,'%',0),format(r.precipitation),units(r.relative_humidity_2m,'%',0),units(r.cloud_cover,'%',0),format(Number.isFinite(r.visibility)?r.visibility/1000:NaN)]))}</section>`;
}

const weatherSets = {
  weather:{items:['wind','rain','air'],fields:[['wind_speed_10m','Vento (km/h)'],['wind_gusts_10m','Rajadas (km/h)'],['precipitation_probability','Chuva (%)'],['precipitation','Chuva (mm)'],['temperature_2m','Ar (°C)']]},
  marine:{items:['waves','current','water'],fields:[['wave_height','Ondas (m)'],['wave_period','Período (s)'],['ocean_current_velocity','Corrente (km/h)'],['sea_surface_temperature','Água (°C)']]},
  pressure:{items:['pressure'],fields:[['pressure_msl','Pressão ao nível do mar (hPa)']]},
  river:{items:['river'],fields:[]},
};

function weatherGraph(forecast) {
  const options = weatherSets[weatherView].fields;
  if (!options.length) return '';
  const [field,label] = options.find(([key])=>key===weatherMetric) || options[0];
  const kind = weatherView==='marine'?'marine':'weather';
  const hourly = kind==='marine'&&!forecast.nearMarine?[]:actualRows(kind);
  const values = hourly.map((row)=>({minute:clockMinute(row.time.slice(11)),value:row[field]}));
  return `<section class="card weather-graph">${cardHeading('activity',label)}${options.length>1?pills(options,field,'weather-metric'):''}${graph(values,`${label} ao longo do dia`,[],['temperature_2m','wind_speed_10m','pressure_msl'].includes(field)?1:2)}</section>`;
}

function weatherScreen() {
  const forecast = guide();
  const row = referenceRow(forecast);
  const kind = weatherView === 'marine' ? 'marine' : weatherView==='river'?'river':'weather';
  const latest = cached[place.id]?.[kind]?.stamp;
  const stamp = latest && localStamp(new Date(latest),zone());
  const refreshNote = stamp ? ` Dados obtidos em ${prettyDate(stamp.slice(0,10),{day:'numeric',month:'short'})}, ${stamp.slice(11,16)}${liveFailure[kind]?' · consulta salva':''}.` : '';
  const relevant = weatherSets[weatherView].items;
  const cards = insights(forecast,row).filter(({id})=>relevant.includes(id));
  const descriptions = mode==='detail'?`<details class="technical-explainer"><summary>Interpretar os dados de ${localCaption().toLowerCase()}</summary><div class="insight-grid">${cards.map((item)=>insightCard(item)).join('')}</div></details>`:
    `<div class="insight-grid">${cards.map((item)=>insightCard(item,cards.length===1)).join('')}</div>${actionText('mode:detail',weatherView==='river'?'Abrir série diária':'Abrir gráficos e tabela por hora','arrow-right')}`;
  return `${contextTitle('Condições')}${dates(kind!=='river')}
  ${pills([['weather','Tempo e vento'],forecast.profile.wave?['marine','Ondas e correntes']:['river','Rio'],['pressure','Pressão']],weatherView,'weather')}
  ${riskCard([row])}${kind==='marine'&&!forecast.nearMarine?missingNote(row,forecast):''}${descriptions}
  ${mode==='detail'?`${weatherGraph(forecast)}${weatherTable(forecast)}`:''}
  <p class="fineprint">Previsão de até 7 dias. ${kind==='river'?'A vazão é uma média diária UTC do GloFAS.':'Horário local do ponto.'} Fonte ${sourceLink(urls[kind==='weather'?'forecast':kind],'Open-Meteo')}.${refreshNote}</p>`;
}

function moonScreen() {
  const forecast = guide();
  const sky = forecast.sky;
  const row = referenceRow(forecast);
  const eventLabels = { 'Lua no meridiano':'Passagem superior da Lua','Lua no antimeridiano':'Passagem inferior da Lua','Nascer da Lua':'Nascer da Lua','Pôr da Lua':'Pôr da Lua' };
  const todayEvents = sky.events.map(({major,name,from,to,time})=>[major?'Maior':'Menor',`${from}–${to}`,eventLabels[name] || name,time]);
  const first = `${day.slice(0,7)}-01`;
  const month = mode==='detail'&&moonView==='month'?Array.from({length:31},(_,i)=>plusDay(first,i)).filter((date)=>date.slice(0,7)===day.slice(0,7)):[];
  return `${contextTitle('Sol, Lua e atividade')}${dates(true)}
  <div class="detail-grid sky-grid"><section class="card">${cardHeading('sun',row.lighting || 'Luz do dia')}<div class="trend">${stat('Nascer do Sol',sky.sunUp)}${stat('Pôr do Sol',sky.sunDown)}</div>
  <p class="caption">A luz ajuda a ver ondas e obstáculos. Considere a hora do pôr do sol para o retorno.</p></section>
  <section class="card">${cardHeading('moon',sky.phase?`Lua ${sky.phase.toLowerCase()}`:'Fase da Lua')}<div class="trend">${stat('Nascer da Lua',sky.moonUp)}${stat('Pôr da Lua',sky.moonDown)}${stat('Iluminação',units(sky.illumination,'%',0))}</div>
  <p class="caption">A fase descreve como vemos a parte iluminada. A claridade no ponto também depende das nuvens e do horário em que a Lua está acima do horizonte.</p></section></div>
  <section class="solunar-panel card">${cardHeading('fish','Atividade estimada',`<span class="badge">Sinal solunar</span>`)}
    <p class="caption">${row.lunar?`Neste horário: ${row.lunar.toLowerCase()}. `:''}A tabela marca períodos associados à posição da Lua. O efeito varia por espécie, técnica e local.</p>
    ${mode==='detail'?pills([['day','Tabela do dia'],['month','Tabela do mês']],moonView,'moon-view'):''}
    ${month.length?table(['Dia','Fase','Janelas maiores','Janelas menores'],month.map((date)=>{const s=astroForDay(date);return [prettyDate(date,{day:'numeric',month:'short'}),escape(s.phase),s.events.filter(x=>x.major).map(x=>`${x.from}–${x.to}`).join(' · ')||'—',s.events.filter(x=>!x.major).map(x=>`${x.from}–${x.to}`).join(' · ')||'—'];})):
    `${solunarBars(forecast.hours(day))}${sky.events.length?`<div class="lunar-legend"><span><i class="major"></i>Janela maior</span><span><i class="minor"></i>Janela menor</span></div>`:''}${mode==='detail'?table(['Janela','Horário','Evento','Hora do evento'],todayEvents):sky.events.length?`<ul class="solunar-list">${todayEvents.map(([name,hours,event])=>`<li><span>${statusChip(name==='Maior'?'good':'regular',`Janela ${name.toLowerCase()}`)}<small>${event}</small></span><strong>${hours}</strong></li>`).join('')}</ul>`:''}`}
    <p class="fineprint">Janelas maiores duram cerca de 2 h e menores cerca de 1 h. Escolha a melhor janela do Guia para incluir vento, chuva e as condições do ponto.</p>
    ${actionText('planner','Ver melhores horários','arrow-right')}
  </section>`;
}

function journalScreen() {
  const sorted = [...records].sort((a,b)=>b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return `<div class="section-head context-head"><div><p class="point-region">${escape(place.name)}</p><h1>Diário de pesca</h1></div>${actionText('new-catch','Registrar','plus','primary')}</div>
    <p class="section-intro">Registre o horário, a modalidade e a isca para comparar suas próprias pescarias. Tudo fica salvo neste aparelho.</p>
    ${records.length?`<div class="records">${sorted.map((record)=>`<article class="card record"><span class="record-icon">${marker('fish')}</span><div class="record-body"><h2>${escape(record.species)}${record.quantity>1?` · ${record.quantity}`:''}</h2><p class="caption">${escape(prettyDate(record.date,{day:'2-digit',month:'short',year:'numeric'}))}${record.time?` às ${escape(record.time)}`:''} · ${escape(record.place)}${record.weight?` · ${format(record.weight,2)} kg`:''}</p>${profiles[record.profile]?`<span class="badge">${profiles[record.profile].label}</span>`:''}${record.notes?`<p>${escape(record.notes)}</p>`:''}</div><div class="record-actions">${button(`edit:${record.id}`,'Editar registro','pencil')}${button(`remove:${record.id}`,'Excluir registro','trash-2')}</div></article>`).join('')}</div>`:`<section class="journal-empty card">${marker('book-open')}<h2>Seu histórico começa aqui</h2><p>Guarde as condições que funcionaram no seu ponto.</p>${actionText('new-catch','Registrar primeira captura','plus','secondary')}</section>`}`;
}

function render() {
  const focus = document.activeElement?.dataset.do;
  $('#header').innerHTML = header();
  $('#nav').innerHTML = navBar();
  const strip = $('#screen .hour-strip');
  const stripOffset = strip?.scrollLeft || 0;
  $('#screen').innerHTML = ({home,planner:plannerScreen,tide:tideScreen,weather:weatherScreen,moon:moonScreen,journal:journalScreen})[page]() +
    `<footer class="sources"><span>${page==='journal'?'Armazenamento local':'Horários locais · previsão estimada'}</span>${actionText('about','Fontes e sobre','info')}</footer>`;
  const updatedStrip = $('#screen .hour-strip');
  if (updatedStrip && stripOffset) updatedStrip.scrollLeft=stripOffset;
  if (focus && !$('#dialog').open) document.querySelector(`[data-do="${CSS.escape(focus)}"]`)?.focus({preventScroll:true});
}

function openDialog(title,body) {
  const box = $('#dialog');
  box.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${escape(title)}</h2>${button('close','Fechar','x')}</div>${body}`;
  if (!box.open) box.showModal();
}

function toast(message) {
  const view = $('#toast');
  view.textContent = message; view.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{view.hidden = true;},3300);
}

function placeItems(list) {
  return list.length?list.map((p)=>`<button class="place" type="button" data-do="select:${p.id}">${marker(favorites.includes(p.id)?'star':'map-pin')}<span><strong>${escape(p.name)}</strong><small>${escape(p.region)}</small></span><span class="end">${marker(p.id===place.id?'check':'chevron-right')}</span></button>`).join(''):blank('Nenhum ponto encontrado. Busque uma cidade ou informe as coordenadas.');
}

function showPlaces() {
  const ordered = [...allPlaces()].sort((a,b)=>Number(favorites.includes(b.id))-Number(favorites.includes(a.id)));
  openDialog('Escolher ponto de pesca',`<form id="search" class="field"><label for="query">Ponto ou cidade</label><input id="query" name="query" placeholder="Ex. Salvador ou Santos" type="search" maxlength="65" autocomplete="off">
    <div class="form-actions"><button class="secondary" type="submit">${marker('search')} Buscar cidade</button>${actionText('gps','Usar GPS','locate-fixed','secondary')}${actionText('coords','Coordenadas','map-pin','secondary')}</div></form>
    <p class="form-error" role="status"></p><div id="place-list" class="places">${placeItems(ordered)}</div><div id="search-results" class="places" hidden></div>`);
  $('#query').addEventListener('input',({target})=>{
    const query = normalize(target.value.trim());
    $('#place-list').innerHTML = placeItems(ordered.filter((p)=>normalize(`${p.name} ${p.region}`).includes(query)));
    $('#search-results').hidden = true;
  });
}

function coords() {
  openDialog('Adicionar coordenadas',`<form id="coords"><label class="field">Nome do ponto<input name="name" maxlength="56" placeholder="Meu pesqueiro" required></label>
    <div class="form-pair"><label class="field">Latitude<input name="lat" inputmode="decimal" placeholder="-12,973" required></label><label class="field">Longitude<input name="lon" inputmode="decimal" placeholder="-38,517" required></label></div>
    <p class="form-error" role="status"></p><div class="form-actions"><button class="primary">Salvar ponto</button>${actionText('places','Voltar','chevron-left','secondary')}</div></form>`);
}

function addPlace(name,region,lat,lon,area) {
  const id = `custom-${lat.toFixed(4)}_${lon.toFixed(4)}-${Date.now()}`;
  const chosen = {id,name,region,lat,lon,zone:area || null};
  custom.push(chosen);
  if (!write('places',custom)) toast('O ponto está disponível nesta sessão.');
  selectPlace(chosen);
}

function selectPlace(next) {
  if (!next) return;
  $('#dialog').close();
  place = next;
  write('selected',next.id);
  if (next.id==='saofrancisco') { profileId='river'; write('profile',profileId); }
  page = 'home'; tideMode = 'auto'; tideView = 'day'; weatherView = 'weather'; weatherMetric = ''; day = today(); pickedHour = null;
  window.scrollTo(0,0);
  refresh();
}

function gps() {
  const node = $('.form-error');
  if (!navigator.geolocation || !window.isSecureContext) { node.textContent = 'GPS indisponível. Adicione as coordenadas manualmente.'; return; }
  node.textContent = 'Buscando localização…';
  navigator.geolocation.getCurrentPosition(({coords})=>{
    if (!node.isConnected) return;
    addPlace('Minha localização','Ponto por GPS',coords.latitude,coords.longitude);
  },()=>{ if (node.isConnected) node.textContent = 'Não foi possível obter o GPS. Verifique a permissão ou informe as coordenadas.'; },{timeout:22000,maximumAge:90000,enableHighAccuracy:true});
}

async function geocode(form) {
  const query = new FormData(form).get('query').trim();
  const info = $('.form-error');
  if (query.length < 3) { info.textContent = 'Digite pelo menos 3 caracteres.'; return; }
  info.textContent = 'Buscando cidades…';
  const field = $('#query');
  try {
    const options = new URLSearchParams({name:query,count:'12',language:'pt',countryCode:'BR'});
    const cities = (await requestJson(`https://geocoding-api.open-meteo.com/v1/search?${options}`)).results || [];
    if (!info.isConnected || field.value.trim() !== query) return;
    info.textContent = cities.length ? '' : 'Nenhuma cidade encontrada.';
    const panel = $('#search-results');
    panel.hidden = !cities.length;
    panel.innerHTML = cities.map(({name,admin1})=>`<button type="button" class="place">${marker('map-pin')}<span><strong>${escape(name)}</strong><small>${escape(admin1 || 'Brasil')}</small></span></button>`).join('');
    [...panel.children].forEach((element,i)=>{
      const city = cities[i];
      element.addEventListener('click',()=>addPlace(city.name,city.admin1 || 'Brasil',city.latitude,city.longitude,city.timezone));
    });
  } catch { if (info.isConnected && field.value.trim() === query) info.textContent = 'Busca indisponível. Tente de novo ou informe as coordenadas.'; }
}

function catchForm(record) {
  const entry = record || {date:day,place:place.name,quantity:1,profile:profileId,time:day===today()?clock().slice(11):''};
  openDialog(record?'Editar registro':'Registrar captura',`<form id="catch" data-id="${escape(entry.id)}"><label class="field">Espécie<input name="species" value="${escape(entry.species)}" maxlength="60" placeholder="Ex. Robalo" required></label>
    <div class="form-pair"><label class="field">Data<input name="date" type="date" min="1900-01-01" max="2100-12-31" value="${entry.date}" required></label><label class="field">Local<input name="place" maxlength="70" value="${escape(entry.place)}" required></label></div>
    <div class="form-pair"><label class="field">Horário<input name="time" type="time" value="${escape(entry.time)}"></label><label class="field">Modalidade<select name="profile"><option value="">Sem modalidade</option>${Object.entries(profiles).map(([id,p])=>`<option value="${id}" ${id===entry.profile?'selected':''}>${p.label}</option>`).join('')}</select></label></div>
    <div class="form-pair"><label class="field">Quantidade<input name="quantity" type="number" min="1" max="999" step="1" value="${entry.quantity}" required></label><label class="field">Peso total em kg <input name="weight" inputmode="decimal" placeholder="Opcional" value="${entry.weight?String(entry.weight).replace('.',','):''}"></label></div>
    <label class="field">Anotações<textarea name="notes" maxlength="500" rows="3" placeholder="Isca, técnica ou condições">${escape(entry.notes)}</textarea></label><p class="form-error" role="status"></p><div class="form-actions"><button class="primary">Salvar registro</button></div></form>`);
}

function about() {
  const stationLinks = spots.filter(({id})=>officialStations[id]).map(({id,name})=>sourceLink(chmSource(id),name)).join(', ');
  openDialog('Fontes e sobre',`<div class="info-list"><div><strong>Maré de Linha · 2.0</strong><p>App de pesca gratuito, sem anúncios, login ou assinatura. GPS e busca são opcionais. Os serviços de previsão recebem as coordenadas do ponto consultado. Favoritos e capturas são armazenados no aparelho.</p></div>
  <div><strong>Maré oficial</strong><p>Tábuas CHM / DHN de 2026 incluídas para ${stationLinks}. Confira também as tábuas brasileiras de ${sourceLink(urls.chm2026,'2026')} e ${sourceLink(urls.chm2027,'2027')}.</p></div>
  <div><strong>Tempo e mar</strong><p>${sourceLink(urls.forecast,'Open-Meteo Forecast API')} e ${sourceLink(urls.marine,'Marine API')}, com modelos de Météo-France, DWD, NOAA e ECMWF. O acesso gratuito da API é para uso não comercial e sujeito a limites.</p></div>
  <div><strong>Rios</strong><p>${sourceLink(urls.river,'GloFAS via Open-Meteo')}. Vazão média diária do maior rio na região do ponto, em UTC. Confira se é o rio e o trecho que você pretende pescar.</p></div>
  <div><strong>Sol, Lua e pesca</strong><p>Posições calculadas localmente com ${sourceLink(urls.astronomy,'Astronomy Engine')}. Janelas maiores de ±60 min em torno dos trânsitos lunares e menores de ±30 min no nascer e no pôr.</p></div>
  <div><strong>Precisão</strong><p>Previsões de modelos oceânicos têm resolução limitada perto da costa. Consulte os ${sourceLink(urls.alerts,'avisos oficiais da Marinha')} e as tábuas da estação antes de navegar.</p></div>
  ${actionText('method','Como avaliamos','info')}${actionText('licenses','Licenças de componentes','info')}</div>`);
}

async function licenses() {
  openDialog('Licenças de componentes','<div id="license-text" class="fineprint">Carregando…</div>');
  const content = $('#license-text');
  try {
    const result = await fetch('static/licencas.txt');
    if (!result.ok) throw Error('Licenças indisponíveis');
    content.textContent = await result.text();
  } catch { content.textContent = 'Consulte as licenças no código-fonte do aplicativo.'; }
}

const setDay = (date) => { if (date >= '1900-01-01' && date <= '2100-12-31') { day = date; pickedHour = null; } render(); };
function go(target) { page = target; window.scrollTo(0,0); render(); $('#screen').focus({preventScroll:true}); }
function toggleFavorite() {
  const exists = favorites.includes(place.id);
  favorites = exists?favorites.filter((id)=>id!==place.id):[...favorites,place.id];
  const saved = write('favorites',favorites);
  render(); toast(saved ? (exists?'Ponto removido dos favoritos.':'Ponto salvo nos favoritos.') : 'Favoritos disponíveis nesta sessão.');
}

const actions = {
  page:go, today:()=>setDay(today()), prev:()=>setDay(plusDay(day,-1)), next:()=>setDay(plusDay(day,1)),
  'tide-mode':(value)=>{tideMode=value;render();}, 'tide-view':(value)=>{tideView=value;render();},
  'moon-view':(value)=>{moonView=value;render();}, 'weather-metric':(value)=>{weatherMetric=value;render();},
  weather:(value)=>{weatherView=value;weatherMetric='';page==='weather'?render():go('weather');}, refresh:()=>{if (!loading) refresh();},
  mode:(value)=>{mode=value;write('mode',mode);render();},
  profiles:()=>openDialog('Como você vai pescar?',profileOptions(profileId)),
  profile:(value)=>{
    const changedSource=(profileId==='river')!==(value==='river');
    profileId=value;write('profile',value);
    if (weatherView==='river' || weatherView==='marine') weatherView=value==='river'?'river':'marine';
    $('#dialog').close();
    if (changedSource) refresh(); else render();
  },
  planner:()=>go('planner'),
  'plan-day':(date)=>{
    day=date;pickedHour=null;
    if(page==='planner') {
      render(); $('#plan-detail').focus({preventScroll:true}); $('#plan-detail').scrollIntoView({block:'start'});
    } else go('planner');
  },
  'week-overview':()=>$('#week-overview')?.scrollIntoView({block:'start'}),
  method:()=>{const forecast=guide();openDialog('Como avaliamos',methodology(forecast,referenceRow(forecast)));},
  hour:(stamp)=>{const row=guide().rows.get(stamp);if(row)openDialog(`${dateName(stamp.slice(0,10),today())} · ${stamp.slice(11)}`,hourDetail(row,mode==='detail'));},
  'conditions-hour':(stamp)=>{day=stamp.slice(0,10);pickedHour=stamp.slice(11,13);$('#dialog').close();weatherView='weather';go('weather');},
  date:()=>openDialog('Escolher data',`<form id="date"><label class="field">Data<input name="day" type="date" min="1900-01-01" max="2100-12-31" value="${day}" required></label><div class="form-actions"><button class="primary">Exibir dia</button>${actionText('date-today','Voltar para hoje','calendar-days','secondary')}</div></form>`),
  'date-today':()=>{$('#dialog').close();setDay(today());},
  'choose-hour':()=>openDialog('Horário da previsão',`<p class="caption">Escolha a hora que deseja interpretar.</p><div class="hour-choices">${guide().hours(day).map((row)=>actionText(`pick-hour:${row.time.slice(11,13)}`,row.time.slice(11),'','secondary')).join('')}</div>`),
  'pick-hour':(hour)=>{pickedHour=hour;$('#dialog').close();render();},
  places:showPlaces, coords, gps, select:(id)=>selectPlace(allPlaces().find((p)=>p.id===id)), favorite:toggleFavorite,
  about, licenses, close:()=>$('#dialog').close(), 'new-catch':()=>catchForm(), edit:(id)=>catchForm(records.find((item)=>item.id===id)),
  remove:(id)=>openDialog('Excluir registro?',`<p>O registro será removido deste aparelho.</p><div class="form-actions">${actionText('close','Cancelar','','secondary')}${actionText(`confirm-remove:${id}`,'Excluir','trash-2','primary danger')}</div>`),
  'confirm-remove':(id)=>{const remaining=records.filter((item)=>item.id!==id);if(!write('catches',remaining)){toast('Não foi possível excluir o registro.');return;}records=remaining;$('#dialog').close();render();toast('Registro excluído.');},
};

document.addEventListener('click',(event)=>{
  const control = event.target.closest('[data-do]');
  if (!control) return;
  const [name,...value] = control.dataset.do.split(':');
  actions[name]?.(value.join(':'));
});

const number = (raw) => raw.trim() ? Number(raw.trim().replace(',','.')) : NaN;
document.addEventListener('submit',(event)=>{
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  if (form.id === 'search') { geocode(form); return; }
  if (form.id === 'date') { $('#dialog').close(); setDay(data.day); return; }
  if (form.id === 'coords') {
    const lat = number(data.lat), lon = number(data.lon);
    if (!data.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) {
      $('.form-error').textContent = 'Informe um nome, latitude de −90 a 90 e longitude de −180 a 180.'; return;
    }
    addPlace(data.name.trim(),'Ponto por coordenadas',lat,lon); return;
  }
  if (form.id === 'catch') {
    const weight = data.weight.trim() ? number(data.weight) : 0;
    if (!data.species.trim() || !data.place.trim() || !Number.isFinite(weight) || weight < 0 || weight > 99999) {
      $('.form-error').textContent = 'Preencha espécie e local e informe um peso válido.'; return;
    }
    const id = form.dataset.id || globalThis.crypto.randomUUID();
    const record = {id,species:data.species.trim(),date:data.date,place:data.place.trim(),quantity:Number(data.quantity),weight,notes:data.notes.trim(),
      time:data.time,profile:data.profile};
    const updated = [...records.filter((item)=>item.id!==id),record];
    if (!write('catches',updated)) { $('.form-error').textContent = 'O aparelho não conseguiu salvar o registro.'; return; }
    records = updated;
    $('#dialog').close();render();toast('Registro salvo.');
  }
});
window.addEventListener('online',()=>{if(!loading) refresh();});
document.addEventListener('visibilitychange',()=>{
  if (document.hidden || loading) return;
  const observed=cached[place.id]?.weather?.stamp || 0;
  if (Date.now()-observed>30*60*1000) refresh(); else render();
});
window.addEventListener('mare-back',(event)=>{if($('#dialog').open) $('#dialog').close();else if(page!=='home') go('home');else return;event.preventDefault();});
refresh();
