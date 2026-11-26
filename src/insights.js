import { compass, condition, format, minuteLabel } from './data.js';
import { deltaText, grade } from './guide.js';

const finite = Number.isFinite;
const value = (n,unit,places=1) => finite(n)?`${format(n,places)} ${unit}`:'—';
const names = {N:'norte',NE:'nordeste',L:'leste',SE:'sudeste',S:'sul',SO:'sudoeste',O:'oeste',NO:'noroeste'};
const direction = (d,prefix) => finite(d)?`${prefix} ${names[compass(d)]}`:'';
const join = (...parts) => parts.filter(Boolean).join(' · ');
const future = (before,after,threshold,unit) => {
  const change = deltaText(before,after,threshold,unit);
  return change ? `Em 3 horas, ${change==='pouca variação'?'pouca variação prevista':`${change} na previsão`}.` : 'Sem tendência disponível para as próximas 3 horas.';
};

function item(id,title,icon,headline,state,reading,meaning,action,outlook) {
  return {id,title,icon,headline,state,reading,meaning,action,outlook};
}

const stateOf = (entry) => grade(entry?.value);
const hazard = (row,...codes) => row.hazards.some(({code})=>codes.includes(code));

export function conditionInsights(row,next,previous,profile,tideData,referenceMinute) {
  const {weather:w,marine:m,factors,tide,river} = row;
  const after = next?.weather || {};
  const sea = next?.marine || {};
  const pressure = finite(w.pressure_msl) && finite(previous?.weather.pressure_msl) ? w.pressure_msl-previous.weather.pressure_msl : null;
  const pressureStatus = !finite(pressure)?'Tendência indisponível':pressure >= 1?'Pressão subindo':pressure <= -1?'Pressão caindo':'Pressão estável';
  const upcomingTide = tideData.items.find(({minute}) => minute >= referenceMinute);
  const isRiver = !profile.wave;
  const windDir = direction(w.wind_direction_10m,'Vem de');
  const waveDir = direction(m.wave_direction,'Vêm de');
  const currentDir = direction(m.ocean_current_direction,'Vai para');
  const thermal = w.apparent_temperature ?? w.temperature_2m;
  return [
    item('wind','Vento e rajadas','wind',hazard(row,'wind')?'Rajadas ou vento fortes':factors.wind.label,
      hazard(row,'wind')?'risk':stateOf(factors.wind),join(value(w.wind_speed_10m,'km/h',0),finite(w.wind_gusts_10m)?`Rajadas ${value(w.wind_gusts_10m,'km/h',0)}`:'',windDir),
      'O vento empurra a linha e pode levantar ondas. A direção indica de onde ele vem.',
      profile.boat?'Compare a direção do vento no trajeto de ida e de volta.':'Se for pescar, observe o vento de frente e de lado no seu ponto antes de escolher onde arremessar.',
      future(w.wind_gusts_10m,after.wind_gusts_10m,3,'km/h')),
    item('rain','Chuva e tempo','cloud-rain',hazard(row,'storm','rain')?row.hazards.find(({code})=>['storm','rain'].includes(code)).label:factors.rain.label,
      hazard(row,'storm','rain')?'risk':stateOf(factors.rain),join(condition(w.weather_code),finite(w.precipitation_probability)?`${format(w.precipitation_probability,0)}% de chance`:'',finite(w.precipitation)?value(w.precipitation,'mm'):'',finite(w.visibility)?`${value(w.visibility/1000,'km')} de visibilidade`:''),
      'A chance indica se pode chover. O volume ajuda a entender quanto pode chover no período.',
      hazard(row,'storm')?'Adie a saída em área aberta.':isRiver?'Inclua a chuva a montante na avaliação do rio.':'Cheque abrigo e visibilidade se o tempo estiver fechando.',
      finite(after.precipitation_probability)?`Em 3 horas, ${format(after.precipitation_probability,0)}% de chance de chuva.`:'Sem tendência de chuva para as próximas 3 horas.'),
    item('waves','Ondas e ondulação','waves',hazard(row,'wave','swell')?'Ondulação exige atenção':factors.waves.label,
      hazard(row,'wave','swell')?'risk':stateOf(factors.waves),join(value(m.wave_height,'m'),finite(m.wave_period)?`A cada ${value(m.wave_period,'s',0)} em média`:'',waveDir),
      'O período é o intervalo médio entre ondas. Ondas mais espaçadas podem avançar mais na praia e nas pedras.',
      profile.longSwell?'Observe várias séries de ondas a partir de um local afastado da borda.':profile.boat?'Considere ondas vindas de lado e vento no caminho de volta.':'Observe onde a água alcança a areia, especialmente com a maré subindo.',
      future(m.wave_height,sea.wave_height,.15,'m')),
    item('current','Corrente','navigation',finite(m.ocean_current_velocity)?(m.ocean_current_velocity>(profile.current || .9)*1.75?'Corrente modelada mais forte':m.ocean_current_velocity>(profile.current || .9)?'Corrente modelada moderada':'Corrente modelada mais fraca'):'Corrente sem previsão',
      !finite(m.ocean_current_velocity)?'unknown':m.ocean_current_velocity>(profile.current || .9)*1.75?'weak':'neutral',join(value(m.ocean_current_velocity,'km/h'),currentDir),
      'A corrente desloca água e isca. A direção mostra para onde a água vai no modelo.',
      profile.shallow?'A corrente prevista para o mar pode diferir da corrente do canal. Observe o movimento no próprio trecho.':'Observe a deriva da linha antes de ajustar a pescaria.',
      future(m.ocean_current_velocity,sea.ocean_current_velocity,.2,'km/h')),
    item('tide','Movimento da maré','waves',tide?.name==='Enchendo'?'Maré subindo':tide?.name==='Vazando'?'Maré baixando':tide?.name || 'Sem tendência de maré',
      !tide?'unknown':profile.longSwell && tide.change>=.16?'weak':'neutral',
      tide?join(value(tide.height,'m',2),tideData.official?'Tábua oficial com curva interpolada':'Modelo oceânico'):'—',
      'A maré muda a profundidade e os acessos. A vazante pode expor areia, pedras ou bancos de lama.',
      profile.shallow?'Observe o canal e planeje a volta antes que o nível mude.':profile.longSwell?'Planeje a saída da pedra antes que a água cubra o acesso.':'O melhor estágio depende do ponto, da espécie e da técnica.',
      upcomingTide?`Próximo extremo ${minuteLabel(upcomingTide.minute)} · ${upcomingTide.type==='high'?'maré alta':upcomingTide.type==='low'?'maré baixa':'extremo de maré'}.`:'Sem outro extremo disponível nesta data.'),
    item('pressure','Pressão atmosférica','gauge',pressureStatus,!finite(w.pressure_msl)?'unknown':finite(pressure)&&Math.abs(pressure)>=2.5?'weak':'neutral',
      join(value(w.pressure_msl,'hPa'),finite(pressure)?`${pressure>0?'+':''}${value(pressure,'hPa')} em 3 h`:'Sem comparação em 3 h'),
      'Subidas ou quedas ajudam a perceber mudanças de tempo. A resposta dos peixes varia por espécie e ambiente.',
      'Interprete junto com vento, chuva e condições do local.',future(w.pressure_msl,after.pressure_msl,1,'hPa')),
    item('water','Temperatura da água','droplets',finite(m.sea_surface_temperature)?'Temperatura da superfície':'Sem temperatura da água',
      finite(m.sea_surface_temperature)?'neutral':'unknown',value(m.sea_surface_temperature,'°C'),
      'A água pode ter temperaturas diferentes na superfície e na profundidade onde a espécie está.',
      'Compare com o que costuma encontrar no mesmo ponto e com a espécie que procura.',future(m.sea_surface_temperature,sea.sea_surface_temperature,.5,'°C')),
    item('air','Temperatura do ar','thermometer',!finite(thermal)?'Sem temperatura':thermal>=35?'Calor intenso':thermal<=12?'Sensação de frio':'Temperatura sem extremos',
      !finite(thermal)?'unknown':thermal>=35||thermal<=12?'weak':'neutral',join(value(w.temperature_2m,'°C'),finite(w.apparent_temperature)?`Sensação ${value(w.apparent_temperature,'°C')}`:''),
      'A sensação térmica ajuda a planejar o tempo de permanência e a roupa que você vai usar.',
      thermal>=35?'Leve água e reduza a exposição direta ao sol.':'Planeje a roupa e o tempo de permanência de acordo com a sensação térmica.',future(thermal,after.apparent_temperature ?? after.temperature_2m,2,'°C')),
    item('river','Vazão regional','waves',!river?'Sem vazão regional':!finite(river.ratio)?'Sem comparação de vazão':river.ratio>=.15?'Vazão regional em alta':river.ratio<=-.15?'Vazão regional em baixa':'Vazão regional pouco variável',
      !river?'unknown':river.ratio>=.15?'weak':'neutral',river?value(river.value,'m³/s',0):'—',
      'É o volume diário de água que o modelo estima para o maior rio próximo. A previsão pode representar outro trecho.',
      'Confira o nível e a força da corrente na margem e mudanças a montante, especialmente perto de barragens.',finite(river?.later)?`Dia seguinte: ${Math.abs(river.later)<.15?'pouca variação regional prevista':`${river.later>0?'alta':'baixa'} de ${format(Math.abs(river.later)*100,0)}% na vazão modelada`}.`:'Sem tendência disponível para o dia seguinte.'),
  ];
}
