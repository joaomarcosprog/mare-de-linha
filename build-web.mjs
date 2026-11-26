import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = new URL('./', import.meta.url);
const icons = `activity arrow-down-right arrow-right arrow-up-right book-open calendar-days calendar-range
check chevron-down chevron-left chevron-right circle-alert circle-check circle-help circle-x clock-4 cloud-rain
cloud-sun compass droplets fish gauge info locate-fixed map-pin minus moon moon-star mountain navigation
notebook-pen pencil plus refresh-cw route sailboat search shield-check ship sparkles star sun target thermometer
trash-2 trees trending-down triangle-alert umbrella waves wind x`.split(/\s+/);
const symbolList = await Promise.all(icons.map(async (name) => {
  const raw = await readFile(new URL(`node_modules/lucide-static/icons/${name}.svg`,root),'utf8');
  const svg = raw.slice(raw.indexOf('<svg')).trim().replace('<svg','<svg aria-hidden="true" focusable="false"');
  return [name,svg];
}));
await writeFile(new URL('src/icons.generated.js',root), `export default ${JSON.stringify(Object.fromEntries(symbolList),null,2)};\n`);
const library = await readFile(new URL('node_modules/astronomy-engine/esm/astronomy.js',root),'utf8');
const licenses = await Promise.all([
  ['Lucide','lucide-static/LICENSE'],
  ['DM Sans','@fontsource-variable/dm-sans/LICENSE'],
  ['Manrope','@fontsource-variable/manrope/LICENSE'],
].map(async ([name,path]) => `${name}\n\n${(await readFile(new URL(`node_modules/${path}`,root),'utf8')).trim()}`));
await writeFile(new URL('web/static/licencas.txt',root), [library.slice(3,library.indexOf('*/')).trim(),...licenses].join('\n\n────────────\n\n'));
await build({absWorkingDir:fileURLToPath(root),entryPoints:['src/app.js'],bundle:true,target:['chrome100'],minify:true,outfile:'web/app.js',legalComments:'inline'});
