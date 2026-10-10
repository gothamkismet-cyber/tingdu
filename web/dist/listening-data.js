// Original short listening materials. Text-to-speech uses the learner's selected device voice.
const segment = (speaker, text, translation) => ({ speaker, text, translation });
const question = (prompt, options, answer, explanation) => ({ prompt, options, answer, explanation });
const lesson = (id, language, title, kind, segments, questions) => ({
  id, language, title, kind, level: '基础', segments,
  questions: questions.map((item, index) => ({ id: `${id}-q${index + 1}`, ...item }))
});

export const listeningLessons = [
  lesson('lc-en-station', 'en', '车站问路', 'dialogue', [
    segment('旅客', 'Excuse me. Which platform does the train to Oxford leave from?', '打扰一下，去牛津的列车从哪个站台发车？'),
    segment('工作人员', 'Platform four. The next train leaves at ten thirty.', '四号站台。下一班列车十点半发车。'),
    segment('旅客', 'Thank you. Can I buy a ticket on the train?', '谢谢。我可以上车买票吗？'),
    segment('工作人员', 'Please buy it from the ticket machine first. It is next to the entrance.', '请先在售票机上买票。售票机就在入口旁边。')
  ], [
    question('旅客要去哪里？', ['伦敦', '牛津', '曼彻斯特', '剑桥'], 1, '旅客问的是 the train to Oxford，即去牛津的列车。'),
    question('下一班列车几点发车？', ['十点整', '十点十五分', '十点半', '十一点半'], 2, '工作人员说 ten thirty，即 10:30。'),
    question('旅客应该先在哪里买票？', ['入口旁的售票机', '列车上', '四号站台的商店', '车站外的书店'], 0, '工作人员要求先在 ticket machine 买票，并说明它在入口旁。')
  ]),
  lesson('lc-en-cafe', 'en', '咖啡店点单', 'dialogue', [
    segment('店员', 'Good morning. What would you like?', '早上好，您想点什么？'),
    segment('顾客', 'A small coffee and a cheese sandwich, please.', '请给我一杯小杯咖啡和一份奶酪三明治。'),
    segment('店员', 'The coffee is three pounds and the sandwich is five pounds. Would you like to eat here?', '咖啡三英镑，三明治五英镑。您在这里用餐吗？'),
    segment('顾客', 'No, to take away, please. I need to get back to work.', '不，打包带走。我得回去工作。')
  ], [
    question('顾客点了什么饮品？', ['热茶', '大杯咖啡', '橙汁', '小杯咖啡'], 3, '顾客说 a small coffee，即小杯咖啡。'),
    question('咖啡和三明治一共多少钱？', ['五英镑', '八英镑', '三英镑', '十英镑'], 1, '咖啡三英镑加三明治五英镑，共八英镑。'),
    question('顾客为什么要打包？', ['需要回去工作', '店里没有座位', '要去赶火车', '想在公园吃'], 0, '顾客说 I need to get back to work，说明要返回工作地点。')
  ]),
  lesson('lc-en-meeting', 'en', '调整见面安排', 'dialogue', [
    segment('Emma', 'Ben, can we meet at the library on Saturday morning?', '本，我们周六上午在图书馆见面好吗？'),
    segment('Ben', 'Sorry, I have a swimming class then. How about two in the afternoon?', '不好意思，我那时有游泳课。下午两点怎么样？'),
    segment('Emma', 'That works. I will bring my laptop. Could you bring the notes from our last class?', '可以。我会带笔记本电脑。你能带上一次课的笔记吗？'),
    segment('Ben', 'Of course. See you at the library entrance at two.', '当然。两点在图书馆入口见。')
  ], [
    question('两人最终约在什么时候见面？', ['周六上午', '周日上午', '周六下午两点', '周日下午两点'], 2, 'Ben 提议下午两点，Emma 同意；日期仍是最开始说的周六。'),
    question('Ben 上午有什么安排？', ['游泳课', '工作会议', '去书店', '修电脑'], 0, 'Ben 说 I have a swimming class then。'),
    question('Emma 请 Ben 带什么？', ['笔记本电脑', '午餐', '图书证', '上一次课的笔记'], 3, 'Emma 自己带电脑，请 Ben 带 the notes from our last class。')
  ]),
  lesson('lc-en-weekend', 'en', '一次周末出行', 'passage', [
    segment('叙述', 'Last Sunday, Mia went to a small town with her brother. They took the bus because the train tickets were expensive.', '上周日，米娅和哥哥去了一个小镇。他们乘公交车去，因为火车票太贵。'),
    segment('叙述', 'In the morning, they visited a history museum. After lunch, it began to rain, so they went to a bookshop instead of the park.', '上午他们参观了历史博物馆。午饭后开始下雨，所以他们没有去公园，而是去了书店。'),
    segment('叙述', 'Mia bought a book about birds. They returned home at six and cooked dinner together.', '米娅买了一本关于鸟类的书。他们六点回到家，一起做了晚饭。')
  ], [
    question('他们为什么乘公交车？', ['公交车速度更快', '火车票较贵', '车站关闭了', '哥哥不喜欢坐火车'], 1, '材料明确说 because the train tickets were expensive。'),
    question('下雨后他们去了哪里？', ['公园', '饭店', '车站', '书店'], 3, '他们去了 a bookshop instead of the park，用书店替代了公园。'),
    question('米娅买的书与什么有关？', ['鸟类', '烹饪', '历史', '火车'], 0, 'Mia bought a book about birds，书的主题是鸟类。')
  ]),
  lesson('lc-en-announcement', 'en', '校园活动通知', 'passage', [
    segment('通知', 'Good afternoon, everyone. Our school music club will hold a concert this Friday in the main hall.', '大家下午好。学校音乐社团本周五将在大礼堂举办音乐会。'),
    segment('通知', 'The concert starts at seven in the evening, but the doors open at six thirty. Tickets are free for students.', '音乐会晚上七点开始，六点半可以入场。学生免费。'),
    segment('通知', 'Please bring your student card. Food and drinks are not allowed in the hall. You can buy snacks outside after the concert.', '请带好学生证。礼堂内禁止饮食，演出结束后可以在外面买零食。')
  ], [
    question('音乐会在哪里举行？', ['学校体育馆', '图书馆', '大礼堂', '社团教室'], 2, '通知说 in the main hall，即大礼堂。'),
    question('几点可以入场？', ['晚上六点半', '晚上七点', '下午五点半', '晚上七点半'], 0, '开门时间是 six thirty；seven 是演出开始时间。'),
    question('学生需要带什么？', ['零食', '乐器', '现金', '学生证'], 3, '通知要求 Please bring your student card，学生可免费入场。')
  ]),
  lesson('lc-en-routine', 'en', '新的学习习惯', 'passage', [
    segment('叙述', 'Leo used to study English late at night, but he often felt tired. Now he studies for twenty minutes before breakfast.', '里奥以前常在深夜学英语，但经常觉得疲倦。现在他在早餐前学习二十分钟。'),
    segment('叙述', 'He listens to a short story first and writes down three new words. On his way to work, he listens to the same story again.', '他先听一个小故事，再记下三个新单词。上班途中，他会再听一遍同一个故事。'),
    segment('叙述', 'On Fridays, he reviews the words from the week with a friend. He does not try to learn a long list every day.', '每周五，他和一位朋友复习本周的单词。他不会每天都尝试记一长串单词。')
  ], [
    question('里奥现在什么时候学习？', ['午饭后', '早餐前', '深夜', '工作会议中'], 1, '现在的学习时间是 before breakfast；深夜是过去的习惯。'),
    question('上班途中，他会做什么？', ['写一篇故事', '学习十个新单词', '再听同一个故事', '给朋友打电话'], 2, 'he listens to the same story again，说明他重听同一材料。'),
    question('他每周五和朋友一起做什么？', ['复习本周单词', '看英文电影', '准备早餐', '写工作报告'], 0, '材料说 reviews the words from the week with a friend。')
  ]),
  lesson('lc-ja-station', 'ja', '车站询问', 'dialogue', [
    segment('旅客', 'すみません。京都行きの電車は何番線ですか。', '打扰一下，去京都的电车在几号站台？'),
    segment('工作人员', '三番線です。次の電車は十時十五分に出ます。', '三号站台。下一班车十点十五分出发。'),
    segment('旅客', 'ありがとうございます。京都までどのくらいかかりますか。', '谢谢。到京都要多长时间？'),
    segment('工作人员', '四十分ぐらいです。切符はあちらの券売機で買えます。', '大约四十分钟。车票可以在那边的售票机购买。')
  ], [
    question('去京都的电车在几号站台？', ['一号', '二号', '三号', '四号'], 2, '工作人员说「三番線です」，即三号站台。'),
    question('下一班电车几点出发？', ['十点十五分', '十点半', '十一点十五分', '十点四十分'], 0, '「十時十五分」是十点十五分；四十分钟是路程用时。'),
    question('到京都大约需要多久？', ['十五分钟', '半小时', '一小时', '四十分钟'], 3, '「四十分ぐらい」表示大约四十分钟。')
  ]),
  lesson('lc-ja-lunch', 'ja', '午餐点单', 'dialogue', [
    segment('店员', 'いらっしゃいませ。ご注文はお決まりですか。', '欢迎光临，您想好点什么了吗？'),
    segment('顾客', '魚の定食を一つお願いします。ご飯は少なめにしてください。', '请给我一份鱼套餐。米饭请少放一点。'),
    segment('店员', 'かしこまりました。お飲み物はいかがですか。', '好的。需要喝点什么吗？'),
    segment('顾客', '温かいお茶をお願いします。食事の後で出してください。', '请给我热茶。请在饭后端上来。')
  ], [
    question('顾客点了哪种套餐？', ['鸡肉套餐', '鱼套餐', '牛肉套餐', '蔬菜套餐'], 1, '顾客说「魚の定食を一つ」，即一份鱼套餐。'),
    question('顾客对米饭有什么要求？', ['多一些', '不要米饭', '少一些', '换成面条'], 2, '「少なめにしてください」是请少放一点。'),
    question('热茶应该什么时候端上来？', ['饭后', '上菜前', '与米饭同时', '不需要端上来'], 0, '「食事の後で」明确表示饭后。')
  ]),
  lesson('lc-ja-library', 'ja', '图书馆约定', 'dialogue', [
    segment('田中', '佐藤さん、明日の午後、一緒に図書館で勉強しませんか。', '佐藤，明天下午一起去图书馆学习好吗？'),
    segment('佐藤', 'いいですね。二時はどうですか。午前中は病院に行きます。', '好呀。两点怎么样？我上午要去医院。'),
    segment('田中', '分かりました。駅の前ではなく、図書館の入口で会いましょう。', '好的。我们不在车站前见，而在图书馆入口见。'),
    segment('佐藤', 'はい。私は日本語の辞書を持っていきます。', '好的。我会带日语词典过去。')
  ], [
    question('两人计划什么时候见面？', ['明天上午两点', '今天下午两点', '明天下午三点', '明天下午两点'], 3, '田中先说「明日の午後」，佐藤提议「二時」。'),
    question('两人在哪里见面？', ['车站前', '图书馆入口', '医院门口', '教室里'], 1, '「駅の前ではなく」否定了车站前，确定地点为图书馆入口。'),
    question('佐藤会带什么？', ['日语词典', '便当', '笔记本电脑', '地图'], 0, '佐藤说「日本語の辞書を持っていきます」。')
  ]),
  lesson('lc-ja-weekend', 'ja', '周日的活动', 'passage', [
    segment('叙述', '日曜日、山田さんは妹と動物園に行きました。家からバスで三十分かかりました。', '星期天，山田和妹妹去了动物园。从家乘公交车花了三十分钟。'),
    segment('叙述', '午前中はパンダやゾウを見ました。昼ご飯は、お母さんが作ったお弁当を食べました。', '上午他们看了熊猫和大象。午饭吃的是妈妈做的便当。'),
    segment('叙述', '午後は雨が降ったので、早く帰りました。家に着いてから、動物の絵を描きました。', '下午因为下雨，他们提早回家。到家后，他们画了动物的画。')
  ], [
    question('山田和谁一起去了动物园？', ['妈妈', '朋友', '妹妹', '老师'], 2, '「妹と」表示和妹妹一起。妈妈出现在便当的描述中。'),
    question('他们中午吃了什么？', ['妈妈做的便当', '餐馆的套餐', '自己买的面包', '动物园的拉面'], 0, '「お母さんが作ったお弁当」表示妈妈做的便当。'),
    question('他们为什么提早回家？', ['身体不舒服', '公交车停运', '动物园关门', '下午下雨了'], 3, '「雨が降ったので」明确说明提早回家的原因是下雨。')
  ]),
  lesson('lc-ja-notice', 'ja', '图书馆通知', 'passage', [
    segment('通知', '図書館からのお知らせです。今週の金曜日は、館内の掃除のため、午後三時に閉まります。', '这是图书馆的通知。本周五因馆内清扫，下午三点闭馆。'),
    segment('通知', '本を返す方は、入口の右にある返却ボックスをご利用ください。', '还书的读者请使用入口右侧的还书箱。'),
    segment('通知', '土曜日は、いつもどおり午前九時から開きます。皆様のご協力をお願いいたします。', '周六照常从上午九点开馆。感谢大家的配合。')
  ], [
    question('周五图书馆为什么提前关闭？', ['举行音乐会', '进行馆内清扫', '更换工作人员', '修理入口'], 1, '「館内の掃除のため」表示因为馆内清扫。'),
    question('还书箱在哪里？', ['入口左侧', '二楼楼梯旁', '入口右侧', '服务台后面'], 2, '通知说「入口の右にある返却ボックス」。'),
    question('周六几点开馆？', ['上午九点', '上午十点', '下午三点', '上午八点半'], 0, '「いつもどおり午前九時から」表示照常上午九点开始。')
  ]),
  lesson('lc-ja-routine', 'ja', '每天一点练习', 'passage', [
    segment('叙述', 'アンナさんは毎朝、朝ご飯の前に十五分、日本語を勉強しています。', '安娜每天早上在早餐前学习十五分钟日语。'),
    segment('叙述', 'まず短い話を聞いて、それから新しい言葉を三つノートに書きます。通勤の電車でもう一度同じ話を聞きます。', '她先听一段小故事，再把三个新词写到笔记本上。她会在通勤电车上再听一次相同的故事。'),
    segment('叙述', '週末は友達と日本語で話します。間違えても、毎日少しずつ続けることが大切だと思っています。', '周末她和朋友用日语交谈。她认为，即使会犯错，每天一点点坚持也很重要。')
  ], [
    question('安娜每天早上学习多久？', ['半小时', '五分钟', '一小时', '十五分钟'], 3, '第一句中的「十五分」给出了学习时长。'),
    question('她在哪里重听同一个故事？', ['图书馆', '通勤电车上', '朋友家', '餐馆'], 1, '「通勤の電車でもう一度同じ話を聞きます」说明在通勤电车上重听。'),
    question('她认为重要的是什么？', ['每天一点点坚持', '完全不犯错', '每天学习一小时', '只在周末学习'], 0, '最后一句强调「毎日少しずつ続けること」，即每天一点点持续练习。')
  ])
];
