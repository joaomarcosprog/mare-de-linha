import { profiles, levels, windowLabel } from './guide.js';
import { prettyDate, plusDay, format, urls } from './data.js';
import { actionText, blank, cleanLabel, escape, marker, sourceLink } from './ui.js';

export function statusChip(state, text, short=false) {
  const level = levels[state];
  return `<span class="level tone-${state}">${marker(level.icon)}${escape(text || (short?level.short:level.label))}</span>`;
}

const meter = (state) => `<span class="rating-meter tone-${state}" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i${i<levels[state].rank?' class="filled"':''}></i>`).join('')}</span>`;
const timeOf = (time) => time.slice(11);

export function dateName(date,today) {
  return date===today?'Hoje':date===plusDay(today,1)?'Amanhã':cleanLabel(prettyDate(date,{weekday:'long'}));
}

export function guideControls(profile, mode) {
  return `<div class="guide-controls"><button class="profile-button" data-do="profiles">${marker(profile.icon)}<span><small>Modalidade</small><strong>${profile.label}</strong></span>${marker('chevron-down')}</button>
  <div class="mode-switch" role="group" aria-label="Modo de apresentação"><button data-do="mode:simple" type="button" aria-pressed="${mode==='simple'}">Simples</button><button data-do="mode:detail" type="button" aria-pressed="${mode==='detail'}">Detalhado</button></div></div>`;
}

export function profileOptions(selected) {
  return `<div class="profile-list">${Object.entries(profiles).map(([id,profile])=>`<button class="place" type="button" data-do="profile:${id}" aria-pressed="${selected===id}">${marker(profile.icon)}<span><strong>${profile.label}</strong><small>${profile.note}</small></span><span class="end">${marker(selected===id?'check':'chevron-right')}</span></button>`).join('')}</div>`;
}

const intent = {excellent:'As condições previstas favorecem esta modalidade.',good:'Há bons sinais para planejar a pescaria.',regular:'Dá para planejar, com atenção aos fatores abaixo.',weak:'Compare com outro horário para encontrar condições melhores.',poor:'Vale procurar outro horário ou reavaliar o ponto.',risk:'Redobre a atenção e consulte os avisos oficiais.',unknown:'Ainda faltam previsões essenciais para avaliar este horário.'};

export function assessment(row,caption,loading,mode,scope='') {
  const valid = Number.isFinite(row.score);
  return `<section class="assessment tone-${row.state}" aria-label="Condições de pesca no horário escolhido"><div class="assessment-inner">
    <div class="assessment-main"><div class="assessment-time">${marker('clock-4')}${escape(caption)}</div>
    <h2>${marker(levels[row.state].icon)}<span>${loading&&!row.hazards.length&&!valid?'Buscando previsão…':levels[row.state].label}</span></h2>
    <p>${escape(row.hazards[0]?.label || intent[row.state])}${scope?` ${escape(scope)}`:''}</p></div>
    ${valid?`<div class="rating"><div><strong>${row.score}</strong><small>/100</small></div>${meter(row.state)}<span>Índice de condições</span></div>`:''}
  </div><div class="assessment-footer">${actionText('method','Como avaliamos','info','contrast-link')}${valid&&row.coverage<100?`<span>${row.coverage}% de cobertura</span>`:''}${mode==='detail'&&valid?`<span>${row.known.length} fatores</span>`:''}</div></section>`;
}

export function riskCard(hours, note='') {
  const risks = new Map();
  for (const hour of hours) for (const alert of hour.hazards) {
    if (!risks.has(alert.code)) risks.set(alert.code,{...alert,first:hour.time,last:hour.time,count:1});
    else { const existing=risks.get(alert.code); existing.last=hour.time; existing.count++; }
  }
  if (!risks.size) return '';
  return `<section class="risk-box" aria-label="Riscos previstos"><header>${marker('triangle-alert')}<h2>Condições potencialmente perigosas</h2></header>
    ${[...risks.values()].map(({label,text,first,last,count})=>`<div class="risk-line"><strong>${label} <small>· ${first===last?timeOf(first):`${timeOf(first)} a ${timeOf(last)} (${count} horários)`}</small></strong><p>${text}</p></div>`).join('')}
    ${note?`<p class="caption">${escape(note)}</p>`:''}${sourceLink(urls.alerts,'Ver avisos oficiais da Marinha')}</section>`;
}

export function dayWindow(plan, dayLabel) {
  const {best,alternative,scored,observed,unfavorable,hazardTimes} = plan;
  if (best) {
    const supports = best.first.known.filter(({id,label,value})=>value>=84 && best.second.known.some((item)=>item.id===id&&item.label===label&&item.value>=84)).sort((a,b)=>b.weight-a.weight).slice(0,2);
    return `<section class="best-window"><div class="window-top"><span>${marker('target')} Melhor janela · ${escape(dayLabel)}</span>${statusChip(best.state,null,true)}</div>
    <strong class="window-time">${windowLabel(best)}</strong><p>${supports.length?`${supports.map(({label},i)=>i?label.toLowerCase():label).join(' e ')} durante a janela.`:'É a faixa com o melhor equilíbrio entre os horários avaliados.'}</p>
    ${[best.first,best.second].some(({lighting})=>lighting==='À noite')?'<p class="alternative">Há trechos à noite. Confira a iluminação e o acesso.</p>':''}
    ${alternative?`<p class="alternative">Outra opção ${windowLabel(alternative)}</p>`:''}
    ${actionText('planner','Comparar os próximos 7 dias','arrow-right','window-link')}</section>`;
  }
  const heading=!observed?'Sem janela futura neste dia':hazardTimes.length&&!scored?'Atenção aos riscos do dia':scored?'Nenhuma janela favorável encontrada':'Ainda sem janela estimada';
  return `<section class="best-window no-window"><div class="window-top"><span>${marker('target')} Melhor janela · ${escape(dayLabel)}</span></div><strong class="window-empty">${heading}</strong>
  <p>${!observed?'Escolha uma data futura para planejar.':unfavorable?'As faixas avaliadas não sustentam uma janela de pelo menos 90 minutos.':'Confira os horários e aguarde dados suficientes para comparar.'}</p>${actionText('planner','Comparar os próximos 7 dias','arrow-right','window-link')}</section>`;
}

export function hourStrip(hours, anchor, label='Próximas horas', extended=false) {
  if (!hours.length) return '';
  return `<section class="hour-section" aria-label="${escape(label)}"><header class="section-head"><h2>${escape(label)}</h2><span class="section-meta">${extended?'Toque para entender':'Horário local'}</span></header>
    <div class="hour-strip" tabindex="0" aria-label="Rolagem horizontal por horário">${hours.map((hour,i)=>{
      const state=levels[hour.state];
      const crossed=i>0 && hour.time.slice(0,10)!==hours[i-1].time.slice(0,10);
      return `<button class="hour-tile tone-${hour.state}" aria-label="${timeOf(hour.time)}, ${state.label}${Number.isFinite(hour.score)?`, índice ${hour.score}`:''}" data-do="hour:${hour.time}"><span class="hour-clock">${hour.time===anchor?'Agora':crossed?'00h · amanhã':timeOf(hour.time)}</span><span class="hour-state">${marker(state.icon)}<strong>${Number.isFinite(hour.score)?hour.score:'—'}</strong></span><small>${state.short}</small></button>`;
    }).join('')}</div></section>`;
}

function reasons(row, direction, detailed) {
  const known = row.known.filter(({value})=>direction==='help'?value>=82:value<70)
    .sort((a,b)=>direction==='help'?(b.value-65)*b.weight-(a.value-65)*a.weight:(65-a.value)*a.weight-(65-b.value)*b.weight);
  const alerts = direction==='hurt'?row.hazards:[];
  return alerts.map(({label,text})=>({label,text,score:null})).concat(known.slice(0,detailed?9:3));
}

export function factorPanel(row,detailed) {
  const group = (dir,title,icon,empty) => {
    const entries = reasons(row,dir,detailed);
    return `<section class="card factor-box ${dir}"><h3>${marker(icon)}${title}</h3>${entries.length?`<ul>${entries.map(({label,text,weight})=>`<li><strong>${escape(label)}${detailed&&weight?` <small>· peso ${weight}</small>`:''}</strong><p>${escape(text)}</p></li>`).join('')}</ul>`:`<p class="caption">${empty}</p>`}</section>`;
  };
  return `<div class="factor-grid">${group('help','A favor','circle-check','Nenhum fator favorável com dados disponíveis neste recorte.')}${group('hurt','Pontos de atenção','triangle-alert','Nenhum fator teve impacto negativo nesta leitura.')}</div>`;
}

export function missingNote(row,forecast) {
  const separate = forecast.profile.shallow?'O canal pode responder de forma diferente do mar aberto.':!forecast.profile.wave?'Avaliação do tempo na margem. A vazão local precisa de confirmação.':'';
  const model = !forecast.nearMarine&&forecast.profile.wave?` A célula oceânica está a cerca de ${format(forecast.marineGridDistance,0)} km do ponto.`:'';
  return row.missing.length || separate ? `<p class="data-note">${marker('info')}<span>${row.missing.length?`Faltam ${escape(row.missing.join(', '))}.${model} `:''}${separate}</span></p>`:'';
}

export function weekList(forecast,today,day) {
  const {plan,best}=forecast;
  return `<div class="week-list">${plan.map((item)=>{
    const label = prettyDate(item.date,{day:'2-digit',month:'2-digit'});
    const risky=item.hazardTimes.length;
    return `<button class="week-row${item.date===day?' active':''}" data-do="plan-day:${item.date}" aria-pressed="${item.date===day}">
      <span class="week-date"><strong>${dateName(item.date,today)}</strong><small>${label}</small></span>
      <span class="week-window"><strong>${item.best?windowLabel(item.best):item.scored?'Sem boa janela':risky?'Riscos previstos':'Sem leitura'}</strong><small>${item.date===best?.date?'Melhor janela dos 7 dias':risky?`${risky} ${risky===1?'horário com risco':'horários com risco'}`:''}</small></span>
      <span class="week-score tone-${item.best?.state || (risky?'risk':'unknown')}">${marker(levels[item.best?.state || (risky?'risk':'unknown')].icon)}${item.best?.score ?? '—'}</span>
    </button>`;
  }).join('')}</div>`;
}

export function insightCard(insight,open=false) {
  const {title,icon,headline,reading,meaning,action,outlook,state} = insight;
  return `<article class="card insight tone-${state}"><div class="insight-head"><span class="insight-icon">${marker(icon)}</span><div><h2>${title}</h2><p>${escape(headline)}</p></div><span class="insight-mark" title="${levels[state].short}" aria-label="${levels[state].short}">${marker(levels[state].icon)}</span></div>
  <p class="insight-reading">${escape(reading)}</p><p class="insight-outlook">${marker('arrow-right')}${escape(outlook)}</p>
  <details${open?' open':''}><summary>Como isso afeta a pescaria</summary><p>${escape(meaning)}</p><p>${escape(action)}</p></details></article>`;
}

export function strongHours(plan) {
  if (!plan.best) return '';
  return `<div class="plan-picked">${statusChip(plan.best.state)}<strong>${windowLabel(plan.best)}</strong><span>${plan.best.score}/100</span></div>`;
}

export function hourDetail(row,detailed) {
  return `${statusChip(row.state)}${Number.isFinite(row.score)?`<p class="hour-index"><strong>${row.score}</strong>/100 para as condições de pesca</p>`:''}
    ${riskCard([row])}${row.missing.length?blank(`Faltam ${row.missing.join(', ')}.`):''}
    ${factorPanel(row,detailed)}<p class="caption">${row.lighting || 'Luz sem leitura'} · ${row.lunar || 'Solunar sem leitura'}</p>
    ${actionText(`conditions-hour:${row.time}`,'Abrir condições deste horário','arrow-right','primary')}`;
}

export function methodology(forecast,row) {
  return `<div class="info-list"><p>O índice de 0 a 100 compara condições de planejamento para <strong>${forecast.profile.label.toLowerCase()}</strong>. A captura depende da espécie, do ambiente, da técnica e de fatores que o app não mede.</p>
    <div><strong>Como a nota é calculada</strong><p>O app dá uma nota a cada fator, multiplica pelo peso e divide pela soma dos pesos com dados. Exige pelo menos 67% dos pesos e dados recentes de vento, chuva e trovoadas. Ondas são obrigatórias nas modalidades marítimas e visibilidade é obrigatória nas embarcadas.</p></div>
    <div><strong>Pesos desta modalidade</strong><ul class="method-list">${Object.entries(forecast.profile.weights).map(([id,weight])=>`<li><span>${({wind:'Vento',rain:'Chuva',waves:'Ondas',current:'Corrente',tide:'Maré',light:'Luz do dia',visibility:'Visibilidade',lunar:'Solunar',river:'Vazão regional'})[id]}</span><strong>${weight}%</strong><small>${row.known.find((f)=>f.id===id)?.value ?? '—'}/100</small></li>`).join('')}</ul></div>
    <div><strong>Janelas e avisos</strong><p>As janelas exigem dois horários consecutivos com nota de pelo menos 60 e 90 minutos ainda disponíveis. Uma indicação de risco bloqueia a nota naquele horário. Confira os avisos oficiais e as condições observadas no local.</p></div>
    <div><strong>Faixas</strong><p>88–100 excelente, 74–87 bom, 60–73 regular, 42–59 pouco favorável e 0–41 desfavorável.</p></div></div>`;
}

export function solunarBars(hours) {
  const active = hours.filter(({lunar})=>lunar && lunar!=='Fora das janelas');
  return active.length?`<div class="lunar-timeline" role="img" aria-label="${active.map(({time,lunar})=>`${timeOf(time)}: ${lunar}`).join(', ')}">${hours.map(({lunar})=>`<i class="${lunar==='Janela maior'?'major':lunar==='Janela menor'?'minor':''}"></i>`).join('')}</div><div class="lunar-hours"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span></div>`:blank('Sem janelas solunares calculadas para esta data.');
}
