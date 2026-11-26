import { Body, Observer, Illumination, MoonPhase, SearchRiseSet, SearchHourAngle } from 'astronomy-engine';
import officialSalvador from './salvador-2026.json';
import officialAratu from './aratu-2026.json';
import officialMadreDeus from './madredeus-2026.json';
import officialIlheus from './ilheus-2026.json';
import officialRecife from './recife-2026.json';

const BAHIA = 'America/Bahia';
const BRAZIL = 'America/Sao_Paulo';
export const spots = [
  ['salvador', 'Porto de Salvador', 'Salvador, BA', -12.9733, -38.5167, BAHIA],
  ['barra', 'Farol da Barra', 'Salvador, BA', -13.010, -38.532, BAHIA],
  ['itapua', 'Praia de Itapuã', 'Salvador, BA', -12.957, -38.355, BAHIA],
  ['morro', 'Morro de São Paulo', 'Cairu, BA', -13.375, -38.909, BAHIA],
  ['aratu', 'Porto de Aratu', 'Candeias, BA', -12.795, -38.495, BAHIA],
  ['madredeus', 'Porto de Madre de Deus', 'Madre de Deus, BA', -12.750, -38.6233, BAHIA],
  ['ilheus', 'Porto de Ilhéus', 'Ilhéus, BA', -14.780, -39.0267, BAHIA],
  ['portoseguro', 'Praia de Porto Seguro', 'Porto Seguro, BA', -16.429, -39.044, BAHIA],
  ['maceio', 'Porto de Maceió', 'Maceió, AL', -9.680, -35.730, 'America/Maceio'],
  ['recife', 'Porto do Recife', 'Recife, PE', -8.0567, -34.8667, 'America/Recife'],
  ['natal', 'Porto de Natal', 'Natal, RN', -5.768, -35.202, 'America/Fortaleza'],
  ['fortaleza', 'Porto do Mucuripe', 'Fortaleza, CE', -3.714, -38.475, 'America/Fortaleza'],
  ['saoluis', 'Porto do Itaqui', 'São Luís, MA', -2.573, -44.371, 'America/Fortaleza'],
  ['belem', 'Porto de Belém', 'Belém, PA', -1.424, -48.499, 'America/Belem'],
  ['vitoria', 'Porto de Vitória', 'Vitória, ES', -20.319, -40.340, BRAZIL],
  ['rio', 'Ilha Fiscal', 'Rio de Janeiro, RJ', -22.896, -43.166, BRAZIL],
  ['angra', 'Porto de Angra dos Reis', 'Angra dos Reis, RJ', -23.009, -44.320, BRAZIL],
  ['santos', 'Porto de Santos', 'Santos, SP', -23.950, -46.307, BRAZIL],
  ['paranagua', 'Porto de Paranaguá', 'Paranaguá, PR', -25.501, -48.514, BRAZIL],
  ['florianopolis', 'Porto de Florianópolis', 'Florianópolis, SC', -27.599, -48.562, BRAZIL],
  ['riogrande', 'Barra do Rio Grande', 'Rio Grande, RS', -32.145, -52.096, BRAZIL],
  ['saofrancisco', 'Rio São Francisco', 'Petrolina, PE', -9.422, -40.505, 'America/Recife'],
].map(([id, name, region, lat, lon, zone]) => ({id, name, region, lat, lon, zone}));

export const urls = {
  chm2026:'https://www.marinha.mil.br/chm/tabuas-de-mare-6',
  chm2027:'https://www.marinha.mil.br/chm/tabuas-de-mare-2027',
  marine:'https://open-meteo.com/en/docs/marine-weather-api',
  forecast:'https://open-meteo.com/en/docs',
  astronomy:'https://github.com/cosinekitty/astronomy',
  river:'https://open-meteo.com/en/docs/flood-api',
  alerts:'https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo',
};

const chmFiles = 'https://www.marinha.mil.br/chm/sites/www.marinha.mil.br.chm/files/dados_de_mare/';
export const officialStations = {
  salvador:{table:officialSalvador,file:'31 - PORTO DE SALVADOR - 103 - 105.pdf'},
  aratu:{table:officialAratu,file:'30 - PORTO DE ARATU - BASE NAVAL 100 - 102.pdf'},
  madredeus:{table:officialMadreDeus,file:'29 - PORTO DE MADRE DE DEUS - 97 - 99.pdf'},
  ilheus:{table:officialIlheus,file:'32 - PORTO DE ILHÉUS - MALHADO - 106 - 108.pdf'},
  recife:{table:officialRecife,file:'24 - PORTO DO RECIFE - 82 - 84.pdf'},
};
export const chmSource = (id) => `${chmFiles}${encodeURIComponent(officialStations[id].file)}`;

export const weatherFields = 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,cloud_cover,visibility,surface_pressure,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m';
export const marineFields = 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_level_height_msl,sea_surface_temperature,ocean_current_velocity,ocean_current_direction';
const df = new Map();
const two = (n) => String(n).padStart(2,'0');
export const minuteLabel = (n) => `${two(Math.floor(((n + 1440) % 1440) / 60))}:${two((n + 1440) % 60)}`;
export const plusDay = (day, count) => new Date(Date.parse(`${day}T12:00:00Z`) + count * 86400000).toISOString().slice(0,10);
export const prettyDate = (day, options) => new Intl.DateTimeFormat('pt-BR', {...options,timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));

export function localStamp(date, zone) {
  if (!df.has(zone)) df.set(zone, new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
  return df.get(zone).format(date).replace(' ','T');
}

function localMidnight(day, zone) {
  const target = Date.parse(`${day}T00:00:00Z`);
  let stamp = target;
  for (let pass = 0; pass < 3; pass++) {
    const current = Date.parse(`${localStamp(new Date(stamp),zone)}:00Z`);
    if (target === current) break;
    stamp += target - current;
  }
  return new Date(stamp);
}

export const clockMinute = (clock) => Number(clock.slice(0,2)) * 60 + Number(clock.slice(3,5));
export const format = (n, digits = 1) => Number.isFinite(n) ? n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits}) : '—';
export const compass = (degrees) => Number.isFinite(degrees) ? ['N','NE','L','SE','S','SO','O','NO'][Math.round(degrees / 45) % 8] : '—';
export function condition(code) {
  if (!Number.isFinite(code)) return 'Sem previsão';
  if (code === 0) return 'Céu limpo';
  if (code <= 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  if (code <= 48) return 'Nevoeiro';
  if (code <= 57) return 'Garoa';
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return 'Neve';
  if (code < 95) return 'Chuva';
  return 'Trovoadas';
}

export async function requestJson(url) {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 11000);
  try {
    const response = await fetch(url,{signal:abort.signal});
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

export function forecastRequest(place, marine) {
  const qs = new URLSearchParams({latitude:place.lat,longitude:place.lon,timezone:place.zone || 'auto',
    hourly:marine ? marineFields : weatherFields,forecast_days:'7',past_days:'1'});
  if (marine) qs.set('cell_selection','sea');
  return requestJson(`https://${marine?'marine-api':'api'}.open-meteo.com/v1/${marine?'marine':'forecast'}?${qs}`);
}

export function riverRequest(place) {
  const qs = new URLSearchParams({latitude:place.lat,longitude:place.lon,daily:'river_discharge',forecast_days:'7',past_days:'2'});
  return requestJson(`https://flood-api.open-meteo.com/v1/flood?${qs}`);
}

export function riverRows(response) {
  return response?.daily?.time?.map((time,i)=>({time,value:response.daily.river_discharge?.[i]})) || [];
}

export function forecastRows(response) {
  if (!response?.hourly?.time?.length) return [];
  const columns = Object.entries(response.hourly).filter(([name]) => name !== 'time');
  return response.hourly.time.map((time,i) => ({time,...Object.fromEntries(columns.map(([key,values]) => [key,values[i]]))}));
}

function officialPoints(day, table) {
  return [-1,0,1].flatMap((offset) => (table[plusDay(day,offset)] || [])
    .map(([minute,value]) => ({minute:offset * 1440 + minute,value})));
}

function findExtrema(points, interpolate = false) {
  return points.flatMap((point,i) => {
    const a = points[i-1], b = points[i+1];
    if (![point?.value,a?.value,b?.value].every(Number.isFinite)) return [];
    const before = point.value - a.value, after = point.value - b.value;
    const type = before >= 0 && after > 0 ? 'high' : before <= 0 && after < 0 ? 'low' : '';
    if (!type) return [];
    const correction = interpolate && point.minute - a.minute === 60 && b.minute - point.minute === 60
      ? Math.max(-30,Math.min(30,30 * (a.value - b.value)/(a.value - 2 * point.value + b.value))) : 0;
    return [{type,minute:point.minute + Math.round(correction),value:point.value + (b.value-a.value) * correction / 240}];
  }).filter(({minute}) => minute >= 0 && minute < 1440);
}

export function tides(place, day, marine, source) {
  const table = officialStations[place.id]?.table;
  if (source !== 'model' && table?.[day]) {
    const timeline = officialPoints(day,table);
    const classified = new Map(findExtrema(timeline).map(({minute,type}) => [minute,type]));
    const last = timeline.length - 1;
    const items = timeline.flatMap(({minute,value},i) => {
      if (minute < 0 || minute >= 1440) return [];
      const neighbor = i === 0 ? timeline[1] : i === last ? timeline[i-1] : null;
      const type = classified.get(minute) || (neighbor ? (value > neighbor.value ? 'high' : 'low') : 'turn');
      return [{minute,value,type}];
    });
    const points = [];
    for (let minute = 0, i = 0; minute <= 1440; minute += 10) {
      while (i + 1 < timeline.length && timeline[i+1].minute < minute) i++;
      const a = timeline[i], b = timeline[i+1];
      if (!a || !b || minute < a.minute || b.minute-a.minute > 570) continue;
      const fraction = (minute-a.minute)/(b.minute-a.minute);
      points.push({minute,value:a.value + (b.value-a.value)*(1-Math.cos(Math.PI*fraction))/2});
    }
    return {official:true,items,points,datum:'nível de redução (NR)'};
  }
  const points = [-1,0,1].flatMap((offset) => marine.filter(({time}) => time.startsWith(plusDay(day,offset)))
    .map((r) => ({minute:offset * 1440 + clockMinute(r.time.slice(11,16)),value:r.sea_level_height_msl})));
  return {official:false,items:findExtrema(points,true),points:points.filter(({minute}) => minute >= 0 && minute <= 1440),datum:'nível médio global'};
}

const phaseNames = ['Nova','Crescente','Quarto crescente','Gibosa crescente','Cheia','Gibosa minguante','Quarto minguante','Minguante'];
export function astronomy(place, day, zone) {
  const start = localMidnight(day,zone);
  const end = localMidnight(plusDay(day,1),zone);
  const length = (end - start) / 86400000;
  const noon = new Date((+start + +end)/2);
  const observer = new Observer(place.lat,place.lon,0);
  const sunUp = SearchRiseSet(Body.Sun,observer,+1,start,length)?.date;
  const sunDown = SearchRiseSet(Body.Sun,observer,-1,start,length)?.date;
  const moonUp = SearchRiseSet(Body.Moon,observer,+1,start,length)?.date;
  const moonDown = SearchRiseSet(Body.Moon,observer,-1,start,length)?.date;
  const events = [
    ['Lua no meridiano',SearchHourAngle(Body.Moon,observer,0,start).time.date,60],
    ['Lua no antimeridiano',SearchHourAngle(Body.Moon,observer,12,start).time.date,60],
    ['Nascer da Lua',moonUp,30],['Pôr da Lua',moonDown,30],
  ].filter(([,date]) => date >= start && date < end).sort((a,b) => a[1]-b[1]);
  const phase = phaseNames[Math.round(MoonPhase(noon)/45)%8];
  const illumination = Illumination(Body.Moon,noon).phase_fraction * 100;
  const hour = (date) => date ? localStamp(date,zone).slice(11,16) : '—';
  return {phase,illumination,sunUp:hour(sunUp),sunDown:hour(sunDown),moonUp:hour(moonUp),moonDown:hour(moonDown),
    events:events.map(([name,date,radius]) => ({name, major:radius === 60, time:hour(date),
      from:hour(new Date(+date - radius*60000)),to:hour(new Date(+date + radius*60000))}))};
}
