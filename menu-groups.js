(() => {
  const menu = window.MAIN_MENU;
  if (!menu || !menu.EGG) return;

  const eggItems = new Map(menu.EGG.map(item => [item.code, item]));
  const move = (category, codes) => {
    menu[category].push(...codes.map(code => eggItems.get(code)).filter(Boolean));
  };

  move('CHOP SUEY', ['43A']);
  move('PRAWN', ['45', '46']);
  move('CHICKEN', ['43', '44', '46A', '47']);
  delete menu.EGG;
})();
