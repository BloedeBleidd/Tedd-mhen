import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// Source is public-domain Natural Earth data; see docs/LOCALIZATION.md.
const revision = '9380cca83db5f9aef52d5e762765100745f84b27';
const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${revision}/geojson/ne_10m_admin_0_countries.geojson`;
const expected = '239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255';
const response = await fetch(url);
if (!response.ok) throw new Error(`Map source returned ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (createHash('sha256').update(bytes).digest('hex') !== expected)
  throw new Error('Map source checksum differs; review provenance before updating.');
const suggestions = {
  pl: 'PL',
  es: 'ES MX AR BO CL CO CR CU DO EC GQ GT HN NI PA PE PR PY SV UY VE',
  de: 'DE AT LI',
  fr: 'FR MC BE LU BJ BF BI CF TD KM CG CD CI DJ GA GN HT MG ML NE RW SN SC TG',
  pt: 'PT BR AO MZ CV GW ST TL',
};
const languages = new Map(
  Object.entries(suggestions).flatMap(([language, countries]) =>
    countries.split(' ').map((country) => [country, language]),
  ),
);
const regions = JSON.parse(bytes.toString('utf8')).features.flatMap((feature) => {
  const country = feature.properties.ISO_A2_EH;
  const language = languages.get(country);
  if (!language) return [];
  const coordinates = feature.geometry.coordinates;
  const polygons = feature.geometry.type === 'Polygon' ? [coordinates] : coordinates;
  return [
    {
      country,
      language,
      polygons: polygons.map((polygon) =>
        polygon.map((ring) =>
          ring.map((point) => point.map((value) => Math.round(value * 10000) / 10000)),
        ),
      ),
    },
  ];
});
await mkdir('src/data', { recursive: true });
await writeFile('src/data/language-regions.json', JSON.stringify(regions) + '\n');
console.log(`Wrote ${regions.length} region geometries from verified Natural Earth data.`);
