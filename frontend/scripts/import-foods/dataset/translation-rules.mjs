const SUBJECT_RULES = [
  [/^Water, tap/i, '自来水'], [/^Mineral water/i, '矿泉水'], [/^Water,/i, '水'],
  [/^Coffee, espresso/i, '意式浓缩咖啡'], [/^Coffee,/i, '咖啡'], [/^Tea, green/i, '绿茶'], [/^Tea,/i, '茶'],
  [/^Fruit drink, apple juice/i, '苹果汁饮料'], [/^Fruit drink, orange juice/i, '橙汁饮料'],
  [/^Salt, table/i, '食盐'], [/^Sugar, white/i, '白糖'], [/^Sugar, raw/i, '原糖'],
  [/^Sauce, soy/i, '酱油'], [/^Sauce, barbecue/i, '烧烤酱'], [/^Sauce, butter chicken/i, '黄油鸡酱'],
  [/^Sauce, fish/i, '鱼露'], [/^Sauce, hoi sin \(hoisin\)/i, '海鲜酱'], [/^Sauce, oyster/i, '蚝油'],
  [/^Dressing, French or Italian/i, '法式或意式沙拉酱'], [/^Dressing, thousand island/i, '千岛酱'],
  [/^Gravy powder/i, '肉汁粉'], [/^Mayonnaise/i, '蛋黄酱'], [/^Mustard/i, '芥末酱'],
  [/^Paste, green curry/i, '绿咖喱酱'], [/^Paste, Indian style curry/i, '印度咖喱酱'], [/^Plum, salted/i, '盐渍李子'],
  [/^Milk, cow/i, '牛奶'], [/^Yoghurt, natural, sheep's milk/i, '原味羊奶酸奶'], [/^Yoghurt,/i, '酸奶'],
  [/^Cheese, cheddar/i, '切达奶酪'], [/^Cheese, cream/i, '奶油奶酪'], [/^Cheese, parmesan/i, '帕玛森奶酪'],
  [/^Cheese, blue vein/i, '蓝纹奶酪'], [/^Cheese, bocconcini/i, '小莫扎里拉奶酪'], [/^Cheese, brie/i, '布里奶酪'],
  [/^Cheese, camembert/i, '卡芒贝尔奶酪'], [/^Cheese, cottage/i, '茅屋奶酪'], [/^Cheese, fetta \(feta\)/i, '菲达奶酪'],
  [/^Cheese, goat/i, '山羊奶酪'], [/^Cheese, haloumi \(halloumi\)/i, '哈罗米奶酪'], [/^Cheese, ricotta/i, '瑞科塔奶酪'],
  [/^Egg, chicken, white \(albumen\)/i, '鸡蛋清'], [/^Egg, chicken, yolk/i, '鸡蛋黄'], [/^Egg, chicken, whole/i, '全鸡蛋'],
  [/^Salmon, Atlantic/i, '大西洋三文鱼'], [/^Tuna,/i, '金枪鱼'], [/^Prawn,/i, '虾'],
  [/^Abalone, black lip/i, '黑边鲍鱼'], [/^Abalone, brown lip/i, '棕边鲍鱼'], [/^Abalone, green lip/i, '绿边鲍鱼'],
  [/^Barramundi/i, '金目鲈'], [/^Bassa \(basa\)/i, '巴沙鱼'], [/^Bream/i, '鲷鱼'], [/^Flathead/i, '平头鱼'],
  [/^Gemfish/i, '银鳞鲳鱼'], [/^Milkfish/i, '虱目鱼'], [/^Morwong/i, '唇指鲈'], [/^Mullet, yelloweye/i, '黄眼鲻鱼'],
  [/^Mulloway/i, '澳洲石首鱼'], [/^Mussel, blue/i, '蓝贻贝'], [/^Oyster, native/i, '澳洲本地牡蛎'],
  [/^Oyster, Pacific/i, '太平洋牡蛎'], [/^Oyster, Sydney rock/i, '悉尼岩牡蛎'], [/^Sardine, Australian/i, '澳洲沙丁鱼'],
  [/^Scallop/i, '扇贝'], [/^Shark/i, '鲨鱼'], [/^Silver perch/i, '银鲈'], [/^Snapper/i, '笛鲷'],
  [/^Squid or calamari/i, '鱿鱼'], [/^Tilapia/i, '罗非鱼'], [/^Trout, rainbow/i, '虹鳟鱼'], [/^Whiting, King George/i, '乔治王牙鳕'],
  [/^Apple, bonza/i, '邦扎苹果'], [/^Apple, fuji/i, '富士苹果'], [/^Apple, golden delicious/i, '金冠苹果'],
  [/^Apple, granny-smith/i, '青苹'], [/^Apple, jonathan/i, '红玉苹果'], [/^Apple, pink lady/i, '粉红佳人苹果'],
  [/^Apple, red delicious/i, '红蛇果'], [/^Apple, royal gala/i, '皇家嘎啦苹果'], [/^Apple, red skin/i, '红皮苹果'],
  [/^Banana, cavendish/i, '卡文迪什香蕉'], [/^Banana, lady finger or sugar/i, '小米蕉'],
  [/^Blackberry/i, '黑莓'], [/^Blueberry/i, '蓝莓'], [/^Custard apple/i, '番荔枝'], [/^Fig/i, '无花果'],
  [/^Grape, black muscatel \(muscat\)/i, '黑麝香葡萄'], [/^Grape, black sultana/i, '黑无核葡萄'],
  [/^Grape, cornichon/i, '科尼雄葡萄'], [/^Grape, green/i, '青葡萄'], [/^Grape, red globe/i, '红地球葡萄'],
  [/^Grape, waltham cross/i, '沃尔瑟姆十字葡萄'], [/^Guava/i, '番石榴'], [/^Jackfruit/i, '菠萝蜜'],
  [/^Kiwifruit, gold/i, '黄金奇异果'], [/^Kiwifruit, green \(hayward\)/i, '海沃德绿奇异果'],
  [/^Lemon/i, '柠檬'], [/^Lime/i, '青柠'], [/^Loquat/i, '枇杷'], [/^Lychee/i, '荔枝'], [/^Mango/i, '芒果'],
  [/^Melon, honey dew/i, '蜜瓜'], [/^Melon, rockmelon/i, '哈密瓜'], [/^Melon, watermelon/i, '西瓜'],
  [/^Mulberry/i, '桑葚'], [/^Nectarine, white/i, '白肉油桃'], [/^Nectarine, yellow/i, '黄肉油桃'],
  [/^Orange, navel/i, '脐橙'], [/^Orange, valencia/i, '瓦伦西亚橙'], [/^Orange,/i, '橙子'],
  [/^Papaya, red/i, '红肉木瓜'], [/^Papaya, yellow/i, '黄肉木瓜'], [/^Passionfruit/i, '百香果'], [/^Pawpaw \(papaya\)/i, '木瓜'],
  [/^Peach, white/i, '白肉桃'], [/^Peach, yellow/i, '黄肉桃'], [/^Pear, brown skin/i, '褐皮梨'], [/^Pear, green skin/i, '青皮梨'],
  [/^Pear, nashi/i, '亚洲梨'], [/^Pear, Packham's triumph/i, '帕克汉姆梨'],
  [/^Rice, brown/i, '糙米饭'], [/^Rice, white/i, '白米饭'], [/^Rice, wild/i, '野米饭'],
  [/^Bread roll/i, '面包卷'], [/^Bread, damper/i, '澳式苏打面包'], [/^Bread,/i, '面包'], [/^Bagel/i, '贝果'],
  [/^Oats, rolled/i, '燕麦片'], [/^Pasta,/i, '意大利面'], [/^Noodle, rice stick/i, '米粉'], [/^Noodle, soba/i, '荞麦面'],
  [/^Noodle,/i, '面条'], [/^Barley, pearl/i, '珍珠大麦'], [/^Buckwheat groats/i, '荞麦粒'], [/^Cornmeal \(polenta\)/i, '玉米糊'],
  [/^Couscous/i, '库斯库斯'], [/^Millet/i, '小米'], [/^Quinoa/i, '藜麦'], [/^Sago/i, '西米'], [/^Semolina/i, '粗粒小麦粉'],
  [/^Spelt/i, '斯佩尔特小麦'], [/^Tapioca/i, '木薯珍珠'], [/^Bulgur/i, '布格麦'], [/^Flour, gluten free/i, '无麸质面粉'],
  [/^Flour, wheat, white/i, '白小麦面粉'], [/^Flour, wheat, wholemeal/i, '全麦面粉'], [/^Amaranth, grain/i, '苋米'],
  [/^Tofu/i, '豆腐'], [/^Chickpea/i, '鹰嘴豆'], [/^Lentil, French/i, '法国扁豆'], [/^Lentil, green/i, '绿扁豆'],
  [/^Lentil, red/i, '红扁豆'], [/^Lentil,/i, '扁豆'], [/^Bean, haricot/i, '菜豆'], [/^Bean, lima/i, '利马豆'],
  [/^Bean, red kidney/i, '红腰豆'], [/^Bean, soya \(soy\)/i, '大豆'], [/^Pea, split/i, '干豌豆瓣'], [/^Lupin/i, '羽扇豆'],
  [/^Sausage, vegetarian style/i, '素香肠'], [/^Meat alternative, legume and\/or vegetable base/i, '豆类蔬菜肉替代品'],
  [/^Meat alternative, mycoprotein\/fungus base/i, '真菌蛋白肉替代品'], [/^Meat alternative, protein \(soy\/wheat\/pea\) base/i, '植物蛋白肉替代品'],
  [/^Chicken, breast/i, '鸡胸肉'], [/^Chicken, drumstick/i, '鸡小腿肉'], [/^Chicken, mince/i, '鸡肉末'],
  [/^Chicken, skin/i, '鸡皮'], [/^Chicken, thigh/i, '鸡腿肉'], [/^Chicken, wing/i, '鸡翅肉'],
  [/^Beef, diced/i, '牛肉丁'], [/^Beef, mince/i, '牛肉末'], [/^Beef, rump steak/i, '牛臀排'],
  [/^Beef, silverside roast/i, '牛后腿外侧烤肉'], [/^Beef, sirloin steak/i, '牛西冷排'], [/^Beef, stir-fry strips/i, '牛肉炒条'],
  [/^Beef, topside roast/i, '牛后腿内侧烤肉'], [/^Buffalo, riverine, cube roll/i, '河水牛眼肉'], [/^Buffalo, riverine, topside/i, '河水牛后腿内侧肉'],
  [/^Buffalo, swamp, cube roll/i, '沼泽水牛眼肉'], [/^Buffalo, swamp, topside/i, '沼泽水牛后腿内侧肉'],
  [/^Camel, cube roll/i, '骆驼眼肉'], [/^Camel, rump/i, '骆驼臀肉'], [/^Camel, steak/i, '骆驼排'],
  [/^Duck, breast/i, '鸭胸肉'], [/^Duck, lean flesh/i, '鸭瘦肉'], [/^Duck, skin & fat/i, '鸭皮和脂肪'],
  [/^Emu, fan fillet/i, '鸸鹋扇形里脊'], [/^Emu, steak/i, '鸸鹋排'], [/^Goat, leg/i, '山羊腿肉'], [/^Goat, loin/i, '山羊腰肉'],
  [/^Lamb, diced/i, '羊肉丁'], [/^Lamb, eye of loin/i, '羊腰眼肉'], [/^Lamb, fillet/i, '羊里脊'],
  [/^Lamb, leg roast/i, '羊腿烤肉'], [/^Lamb, loin chop/i, '羊腰排'], [/^Lamb, mince/i, '羊肉末'], [/^Lamb, stir-fry strips/i, '羊肉炒条'],
  [/^Ostrich, fan fillet/i, '鸵鸟扇形里脊'], [/^Ostrich, moon steak/i, '鸵鸟月牙排'], [/^Pigeon \(squab\)/i, '乳鸽'],
  [/^Pork, belly/i, '猪五花肉'], [/^Pork, butterfly steak/i, '猪蝴蝶排'], [/^Pork, fillet/i, '猪里脊'],
  [/^Pork, loin chop/i, '猪腰排'], [/^Pork, loin roast/i, '猪腰肉烤块'], [/^Pork, medallion or loin steak/i, '猪里脊圆排'],
  [/^Pork, round mini roast/i, '猪后腿小烤肉'], [/^Pork, rump steak/i, '猪臀排'],
  [/^Nut, almond/i, '杏仁'], [/^Nut, brazil/i, '巴西坚果'], [/^Nut, cashew/i, '腰果'], [/^Nut, chestnut/i, '栗子'],
  [/^Nut, hazelnut/i, '榛子'], [/^Nut, macadamia/i, '夏威夷果'], [/^Nut, peanut/i, '花生'], [/^Nut, pecan/i, '碧根果'],
  [/^Nut, pine/i, '松子'], [/^Nut, pistachio/i, '开心果'], [/^Nut, walnut/i, '核桃'], [/^Seed, sesame/i, '芝麻'], [/^Peanut butter/i, '花生酱'],
  [/^Oil, olive/i, '橄榄油'], [/^Butter/i, '黄油'], [/^Fat, solid, vegetable oil based/i, '植物油固体脂肪'], [/^Ghee/i, '酥油'],
  [/^Oil, blend of monounsaturated vegetable oils/i, '单不饱和植物调和油'], [/^Oil, blend of polyunsaturated vegetable oils/i, '多不饱和植物调和油'],
  [/^Oil, canola/i, '菜籽油'], [/^Oil, copha/i, '椰油起酥油'], [/^Oil, grapeseed/i, '葡萄籽油'], [/^Oil, maize/i, '玉米油'],
  [/^Oil, peanut/i, '花生油'], [/^Oil, rice bran/i, '米糠油'], [/^Oil, safflower/i, '红花籽油'],
  [/^Potato,/i, '土豆'], [/^Sweet potato,/i, '红薯'], [/^Corn,/i, '玉米'],
  [/^Spinach, baby/i, '嫩菠菜'], [/^Spinach, Mature English/i, '成熟英国菠菜'], [/^Spinach, water/i, '空心菜'], [/^Spinach,/i, '菠菜'],
  [/^Broccolini/i, '嫩茎西兰花'], [/^Broccoli/i, '西兰花'], [/^Tomato, cherry/i, '樱桃番茄'], [/^Tomato,/i, '番茄'],
  [/^Carrot, baby/i, '小胡萝卜'], [/^Carrot,/i, '胡萝卜'], [/^Avocado, hass/i, '哈斯牛油果'], [/^Avocado, shepard/i, '谢泼德牛油果'],
  [/^Capsicum, green/i, '青彩椒'], [/^Capsicum, red/i, '红彩椒'], [/^Capsicum, yellow/i, '黄彩椒'], [/^Cauliflower/i, '花椰菜'],
  [/^Celeriac/i, '根芹菜'], [/^Chicory/i, '菊苣'], [/^Chilli \(chili\), green/i, '青辣椒'], [/^Chilli \(chili\), red/i, '红辣椒'],
  [/^Choko/i, '佛手瓜'], [/^Cucumber, common/i, '普通黄瓜'], [/^Cucumber, Lebanese/i, '黎巴嫩黄瓜'], [/^Cucumber, telegraph/i, '长黄瓜'],
  [/^Eggplant/i, '茄子'], [/^Endive/i, '苦苣'], [/^Garlic/i, '大蒜'], [/^Ginger/i, '生姜'], [/^Leek/i, '韭葱'],
  [/^Lettuce, cos/i, '罗马生菜'], [/^Lettuce, iceberg/i, '冰山生菜'], [/^Lettuce, mignonette/i, '奶油生菜'],
  [/^Melon, bitter/i, '苦瓜'], [/^Melon, hairy/i, '节瓜'], [/^Mushroom/i, '蘑菇'], [/^Okra/i, '秋葵'],
  [/^Onion, mature, red skinned/i, '红洋葱'], [/^Onion, mature, brown skinned/i, '黄洋葱'], [/^Onion, spring/i, '青葱'],
  [/^Parsnip/i, '欧防风'], [/^Pumpkin, butternut/i, '奶油南瓜'], [/^Pumpkin, golden nugget/i, '金块南瓜'], [/^Pumpkin,/i, '南瓜'],
  [/^Radish, red skinned/i, '红皮萝卜'], [/^Radish, white skinned/i, '白萝卜'], [/^Rocket/i, '芝麻菜'], [/^Shallot/i, '红葱头'],
  [/^Silverbeet/i, '瑞士甜菜'], [/^Squash, button/i, '小圆南瓜'], [/^Squash, scallopini/i, '飞碟瓜'], [/^Swede/i, '芜菁甘蓝'],
  [/^Taro/i, '芋头'], [/^Watercress/i, '西洋菜'], [/^Beetroot/i, '甜菜根'], [/^Cassava, white flesh/i, '白肉木薯'], [/^Cassava, yellow flesh/i, '黄肉木薯']
];

const QUALIFIER_RULES = [
  [/\bwhite wheat flour & egg\b/gi, '白小麦粉和鸡蛋'], [/\bwhite wheat flour & spinach\b/gi, '白小麦粉和菠菜'],
  [/\bpearl or seed style\b/gi, '珍珠或籽粒状'], [/purchased as 'instant'/gi, '即食型'],
  [/\bfrom white Jackaroo flour\b/gi, '白杰卡鲁小麦粉制'], [/\bfrom white flour\b/gi, '白面粉制'],
  [/\bfrom rye flour\b/gi, '黑麦粉制'], [/\bfrom wholemeal flour\b/gi, '全麦粉制'],
  [/\bfresh on cob\b/gi, '新鲜带芯'], [/\borange flesh\b/gi, '橙肉'], [/\bpurple flesh\b/gi, '紫肉'],
  [/\bwhite flesh\b/gi, '白肉'], [/\bstir-fried\b/gi, '炒制'],
  [/\bskim \(~?([\d.]+)% fat\)/gi, '脱脂（$1%脂肪）'],
  [/\bcanned, sweetened, condensed\b/gi, '甜炼乳罐装'], [/\bcanned, evaporated\b/gi, '淡炼乳罐装'],
  [/\btraditional \(>([\d.]+)% fat\)/gi, '传统型（脂肪高于$1%）'],
  [/\bdry mix\b/gi, '干粉'], [/\bAfrican pride\b/gi, '非洲骄傲品种'], [/\bHawaiian\b/gi, '夏威夷品种'],
  [/\bcoliban\b/gi, '科利班品种'], [/\bdesiree\b/gi, '德西蕾品种'], [/\bpontiac\b/gi, '庞蒂亚克品种'],
  [/\bsebago\b/gi, '塞巴戈品种'], [/\bnew\b/gi, '新土豆'],
  [/\bsweetened\b/gi, '加糖'], [/\bcondensed\b/gi, '浓缩'],
  [/\badded fibre and vitamins B1 & folate & Fe\b/gi, '添加膳食纤维、维生素B1、叶酸和铁'],
  [/\bon cob\b/gi, '带芯'],
  [/\baquacultured\b/gi, '养殖'], [/\bwild\b/gi, '野生'], [/\bfillet\b/gi, '鱼柳'],
  [/\bflesh\b/gi, '肉'], [/\bwhole\b/gi, '整只'], [/\braw \(green\)\b/gi, '生'],
  [/\braw or blanched\b/gi, '生或焯水'], [/\braw\b/gi, '生'], [/\buncooked\b/gi, '未烹调'],
  [/\bhard-boiled\b/gi, '水煮熟'], [/\bboiled from dry\b/gi, '干制后水煮'], [/\bboiled\b/gi, '水煮'],
  [/\bcooked in water\b/gi, '水煮'], [/\bcooked\b/gi, '熟'], [/\bsteamed\b/gi, '蒸制'],
  [/\bbaked\b/gi, '烘烤'], [/\broasted\b/gi, '烤制'], [/\bfried\b/gi, '煎制'], [/\bstir-fried\b/gi, '炒制'],
  [/\bmicrowaved\b/gi, '微波加热'], [/\bsoaked in water\b/gi, '水泡'], [/\bsoaked\b/gi, '浸泡'],
  [/\bdrained\b/gi, '沥干'], [/\bundrained\b/gi, '未沥干'], [/\bwithout skin\b/gi, '去皮'],
  [/\bunpeeled\b/gi, '带皮'], [/\bpeeled\b/gi, '去皮'], [/\bwith skin\b/gi, '带皮'],
  [/\brind removed\b/gi, '去皮'], [/\blean flesh\b/gi, '去明显脂肪'], [/\blean\b/gi, '瘦'],
  [/\bskin & fat\b/gi, '皮和脂肪'], [/\bregular fat\b/gi, '全脂'], [/\breduced fat\b/gi, '低脂'],
  [/\bskim\b/gi, '脱脂'], [/\bhigher fat\b/gi, '较高脂肪'], [/\blower fat\b/gi, '较低脂肪'],
  [/\bno added fat or salt\b/gi, '无加油脂或盐'], [/\bno added fat\b/gi, '无加油脂'],
  [/\bno added salt\b/gi, '无加盐'], [/\bwithout milk\b/gi, '不加奶'], [/\bunsalted\b/gi, '无盐'],
  [/\bsalted\b/gi, '加盐'], [/\breduced salt\b/gi, '减盐'], [/\bnon-iodised\b/gi, '未加碘'], [/\biodised\b/gi, '加碘'],
  [/\bcanned in water\b/gi, '水浸罐装'], [/\bcanned\b/gi, '罐装'], [/\bdried\b/gi, '干制'], [/\bdry\b/gi, '干制'],
  [/\bpowder\b/gi, '粉末'], [/\bdry mix\b/gi, '干粉'], [/\bfluid\b/gi, '液态'], [/\bcommercial\b/gi, '市售'],
  [/\bfresh\b/gi, '新鲜'], [/\bplain\b/gi, '原味'], [/\bunflavoured\b/gi, '原味'], [/\bnatural\b/gi, '原味'],
  [/\binstant\b/gi, '即食'], [/\bfrom instant coffee powder\b/gi, '速溶咖啡粉冲泡'],
  [/\bfrom ground coffee beans\b/gi, '咖啡豆研磨冲泡'], [/\bblack\b/gi, '黑'], [/\bgreen\b/gi, '绿'],
  [/\bprepared from leaf or teabags\b/gi, '茶叶或茶包冲泡'], [/\bbrewed from leaf or teabags\b/gi, '茶叶或茶包冲泡'],
  [/\bwhite wheat flour\b/gi, '白小麦粉'], [/\bwholemeal wheat flour\b/gi, '全麦粉'], [/\bwheat with egg\b/gi, '鸡蛋小麦'],
  [/\bwheat\b/gi, '小麦'], [/\bgluten free\b/gi, '无麸质'], [/\blegume based\b/gi, '豆类制'],
  [/\bwith egg\b/gi, '含鸡蛋'], [/\bwith spinach\b/gi, '含菠菜'], [/\bfresh on cob\b/gi, '新鲜带芯'],
  [/\bkernels\b/gi, '玉米粒'], [/\bpurchased frozen\b/gi, '冷冻购入'], [/\borange flesh\b/gi, '橙肉'],
  [/\bpurple flesh\b/gi, '紫肉'], [/\bwhite flesh\b/gi, '白肉'], [/\bpale skin\b/gi, '浅色皮'],
  [/\bred skin\b/gi, '红皮'], [/\bbrown skin\b/gi, '褐皮'], [/\bgreen skin\b/gi, '青皮'],
  [/\byellow flesh\b/gi, '黄肉'], [/\bwhite\b/gi, '白'], [/\bpurple\b/gi, '紫色'],
  [/\bmature\b/gi, '成熟'], [/\bbaby\b/gi, '嫩'], [/\bcommon\b/gi, '普通'],
  [/\bfirm\b/gi, '硬质'], [/\bsoft\b/gi, '软质'], [/\bprocessed\b/gi, '再制'], [/\bfinely grated\b/gi, '细磨碎'],
  [/\badded vitamin D\b/gi, '添加维生素D'], [/\bvitamin D enhanced\b/gi, '强化维生素D'],
  [/\badded omega 3 polyunsaturates\b/gi, '添加欧米伽-3多不饱和脂肪'], [/\bomega-3 polyunsaturate enriched\b/gi, '强化欧米伽-3多不饱和脂肪'],
  [/\bunfortified\b/gi, '未强化'], [/\badded Fe, Zn and vitamin B12\b/gi, '添加铁、锌和维生素B12'],
  [/\badded sugar & salt\b/gi, '加糖加盐'], [/\bwith oil\b/gi, '用油'], [/\bsmooth & crunchy\b/gi, '顺滑或颗粒型'],
  [/\bclarified butter\b/gi, '澄清黄油'], [/\bsolid\b/gi, '固态'], [/\bvegetable oil based\b/gi, '植物油基'],
  [/\bregular\b/gi, '普通'], [/\btraditional\b/gi, '传统'], [/\bcream style\b/gi, '乳脂状'],
  [/\bgranulated or lump\b/gi, '砂糖或方糖'], [/\bfinely\b/gi, '细'], [/\bfrom white flour\b/gi, '白面粉制'],
  [/\bfrom wholemeal flour\b/gi, '全麦粉制'], [/\bmixed grain\b/gi, '杂粮'], [/\bsour dough\b/gi, '酸面团'],
  [/\bItalian-style\b/gi, '意式'], [/\bTurkish\b/gi, '土耳其式'], [/\btoasted\b/gi, '烤制'],
  [/\badded fibre\b/gi, '添加膳食纤维'], [/\bhomemade\b/gi, '自制'], [/\bas purchased\b/gi, '购入状态'],
  [/\bdehulled\b/gi, '去壳'], [/\bhulled\b/gi, '去壳'], [/\bflakes\b/gi, '片状'], [/\bskinless\b/gi, '去皮'],
  [/\bred skinned\b/gi, '红皮'], [/\bbrown skinned\b/gi, '褐皮'], [/\bwhite skinned\b/gi, '白皮'],
  [/\bregular fat \(~?([\d.]+)%\)/gi, '全脂（$1%）'], [/\breduced fat \(~?([\d.]+)%\)/gi, '低脂（$1%）'],
  [/\blow fat \(<?([\d.]+)%\)/gi, '低脂（$1%）'], [/\b([\d.]+)% fat\b/gi, '$1%脂肪'],
  [/\(soy\)/gi, ''], [/\(albumen\)/gi, ''], [/\(green\)/gi, ''], [/\(hayward\)/gi, '海沃德'],
  [/\bfrom dry\b/gi, '由干制品烹调'], [/\bor rice cooker\b/gi, '或电饭锅烹制'],
  [/\bno added sugar\b/gi, '无加糖'], [/\badded sugar\b/gi, '加糖'], [/\blactose free\b/gi, '无乳糖'],
  [/\bcanned, evaporated\b/gi, '淡炼乳罐装'], [/\bcanned, sweetened, condensed\b/gi, '甜炼乳罐装'],
  [/\bpowder, regular fat\b/gi, '全脂奶粉'], [/\bpowder, skim\b/gi, '脱脂奶粉'],
  [/\bwhole\b/gi, '完整'], [/\bcomposite\b/gi, '混合样本']
];

export function translateFoodName(nameEn) {
  const subjectRule = SUBJECT_RULES.find(([pattern]) => pattern.test(nameEn));
  if (!subjectRule) {
    return {
      name_zh: '未识别食品（需专业复核）',
      translation_status: 'needs_review',
      translation_note: `未识别食品主体；源名称包含无法从集中词典可靠翻译的类别`
    };
  }

  const [subjectPattern, subject] = subjectRule;
  let remainder = nameEn.replace(subjectPattern, '').replace(/^[,\s]+/, '');
  for (const [pattern, replacement] of QUALIFIER_RULES) {
    remainder = remainder.replace(pattern, replacement);
  }
  remainder = remainder
    .replace(/[&/]/g, '、')
    .replace(/\s*,\s*/g, '、')
    .replace(/\s+/g, '')
    .replace(/、+/g, '、')
    .replace(/^、|、$/g, '');

  const englishWords = remainder.match(/[A-Za-z]{2,}/g) || [];
  if (englishWords.length > 0) {
    return {
      name_zh: `${subject}（具体限定信息待专业复核）`,
      translation_status: 'needs_review',
      translation_note: `未识别限定词：${[...new Set(englishWords)].join(', ')}`
    };
  }

  return {
    name_zh: remainder ? `${subject}（${remainder}）` : subject,
    translation_status: 'ready',
    translation_note: '由集中食品主体词典和状态限定词规则生成'
  };
}

const ALIAS_RULES = [
  [/^(?:普通|樱桃)?番茄/, ['西红柿']], [/土豆/, ['马铃薯', '洋芋']], [/红薯/, ['番薯', '地瓜']],
  [/^[青红黄]彩椒/, ['甜椒', '灯笼椒']], [/奶酪/, ['芝士']], [/酸奶/, ['优格']],
  [/^意大利面/, ['意面']], [/鹰嘴豆/, ['鸡豆']], [/西兰花/, ['绿花椰菜']],
  [/^花生（/, ['落花生']], [/^玉米（/, ['苞米']], [/^金枪鱼/, ['鲔鱼']]
];

export function aliasesForTranslation(translation) {
  const aliases = [];
  for (const [pattern, values] of ALIAS_RULES) {
    if (pattern.test(translation.name_zh)) aliases.push(...values);
  }
  if (/^虾仁/.test(translation.name_zh)) aliases.push('虾仁');
  return [...new Set(aliases)].filter((alias) => alias && alias !== translation.name_zh);
}
