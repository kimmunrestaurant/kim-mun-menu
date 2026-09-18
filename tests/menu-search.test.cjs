const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function loadMenu() {
  const context = vm.createContext({window: {}});
  for (const name of ['menu-data.js', 'menu-corrections.js', 'menu-groups.js', 'menu-search.js']) {
    vm.runInContext(read(name), context, {filename: name});
  }
  return context;
}
const context = loadMenu();
const {MAIN_MENU: main, DEAL_MENU: deals, MenuSearch} = context.window;
const search = MenuSearch.createIndex(main);
const dealSearch = MenuSearch.createIndex(deals);
const rows = (query, find = search) => Array.from(find(query)).flatMap(([, items]) => Array.from(items));
const codes = (query, find = search) => rows(query, find).map(item => item.code).sort();

test('word order and connecting words do not prevent a match', () => {
  assert.deepEqual(codes('dry chicken'), ['56A', '63A', '63F']);
  for (const query of ['chicken dry', 'please show me dry chicken', ' DRY   chicken ']) {
    assert.deepEqual(codes(query), codes('dry chicken'));
  }
  assert.deepEqual(codes('chicken sweet sour'), codes('sweet & sour chicken'));
});

test('common spellings, plurals and food synonyms return the same dishes', () => {
  for (const queries of [
    ['prawn', 'prawns', 'shrimp', 'shrimps'],
    ['chicken chili', 'chicken chilli', 'chicken chillies', 'chicken chilies'],
    ['chow mein', 'chowmein', 'chowmien'],
    ['egg foo young', 'egg foo yung', 'egg foo yong'],
    ['chicken sichuan', 'chicken szechuan', 'chicken schezwan'],
    ['chocolate', 'choc', 'chocalate', 'cholocalate'],
    ['cappuccino', 'cappucino', 'capuccino']
  ]) {
    const expected = codes(queries[0]);
    assert.ok(expected.length, queries[0]);
    for (const query of queries.slice(1)) assert.deepEqual(codes(query), expected, query);
  }
  assert.ok(codes('shrimp').includes('90'), 'Shrimp Fried Rice');
  assert.ok(codes('prawns').includes('53A'), 'protein choice listed alongside the broccoli price');
});

test('typo correction handles missing, extra, substituted and transposed letters', () => {
  for (const [query, expected] of [
    ['chiken dry', 'dry chicken'], ['chikcen dry', 'dry chicken'],
    ['chickeen dry', 'dry chicken'], ['chickan dry', 'dry chicken'],
    ['mushroms', 'mushrooms'], ['cold drniks', 'cold drinks'],
    ['cofee', 'coffee'], ['chicken manchourian', 'chicken manchurian']
  ]) assert.deepEqual(codes(query), codes(expected), query);
  assert.ok(codes('chick').includes('56A'), 'partial word while typing');
});

test('cold drinks include cold beverage groups and exclude hot drinks and food', () => {
  for (const [menu, find] of [[main, search], [deals, dealSearch]]) {
    const expected = Object.entries(menu).filter(([category]) =>
      ['COLD COFFEE', 'BEVERAGES', 'SEASONAL FRESH JUICE', 'CHILLERS', 'ICED TEA'].includes(category))
      .flatMap(([, items]) => Array.from(items)).filter(item => !['N6', 'N8'].includes(item.code))
      .map(item => item.code).sort();
    assert.deepEqual(codes('cold drinks', find), expected);
    assert.deepEqual(codes('drinks cold', find), expected);
    assert.deepEqual(codes('chilled beverages', find), expected);
  }
  assert.deepEqual(codes('hot drinks'), ['J1', 'J2', 'J3', 'J5', 'J6', 'J7', 'N6', 'N8']);
  assert.deepEqual(codes('cold mango drinks'), ['F1', 'T7', 'T7A', 'U4']);
  assert.deepEqual(codes('ice tea'), ['F1', 'F2', 'F3', 'F4', 'F5']);
  assert.ok(!codes('coffee').includes('J7'), 'hot chocolate is not coffee');
});

test('unrelated ingredients and short real words are not guessed', () => {
  assert.deepEqual(codes('dry tofu'), []);
  assert.deepEqual(codes('chicken dragonfruit'), []);
  assert.ok(!codes('chicken').includes('43'), 'plain Egg Foo Young is not chicken');
  assert.ok(!codes('rice').some(code => code.startsWith('F')), 'rice must not match iced tea');
  assert.deepEqual(codes('tea'), ['F1', 'F2', 'F3', 'F4', 'F5', 'N6', 'N8']);
  assert.deepEqual(codes('crab'), ['101A'], 'shared seafood category must not match duck');
  for (const query of ['', '   ', '!!!', 'with and', 'xxxxxxxx', '<script>alert(1)</script>']) {
    assert.deepEqual(codes(query), [], query);
  }
});

test('all 317 exact dish names and codes remain searchable in their own menu', () => {
  for (const [menu, find] of [[main, search], [deals, dealSearch]]) {
    for (const item of Object.values(menu).flat()) {
      assert.ok(rows(item.name, find).includes(item), `${item.code}: ${item.name}`);
      assert.deepEqual(codes(item.code, find), [item.code], item.code);
    }
  }
  assert.deepEqual(codes('D-1', dealSearch), ['D-1']);
  assert.deepEqual(codes('d1a', dealSearch), ['D-1A']);
  assert.deepEqual(codes('deal 16e', dealSearch), ['D-16E']);
  assert.deepEqual(codes('D-1'), [], 'deals must not leak into the main menu');
  assert.ok(codes('dry chicken', dealSearch).includes('D-2A'));
});

test('group order, source data and branch-specific prices are preserved', () => {
  const before = JSON.stringify([main, deals]);
  const result = search('prawns');
  const categories = Array.from(result, ([category]) => category);
  assert.deepEqual(categories, Object.keys(main).filter(category => categories.includes(category)));
  assert.equal(rows('fresh orange juice')[0].price, '570');
  assert.equal(rows('fresh orange juice', dealSearch)[0].price, '500');
  assert.equal(JSON.stringify([main, deals]), before);
  const translated = MenuSearch.createIndex(main, name => name === 'Hot Chocolate' ? '热巧克力' : name);
  assert.deepEqual(codes('巧克力', translated), ['J7']);
});

// Execute the actual page scripts to check input wiring and menu/branch changes.
test('page search, clear, empty state and branch switching render correctly', () => {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      value: '', innerHTML: '', textContent: '', style: {},
      setAttribute() {}, scrollIntoView() {}, showModal() {}, close() {}
    });
    return elements.get(selector);
  };
  const page = vm.createContext({
    window: {}, URL, URLSearchParams,
    location: new URL('https://kimmunrestaurant.github.io/kim-mun-menu/?branch=centaurus'),
    history: {replaceState() {}}, requestAnimationFrame: callback => callback(),
    document: {querySelector: element, querySelectorAll: () => [], documentElement: {}, title: ''}
  });
  const html = read('index.html');
  for (const [, attrs, source] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src = attrs.match(/src="([^"]+)"/);
    vm.runInContext(src ? read(src[1].split('?')[0]) : source, page);
  }
  const query = value => { element('#search').value = value; element('#search').oninput(); };
  const shownCodes = () => [...element('#menu').innerHTML.matchAll(/<div class="code">([^<]+)<\/div>/g)]
    .map(match => match[1]).sort();
  query('dry chicken');
  assert.deepEqual(shownCodes(), ['56A', '63A', '63F']);
  query('nothinglikeamenuitem');
  assert.equal(element('#empty').style.display, 'block');
  query('');
  assert.equal(shownCodes().length, main.SOUP.length);
  assert.equal(element('#empty').style.display, 'none');
  vm.runInContext("menuType='deals';category='SOUP';renderMenu()", page);
  query('cold drniks');
  assert.deepEqual(shownCodes(), codes('cold drinks', dealSearch));
  query('D-1');
  assert.deepEqual(shownCodes(), ['D-1']);
  vm.runInContext("setBranch(branches[0],false)", page);
  assert.deepEqual(shownCodes(), []);
  query('dry chicken');
  assert.deepEqual(shownCodes(), ['56A', '63A', '63F']);
});
