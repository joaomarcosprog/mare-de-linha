import { astronomy, clockMinute, format, minuteLabel, plusDay, tides } from './data.js';

// Limites editoriais de planejamento. Não são limites operacionais nem avisos oficiais.
export const profiles = {
  beach: {label:'Praia', icon:'umbrella', note:'Arremesso da areia e atenção ao avanço da água.',
    wind:[15,25,38], gust:48, wave:[.8,1.35,2.3], current:.9, weights:{wind:23,rain:19,waves:27,tide:10,light:15,lunar:6}},
  offshore: {label:'Alto-mar', icon:'ship', note:'Exposição ao vento, à ondulação e à perda de visibilidade.',
    wind:[14,23,34], gust:45, wave:[.85,1.45,2.3], current:1.3, boat:true, weights:{wind:24,rain:13,waves:32,current:12,visibility:13,lunar:6}},
  rocks: {label:'Costão e pedras', icon:'mountain', note:'A ondulação e a subida da água têm mais peso.',
    wind:[12,21,32], gust:42, wave:[.5,.9,1.5], current:.7, longSwell:true, weights:{wind:12,rain:17,waves:33,tide:18,light:15,lunar:5}},
  river: {label:'Rio', icon:'waves', note:'Tempo na margem e tendência regional da vazão, quando disponível.',
    wind:[15,26,38], gust:48, weights:{wind:22,rain:38,light:22,river:12,lunar:6}},
  mangrove: {label:'Manguezal', icon:'trees', note:'A maré pesa mais porque pode mudar o acesso à margem e aos canais.',
    wind:[14,24,35], gust:46, wave:[.8,1.3,2.1], current:.75, shallow:true, weights:{wind:13,rain:20,waves:9,current:15,tide:26,light:12,lunar:5}},
  estuary: {label:'Estuário', icon:'route', note:'Movimento da maré e força da corrente orientam a avaliação.',
    wind:[13,22,34], gust:45, wave:[.65,1.1,1.8], current:.85, shallow:true, weights:{wind:15,rain:16,waves:12,current:21,tide:21,light:10,lunar:5}},
  boat: {label:'Embarcada', icon:'sailboat', note:'Planejamento conservador para embarcação de pequeno porte.',
    wind:[12,20,31], gust:41, wave:[.65,1.15,1.8], current:1.1, boat:true, weights:{wind:25,rain:12,waves:29,current:13,visibility:10,light:6,lunar:5}},
};

export const levels = {
  excellent:{label:'Excelente para pesca',short:'Excelente',icon:'sparkles',rank:5},
  good:{label:'Bom para pesca',short:'Bom',icon:'circle-check',rank:4},
  regular:{label:'Condições regulares',short:'Regular',icon:'minus',rank:3},
  weak:{label:'Pouco favorável',short:'Pouco favorável',icon:'trending-down',rank:2},
  poor:{label:'Desfavorável',short:'Desfavorável',icon:'circle-x',rank:1},
  risk:{label:'Risco potencial',short:'Risco',icon:'triangle-alert',rank:0},
  unknown:{label:'Dados insuficientes',short:'Sem leitura',icon:'circle-help',rank:0},
  neutral:{label:'Depende do ponto',short:'Contexto',icon:'info',rank:0},
};

export function grade(score) {
  if (!Number.isFinite(score)) return 'unknown';
  if (score >= 88) return 'excellent';
  if (score >= 74) return 'good';
  if (score >= 60) return 'regular';
  if (score >= 42) return 'weak';
  return 'poor';
}

const finite = Number.isFinite;
const hourStart = (stamp) => `${stamp.slice(0,13)}:00`;
export const shiftHours = (stamp, n) => new Date(Date.parse(`${stamp}:00Z`) + n * 3600000).toISOString().slice(0,16);
const limitAge = 8 * 3600000;
const factor = (value, label, text) => ({value,label,text});
const round = (value) => Math.round(value);
const scale = (value, low, high) => !finite(value) ? null : value <= low ? 94 : value <= high ? 70 : 34;

function directionToNext(points, minute) {
  const a = points.reduce((best,p) => p.minute <= minute && finite(p.value) ? p : best,null);
  const b = points.find((p) => p.minute >= minute + 25 && finite(p.value));
  if (!a || !b || minute-a.minute > 60 || b.minute-minute > 90) return null;
  const change = (b.value-a.value)*60/(b.minute-a.minute);
  return {name:change >= .055?'Enchendo':change <= -.055?'Vazando':'Pouca variação', change, height:a.value};
}

function sunlight(sky, minute) {
  const up = clockMinute(sky.sunUp || '—');
  const down = clockMinute(sky.sunDown || '—');
  if (![up,down].every(finite)) return null;
  if (Math.min(Math.abs(minute-up),Math.abs(minute-down)) <= 40) return 'Luz de transição';
  return (up < down ? minute > up && minute < down : minute > up || minute < down) ? 'Com luz do dia' : 'À noite';
}

function solunarSignal(events, minute) {
  const hits = events.filter(({start,end}) => start <= minute && minute < end);
  if (hits.some(({major}) => major)) return 'Janela maior';
  if (hits.length) return 'Janela menor';
  return 'Fora das janelas';
}

function riverTrend(row, previous, next) {
  if (!finite(row?.value)) return null;
  const base = finite(previous?.value) && previous.value > 0 ? previous.value : null;
  const ratio = base ? (row.value-base)/base : null;
  const later = finite(next?.value) && row.value > 0 ? (next.value-row.value)/row.value : null;
  return {value:row.value, ratio, later};
}

function marineDistance(place, marine) {
  if (!finite(marine?.latitude) || !finite(marine?.longitude)) return null;
  const rad = Math.PI / 180;
  const a = Math.sin((marine.latitude-place.lat)*rad/2)**2
    + Math.cos(marine.latitude*rad)*Math.cos(place.lat*rad)*Math.sin((marine.longitude-place.lon)*rad/2)**2;
  return 12742*Math.asin(Math.sqrt(Math.min(1,a)));
}

const latest = (entry, now) => Boolean(entry?.stamp > 0 && now-entry.stamp <= limitAge);
const weatherStatus = (w) => {
  if (w.weather_code >= 95) return 'Trovoadas previstas';
  if (w.precipitation >= 5) return 'Chuva em volume elevado';
  if (w.precipitation >= 1 || w.precipitation_probability >= 65) return 'Chuva provável';
  if (finite(w.precipitation_probability) && w.precipitation_probability < 35 && !(w.precipitation >= .4)) return 'Pouca chance de chuva';
  return 'Pode chover';
};

function warningSignals(profile, w, m) {
  const hazards = [];
  if (w.weather_code >= 95) hazards.push({code:'storm',label:'Trovoadas previstas',text:'Adie a saída em área aberta e procure abrigo se ouvir trovão.'});
  if (w.wind_speed_10m >= profile.wind[2] || w.wind_gusts_10m >= profile.gust) hazards.push({code:'wind',label:'Vento forte ou rajadas',text:profile.boat?'O vento pode dificultar a manobra e o retorno com embarcação pequena.':'As rajadas podem reduzir o controle da linha e o equilíbrio em áreas expostas.'});
  if (profile.wave && m.wave_height >= profile.wave[2]) hazards.push({code:'wave',label:'Ondas elevadas para a modalidade',text:'A altura prevista representa o mar do modelo. Observe o local e consulte o boletim oficial.'});
  const longWave = [m.wave_period,m.swell_wave_period].filter(finite);
  if (profile.longSwell && ((m.wave_height >= .8 && m.wave_period >= 11) || (m.swell_wave_height >= .7 && m.swell_wave_period >= 11))) {
    hazards.push({code:'swell',label:'Séries mais espaçadas no costão',text:'A água pode avançar sobre pedras aparentemente secas. Mantenha distância da zona atingida pelas ondas.'});
  }
  if (profile.boat && finite(w.visibility) && w.visibility < 1000) hazards.push({code:'visibility',label:'Visibilidade muito baixa',text:'Reconhecer obstáculos e outras embarcações fica mais difícil.'});
  if (!profile.wave && w.precipitation >= 12) hazards.push({code:'rain',label:'Chuva volumosa prevista no rio',text:'O nível também depende da chuva a montante e de represas. Confira as condições locais antes de se aproximar da água.'});
  return {hazards,longWave};
}

export function evaluateHour(profile, {weather:w={},marine:m={},tide=null,sky={},solunar=[],river=null,minute,trust}) {
  const lighting = sunlight(sky,minute);
  const lunar = sky.phase ? solunarSignal(solunar,minute) : null;
  const {hazards,longWave} = warningSignals(profile,w,m);
  const windBase = scale(w.wind_speed_10m,...profile.wind);
  const wind = windBase === null ? null : finite(w.wind_gusts_10m) && w.wind_gusts_10m >= profile.gust-9 ? Math.min(windBase,46) : windBase;
  const windLabel = wind === null ? 'Vento sem dados' : wind >= 88 ? 'Vento leve' : wind >= 60 ? 'Vento perceptível' : 'Vento atrapalha';
  const rain = !finite(w.precipitation) && !finite(w.precipitation_probability) ? null
    : w.precipitation >= 5 ? 26 : w.precipitation >= 1 || w.precipitation_probability >= 65 ? 52
      : w.precipitation_probability >= 35 || w.precipitation >= .4 ? 73 : 93;
  const rainLabel = rain === null ? 'Chuva sem previsão' : weatherStatus(w);
  const waveBase = profile.wave ? scale(m.wave_height,...profile.wave) : null;
  const wave = waveBase === null ? null : profile.longSwell && Math.max(...longWave) >= 10 && m.wave_height >= .55 ? Math.min(waveBase,48) : waveBase;
  const current = profile.current ? scale(m.ocean_current_velocity,profile.current,profile.current*1.75) : null;
  const tideValue = tide ? profile.longSwell && tide.change >= .16 ? 45 : profile.shallow ? Math.abs(tide.change) >= .055 ? 84 : 62 : Math.abs(tide.change) >= .055 ? 86 : 72 : null;
  const vis = finite(w.visibility) ? w.visibility >= 6000 ? 95 : w.visibility >= 3000 ? 70 : 35 : null;
  const light = lighting === 'Com luz do dia' ? 95 : lighting === 'Luz de transição' ? 76 : lighting === 'À noite' ? 44 : null;
  const lunarValue = lunar === 'Janela maior' ? 96 : lunar === 'Janela menor' ? 86 : lunar ? 70 : null;
  const riverValue = finite(river?.ratio) ? river.ratio >= .15 ? 42 : river.ratio <= -.15 ? 67 : 85 : null;
  const factors = {
    wind:factor(wind,windLabel,wind === null ? 'A previsão de vento está ausente.' : 'Vento e rajadas afetam os arremessos, a linha e a exposição do ponto.'),
    rain:factor(rain,rainLabel,'Considere a chance e o volume de chuva para planejar a permanência no ponto.'),
    waves:factor(wave,wave === null?'Ondas sem dados':wave>=88?'Ondas mais baixas':wave>=60?'Mar mais mexido':'Ondas pesam contra','Séries maiores podem alcançar mais longe na praia e nas pedras.'),
    current:factor(current,current === null?'Corrente sem dados':current>=88?'Corrente modelada mais fraca':current>=60?'Corrente moderada':'Corrente modelada mais forte','A corrente desloca a linha e a isca. Canais rasos podem responder de outra forma.'),
    tide:factor(tideValue,tide?.name || 'Maré sem leitura',profile.longSwell?'A subida da água pode reduzir a faixa disponível no costão.':'A variação de nível muda profundidade e acesso ao ponto.'),
    light:factor(light,lighting || 'Luz sem leitura','A luz ajuda a enxergar a margem, as ondas e o caminho de volta.'),
    visibility:factor(vis,vis === null?'Visibilidade sem dados':vis>=88?'Boa visibilidade prevista':vis>=60?'Visibilidade reduzida':'Visibilidade muito reduzida','Com menor alcance visual, fica mais difícil identificar outros barcos e obstáculos.'),
    lunar:factor(lunarValue,lunar || 'Lua sem leitura','Janela da teoria solunar, com peso baixo e efeito variável por espécie.'),
    river:factor(riverValue,riverValue===null?'Vazão local desconhecida':river.ratio>=.15?'Vazão regional em alta':river.ratio<=-.15?'Vazão regional em baixa':'Vazão regional pouco variável','O modelo diário estima a vazão do maior rio próximo. Confira se representa o seu trecho.'),
  };
  const weighted = Object.entries(profile.weights).map(([id,weight])=>({id,weight,...factors[id]}));
  const known = weighted.filter(({value,id}) => finite(value) && (id === 'light' || id === 'lunar' || trust[id] !== false));
  const weight = known.reduce((sum,item)=>sum+item.weight,0);
  const missing = [];
  if (!trust.weather) missing.push('previsão de tempo recente');
  else {
    if (!finite(w.wind_speed_10m) || !finite(w.wind_gusts_10m)) missing.push('vento e rajadas');
    if (!finite(w.weather_code) || rain === null) missing.push('chuva e trovoadas');
  }
  if (profile.wave && (!trust.marine || !finite(m.wave_height))) missing.push('previsão de ondas no ponto');
  else if (profile.longSwell && !longWave.length) missing.push('período das ondas');
  if (profile.boat && !finite(w.visibility)) missing.push('visibilidade');
  if (weight < 67 && !missing.length) missing.push('cobertura dos fatores desta modalidade');
  const score = missing.length || hazards.length ? null : round(known.reduce((sum,item)=>sum+item.weight*item.value,0)/weight);
  return {score,state:hazards.length?'risk':grade(score),hazards,missing,coverage:weight,factors,known,lighting,lunar,tide,river,weather:w,marine:m};
}

const byTime = (list) => new Map(list.map((item)=>[item.time,item]));

export function guideForecast({place,zone,profileId,weather,marine,river,weatherEntry,marineEntry,riverEntry,now,current,selected}) {
  const profile = profiles[profileId];
  const marineGridDistance = marineDistance(place,marineEntry?.data);
  const nearMarine = marineGridDistance === null || marineGridDistance <= (profileId === 'offshore'?40:25);
  const w = byTime(weather);
  const m = byTime(nearMarine ? marine : []);
  const r = byTime(river);
  const currentDate = current.slice(0,10);
  const calendar = Array.from({length:7},(_,i)=>plusDay(currentDate,i));
  const targetDates = [...new Set([...calendar,selected])];
  const skyByDate = new Map();
  const skyOn = (date) => {
    if (!skyByDate.has(date)) {
      try { skyByDate.set(date,astronomy(place,date,zone)); }
      catch { skyByDate.set(date,{sunUp:'—',sunDown:'—',moonUp:'—',moonDown:'—',phase:'',events:[]}); }
    }
    return skyByDate.get(date);
  };
  const rows = new Map();
  const tideByDate = new Map();
  const trust = {weather:latest(weatherEntry,now),marine:latest(marineEntry,now)&&nearMarine,river:latest(riverEntry,now)};
  Object.assign(trust,{wind:trust.weather,rain:trust.weather,visibility:trust.weather,waves:trust.marine,current:trust.marine});
  for (const date of targetDates) {
    const sky = skyOn(date);
    const tide = tides(place,date,nearMarine ? marine : [],'auto');
    tideByDate.set(date,tide);
    const solunar = [-1,0,1].flatMap((offset) => skyOn(plusDay(date,offset)).events.map((event)=>({
      major:event.major,start:clockMinute(event.time)+offset*1440-(event.major?60:30),end:clockMinute(event.time)+offset*1440+(event.major?60:30),
    }))).filter(({start,end})=>start<1440 && end>=0);
    const flow = profileId === 'river' ? riverTrend(r.get(date),r.get(plusDay(date,-1)),r.get(plusDay(date,1))) : null;
    for (let h = 0; h < 24; h++) {
      const time = `${date}T${minuteLabel(h*60)}`;
      const sampleMinute = time === hourStart(current) ? clockMinute(current.slice(11)) : h*60+30;
      const dayTide = profile.wave && (tide.official || nearMarine) ? directionToNext(tide.points,sampleMinute) : null;
      rows.set(time,{time,...evaluateHour(profile,{weather:w.get(time),marine:profile.wave ? m.get(time) : undefined,
        tide:dayTide,sky,solunar,river:flow,minute:sampleMinute,trust:{...trust,tide:tide.official || trust.marine}})});
    }
  }
  const hours = (date) => Array.from({length:24},(_,i)=>rows.get(`${date}T${minuteLabel(i*60)}`));
  const plan = calendar.map((date)=>dayPlan(date,hours(date),current));
  return {profile,rows,hours,plan,sky:skyByDate.get(selected),tide:tideByDate.get(selected),trust,nearMarine,marineGridDistance,
    reference:rows.get(selected === currentDate ? hourStart(current) : `${selected}T12:00`),
    selectedPlan:plan.find(({date})=>date===selected) || dayPlan(selected,hours(selected),current),
    best:plan.filter((item)=>item.best).sort((a,b)=>b.best.score-a.best.score)[0],
    next:Array.from({length:7},(_,i)=>rows.get(shiftHours(hourStart(current),i))).filter(Boolean)};
}

function dayPlan(date, hours, current) {
  const usable = date < current.slice(0,10) ? [] : hours.filter(({time})=>time >= hourStart(current));
  const windows = [];
  for (let i=0; i+1<usable.length; i++) {
    const a=usable[i], b=usable[i+1];
    if (!finite(a.score) || !finite(b.score) || a.score < 60 || b.score < 60) continue;
    const from = a.time < current ? current : a.time;
    const end = shiftHours(b.time,1);
    if ((Date.parse(`${end}:00Z`)-Date.parse(`${from}:00Z`))/60000 < 90) continue;
    const score = round((a.score + b.score)/2);
    windows.push({from,end,score,state:grade(score),first:a,second:b});
  }
  windows.sort((a,b)=>b.score-a.score || a.from.localeCompare(b.from));
  const best = windows[0];
  const alternative = best && windows.find((x)=>x.end<=best.from || x.from>=best.end);
  const hazardTimes = usable.filter((hour)=>hour.hazards.length);
  return {date,best,alternative,hazardTimes,scored:usable.filter(({score})=>finite(score)).length,
    observed:usable.length,unfavorable:usable.filter(({score})=>finite(score)).sort((a,b)=>b.score-a.score)[0]};
}

export const windowLabel = (window) => `${window.from.slice(11)}–${window.end.endsWith('T00:00')?'24:00':window.end.slice(11)}`;
export const deltaText = (before,after,threshold,unit) => {
  if (![before,after].every(finite)) return null;
  const delta = after-before;
  return `${Math.abs(delta)<threshold?'pouca variação':`${delta>0?'sobe':'cai'} ${format(Math.abs(delta),1)} ${unit}`}`;
};
