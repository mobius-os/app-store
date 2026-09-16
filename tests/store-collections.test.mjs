import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {catalogPublisher, libraryCollections, mergeCatalogEntries, newestPublications, mergeOfficialCommunityFeedback} from '../domain.js'
import {MANIFEST_SNAPSHOTS} from '../manifest-snapshots.js'

test('a curated repository owner is not replaced by the person submitting community feedback', () => {
  assert.equal(catalogPublisher({repo:'mobius-os/app-kanban',community_feedback:{author:{handle:'example-publisher'}}}), 'mobius-os')
  assert.equal(catalogPublisher({repository:'example/published-app'}), 'example')
})
test('an explicitly migrated source cannot be reverted by an older catalogue copy', () => {
  const canonical={id:'kanban',repo:'mobius-os/app-kanban',manifest_url:'new',previous_repositories:['hamzamerzic/app-kanban']}
  assert.equal(mergeCatalogEntries([canonical],[{id:'kanban',repo:'hamzamerzic/app-kanban',manifest_url:'old'}])[0].manifest_url,'new')
  assert.equal(mergeCatalogEntries([canonical],[{id:'kanban',repo:'mobius-os/new-kanban',manifest_url:'newer'}])[0].manifest_url,'newer')
})
test('Kanban uses the verified organization source and keeps its original publication date', () => {
  const data=JSON.parse(readFileSync(new URL('../catalog.json',import.meta.url)))
  const kanban=data.apps.find(x=>x.id==='kanban')
  assert.equal(kanban.repo,'mobius-os/app-kanban')
  assert.equal(kanban.manifest_url,'https://raw.githubusercontent.com/mobius-os/app-kanban/main/mobius.json')
  assert.equal(kanban.previous_repositories,undefined)
  assert.equal(newestPublications([kanban])[0],kanban)
  const personal={id:'community:old',repository:'hamzamerzic/app-kanban',manifest:{id:'kanban'},community:{author:{handle:'hamzamerzic'}}}
  const merged=mergeOfficialCommunityFeedback([{...kanban,manifest:{id:'kanban'}}],[personal])
  assert.equal(merged.length,1)
  assert.equal(merged[0].community_feedback,undefined)
})
test('Social uses the maintained organization source and retires its stale publication', () => {
  const data=JSON.parse(readFileSync(new URL('../catalog.json',import.meta.url)))
  const social=data.apps.find(x=>x.id==='social')
  assert.equal(social.repo,'mobius-os/app-social')
  assert.equal(social.manifest_url,'https://raw.githubusercontent.com/mobius-os/app-social/main/mobius.json')
  assert.deepEqual(social.previous_repositories,['hamzamerzic/app-social'])
  const stale={id:'community:old',repository:'hamzamerzic/app-social',manifest:{id:'social'},community:{author:{handle:'hamzamerzic'}}}
  const merged=mergeOfficialCommunityFeedback([{...social,manifest:{id:'social'}}],[stale])
  assert.equal(merged.length,1)
  assert.equal(merged[0].community_feedback,undefined)
})
test('renamed first-party apps use canonical identities and public names', () => {
  const data=JSON.parse(readFileSync(new URL('../catalog.json',import.meta.url)))
  const integrations=data.apps.find(x=>x.id==='integrations')
  const pages=data.apps.find(x=>x.id==='pages')
  assert.equal(integrations.name,'Integrations')
  assert.equal(MANIFEST_SNAPSHOTS.integrations.name,'Integrations')
  assert.equal(integrations.listing.screenshots[0].alt,'Standalone Integrations app screen')
  assert.equal(pages.name,'Pages')
  assert.equal(MANIFEST_SNAPSHOTS.pages.name,'Pages')
  assert.equal(pages.listing.screenshots[0].alt,'Standalone Pages app screen')
})
test('Library groups attention and updates first without duplicating or adding uninstalled apps', () => {
  const rows=['ready','update','setup','conflict','not-installed'].map(id=>({id,name:id}))
  const states=new Map([
    ['ready',{key:'installed',installedApp:{id:1}}],
    ['update',{key:'update',installedApp:{id:2}}],
    ['setup',{key:'installed',setupNeedsAttention:true,installedApp:{id:3}}],
    ['conflict',{key:'conflict',installedApp:{id:4}}],
  ])
  const groups=libraryCollections(rows,states)
  assert.deepEqual(groups.map(g=>g.id),['attention','updates','installed'])
  assert.deepEqual(groups.flatMap(g=>g.items.map(x=>x.id)),['conflict','setup','update','ready'])
  assert.deepEqual(libraryCollections([],states),[])
})
test('category and detail navigation require host ownership and support reversible back levels', () => {
  const source=readFileSync(new URL('../index.jsx',import.meta.url),'utf8')
  assert.match(source,/nav.open\('app-store-collection'/)
  assert.match(readFileSync(new URL('../store-navigation.js',import.meta.url),'utf8'), /nav.open\('app-store-detail'/)
  assert.match(source,/status !== 'owned'/)
  assert.match(source,/onForward: \(\) => \{\s*setTab\('browse'\)/)
  assert.doesNotMatch(source,/nav-push ack timeout|Older shell without ack/)
})
