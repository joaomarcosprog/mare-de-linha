import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('.',import.meta.url));
const {outputFiles} = await build({absWorkingDir:root,entryPoints:['src/guide.js'],bundle:true,platform:'node',format:'esm',write:false});
const {evaluateHour, guideForecast, grade, profiles, shiftHours} = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);

const trust = {weather:true,marine:true,river:true,waves:true,current:true,wind:true,rain:true,visibility:true,tide:true};
const weather = {wind_speed_10m:10,wind_gusts_10m:14,weather_code:1,precipitation_probability:5,precipitation:0,visibility:16000};
const marine = {wave_height:.6,wave_period:6,ocean_current_velocity:.42};
const sky = {sunUp:'05:14',sunDown:'17:31',phase:'Cheia'};
const base = {weather,marine,sky,tide:{name:'Enchendo',change:.1},minute:700,solunar:[{start:690,end:750,major:true}],trust};
const rate = (profile,changes={}) => evaluateHour(profiles[profile],{...base,...changes});
for (const [id,profile] of Object.entries(profiles)) {
  assert.equal(Object.values(profile.weights).reduce((a,b)=>a+b),100,id);
  const result = rate(id);
  assert.ok(result.score >= 60 && result.score <= 100,`${id} score: ${result.score}`);
}
assert.ok(rate('beach').score > rate('rocks').score);
assert.equal(rate('beach',{marine:{wave_height:null}}).state,'unknown');
assert.equal(rate('river',{marine:{wave_height:6}}).hazards.length,0);
assert.equal(rate('river',{trust:{...trust,marine:false},marine:{}}).state,'excellent');
assert.equal(rate('boat',{weather:{...weather,visibility:null}}).state,'unknown');
assert.equal(rate('boat',{weather:{...weather,visibility:900}}).state,'risk');
assert.equal(rate('rocks',{marine:{...marine,wave_height:.8,wave_period:11}}).hazards[0].code,'swell');
assert.equal(rate('rocks',{marine:{...marine,wave_height:.9,wave_period:null},trust:{...trust}}).state,'unknown');
assert.equal(rate('beach',{weather:{...weather,weather_code:95},marine:{}}).hazards[0].code,'storm');
assert.equal(rate('beach',{weather:{...weather,weather_code:95}}).score,null);
assert.equal(rate('beach',{trust:{...trust,weather:false}}).state,'unknown');
assert.equal(rate('beach',{weather:{...weather,wind_speed_10m:0,wind_gusts_10m:0}}).state,'excellent');
assert.equal(rate('beach',{weather:{...weather,precipitation:null,precipitation_probability:null}}).score,null);
for (const [score,state] of [[0,'poor'],[41,'poor'],[42,'weak'],[60,'regular'],[74,'good'],[88,'excellent'],[null,'unknown']]) assert.equal(grade(score),state);

const now = Date.parse('2026-11-25T17:25:00Z');
const current = '2026-11-25T14:25';
const dates = Array.from({length:145},(_,i)=>shiftHours('2026-11-25T00:00',i));
const params = {
  place:{id:'salvador',lat:-12.9733,lon:-38.5167},zone:'America/Bahia',profileId:'beach',now,current,selected:current.slice(0,10),
  weatherEntry:{stamp:now},marineEntry:{stamp:now,data:{latitude:-12.97,longitude:-38.51}},river:[],
  weather:dates.map((time)=>({time,...weather,weather_code:time==='2026-11-25T15:00'?95:1})),
  marine:dates.map((time)=>({time,...marine,sea_level_height_msl:0})),
};
const plan = guideForecast(params);
assert.equal(plan.plan.length,7);
assert.ok(plan.tide.official);
assert.equal(plan.next.length,7);
assert.equal(plan.next[0].time,'2026-11-25T14:00');
assert.equal(plan.next[1].state,'risk');
assert.ok(plan.selectedPlan.best);
assert.ok(plan.selectedPlan.best.from >= current);
assert.ok(plan.selectedPlan.best.first.time >= '2026-11-25T16:00');
assert.equal(guideForecast({...params,weatherEntry:{stamp:now-9*3600000}}).best,undefined);
assert.equal(guideForecast({...params,marineEntry:{stamp:now,data:{latitude:-15,longitude:-37}}}).reference.state,'unknown');
assert.equal(shiftHours('2026-11-25T23:00',1),'2026-11-26T00:00');
console.log('Guia validado em sete modalidades, equipamentos, cobertura, risco, atualização, janelas, limites e virada do dia.');
