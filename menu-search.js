// Search metadata never changes the menu's displayed names, prices or categories.
(() => {
  const aliases = new Map();
  const variations = {
    chicken: ['chickens', 'chiken', 'chikn'],
    prawn: ['prawns', 'shrimp', 'shrimps'],
    chili: ['chillies', 'chilies', 'chilli', 'chilis', 'chilly'],
    vegetable: ['vegetables', 'veggies', 'veg'],
    mushroom: ['mushrooms'], noodle: ['noodles'],
    egg: ['eggs'], wing: ['wings'], drumstick: ['drumsticks'],
    roll: ['rolls'], dumpling: ['dumplings'], wonton: ['wontons', 'wanton', 'wantons'],
    crab: ['crabs'], squid: ['calamari'], lamb: ['mutton'],
    onion: ['onions'], tomato: ['tomatoes'], potato: ['potatoes'],
    bean: ['beans'], nut: ['nuts'], almond: ['almonds'], cashew: ['cashews'],
    drink: ['drinks', 'beverage', 'beverages', 'refreshment', 'refreshments'],
    juice: ['juices'], chiller: ['chillers'],
    coffee: ['coffees', 'cofee', 'coffe'], tea: ['teas'],
    chocolate: ['choc', 'chocolates', 'chocalate', 'cholocalate'],
    cappuccino: ['cappucino', 'capuccino'],
    manchurian: ['manchourian', 'manchurien', 'munchurian'],
    sichuan: ['szechuan', 'szechwan', 'schezwan'],
    young: ['yung', 'yong'], mixed: ['mix'],
    strawberry: ['strawberries'], raspberry: ['raspberries'], berry: ['berries'],
    deal: ['deals', 'combo', 'combos'], appetizer: ['appetizers', 'starter', 'starters'],
    cold: ['chilled'], iced: ['ice'], roast: ['roasted'], coriander: ['corriander', 'cilantro']
  };
  for (const [word, forms] of Object.entries(variations)) {
    for (const form of [word, ...forms]) aliases.set(form, word);
  }
  const ignored = new Set(['a', 'an', 'and', 'or', 'with', 'in', 'on', 'of', 'the', 'for', 'please', 'show', 'me']);
  const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/\bchow\s*(?:mein|mien|min)\b/g, 'chow mein')
    .replace(/\b7\s*[- ]?\s*up\b/g, '7up')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  const tokens = value => normalize(value).split(' ').filter(word => word && !ignored.has(word))
    .map(word => aliases.get(word) || word);

  function tagsFor(item, category) {
    const name = normalize(item.name);
    const tags = [];
    if (category === 'HOT COFFEE') tags.push('hot drink', /chocolate/.test(name) ? '' : 'coffee');
    if (category === 'COLD COFFEE') tags.push('cold drink coffee');
    if (category === 'CHILLERS') tags.push('cold drink chiller');
    if (category === 'SEASONAL FRESH JUICE') tags.push('cold drink juice');
    if (category === 'ICED TEA' || category === 'ICE TEA') tags.push('cold drink iced tea');
    if (category === 'BEVERAGES') tags.push(/\btea\b/.test(name) ? 'hot drink' : 'cold drink');
    if (category === 'DEALS') tags.push('deal');
    if (category === 'APPETIZER') tags.push('appetizer');
    if (/\bchow mein\b/.test(name)) tags.push('noodle');
    if (/\b(?:prawns?|shrimps?|fish|squid|crabs?)\b/.test(name)) tags.push('seafood');
    if (/\bsoft drinks?\b/.test(name)) tags.push('soda cola pepsi');
    if (/\bcoke\b/.test(name)) tags.push('cola soda');
    if (/\b7up\b/.test(name)) tags.push('seven up soda');
    // Some protein choices are printed alongside prices (for example broccoli).
    tags.push(...(String(item.price).match(/\b(?:chicken|beef|prawns?)\b/gi) || []));
    return tags.join(' ');
  }

  // One insertion, deletion, substitution or adjacent key transposition.
  function oneTypoAway(a, b) {
    if (!/^[a-z]+$/.test(a) || !/^[a-z]+$/.test(b) || Math.min(a.length, b.length) < 4) return false;
    if (Math.abs(a.length - b.length) > 1) return false;
    let at = 0;
    while (at < Math.min(a.length, b.length) && a[at] === b[at]) at++;
    if (a.length === b.length) {
      return a.slice(at + 1) === b.slice(at + 1) ||
        (a[at] === b[at + 1] && a[at + 1] === b[at] && a.slice(at + 2) === b.slice(at + 2));
    }
    return a.length > b.length ? a.slice(at + 1) === b.slice(at) : a.slice(at) === b.slice(at + 1);
  }

  function createIndex(menu, translateName = name => name) {
    const groups = Object.entries(menu).map(([category, items]) => [category, items.map(item => ({
      item,
      name: tokens(item.name).join(' '),
      translated: normalize(translateName(item.name)),
      words: new Set(tokens(`${item.name} ${tagsFor(item, category)}`)),
      code: normalize(item.code).replace(/ /g, '')
    }))]);
    const vocabulary = new Set(groups.flatMap(([, items]) => items.flatMap(entry => [...entry.words])));
    const codes = new Set(groups.flatMap(([, items]) => items.map(entry => entry.code)));
    const spellings = new Map([...vocabulary].map(word => [word, word]));
    for (const [form, word] of aliases) if (vocabulary.has(word)) spellings.set(form, word);

    return query => {
      const raw = normalize(String(query).slice(0, 200));
      if (!raw) return [];
      const words = [...new Set(tokens(raw))].slice(0, 16);
      if (!words.length) return [];
      // Codes remain exact: D-1 must not accidentally include D-1A or D-10.
      const compact = raw.replace(/ /g, '');
      const dealCode = compact.replace(/^(?:deals?|combos?)(\d+[a-z]*)$/, 'd$1');
      const codeQuery = codes.has(compact) ? compact : codes.has(dealCode) ? dealCode : null;
      const candidates = words.map((word, index) => {
        const matches = new Map([[word, 3]]);
        // Only unknown words are corrected, so real terms such as rice and iced stay distinct.
        if (!vocabulary.has(word)) {
          for (const [spelling, candidate] of spellings) {
            const weight = index === words.length - 1 && word.length >= 3 && spelling.startsWith(word) ? 2 :
              oneTypoAway(word, spelling) ? 1 : 0;
            if (weight) matches.set(candidate, Math.max(matches.get(candidate) || 0, weight));
          }
        }
        return matches;
      });

      return groups.map(([category, entries]) => [category, entries.map(entry => {
        if (codeQuery) return {item: entry.item, score: entry.code === codeQuery ? 100 : 0};
        if (/[\u3400-\u9fff]/.test(raw) && entry.translated.includes(raw)) return {item: entry.item, score: 100};
        let score = 0;
        for (const matches of candidates) {
          let best = 0;
          for (const [word, weight] of matches) if (entry.words.has(word)) best = Math.max(best, weight);
          if (!best) return {item: entry.item, score: 0};
          score += best;
        }
        if (entry.name.includes(words.join(' '))) score += 1;
        return {item: entry.item, score};
      }).filter(result => result.score > 0).sort((a, b) => b.score - a.score).map(result => result.item)])
        .filter(([, items]) => items.length);
    };
  }

  window.MenuSearch = {createIndex};
})();
