(() => {
  const corrections = {
    main: {
      '32B': 'Kung Pao Fish',
      '42A': 'Kung Pao Prawn',
      '43': 'Egg Foo Young',
      '44': 'Chicken Foo Young',
      '45': 'Prawn Foo Young',
      '46': 'Chicken and Prawn Foo Young',
      '47': 'Chicken with Mushroom and Foo Young',
      '56B': 'Kung Pao Chicken',
      '60B': 'Pan-Fried Wings with Garlic (Sichuan Style)',
      '63E': 'Chicken Pot with Potato Chips (or Beef)',
      '65D': 'Kung Pao Beef',
      '87B': 'Shao Mai',
      '97': 'Mapo Tofu',
      'J5': 'Caramel Latte',
      'J6': 'Hazelnut Latte',
      'J7': 'Hot Chocolate',
      'H1': 'Frozen Mochaccino',
      'H5': 'Cookies and Cream',
      'U2': 'Mixed Berry'
    },
    deals: {
      'D-3C': 'Kung Pao Fish and Egg Fried Rice',
      'D-6': 'Chicken Manchurian, Chicken Drumstick & Egg Fried Rice',
      'D-6A': 'Chicken Manchurian and Egg Fried Rice',
      'D-6B': 'Chicken Chow Mein and Chicken Manchurian',
      'D-7': 'Roasted Chicken with Mixed Vegetables & Egg Fried Rice',
      'D-8A': 'Kung Pao Chicken & Egg Fried Rice',
      'D-12A': 'Kung Pao Prawn with Egg Fried Rice',
      'D-16B': 'Sweet and Sour Crispy Chicken / Beef / Fish with Chicken Chow Mein',
      'D-16E': 'Mongolian Beef / Chicken with Chicken Chow Mein',
      'D-19': 'Dumplings (Steamed, Boiled, or Fried)',
      'U2': 'Mixed Berry'
    }
  };

  const apply = (menu, names) => {
    Object.values(menu).flat().forEach(item => {
      if (names[item.code]) item.name = names[item.code];
    });
  };

  apply(window.MAIN_MENU, corrections.main);
  apply(window.DEAL_MENU, corrections.deals);

  if (window.DEAL_MENU['ICE TEA']) {
    window.DEAL_MENU['ICED TEA'] = window.DEAL_MENU['ICE TEA'];
    delete window.DEAL_MENU['ICE TEA'];
  }
})();
