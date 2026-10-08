export const languages = { en: { name: '英语', native: 'English', locale: 'en-US' }, ja: { name: '日语', native: '日本語', locale: 'ja-JP' } };
export const englishAccents = { 'en-US': { name: '美式英语', native: 'American English', short: '美式' }, 'en-GB': { name: '英式英语', native: 'British English', short: '英式' } };
export const modes = {
  dictation: { name: '听写练习', subtitle: '听发音，写下答案', icon: 'headphones', tone: 'blue' },
  meaning: { name: '听音选义', subtitle: '听声音，辨认意思', icon: 'volume', tone: 'violet' },
  recall: { name: '看义默写', subtitle: '看中文，主动回忆', icon: 'pen', tone: 'teal' },
  reading: { name: '阅读辨义', subtitle: '读原文，理解含义', icon: 'book', tone: 'amber' },
  shadow: { name: '录音跟读', subtitle: '听示范，对照自己的朗读', icon: 'mic', tone: 'rose' }
};
const enWords = [
 ['apple','苹果','/ˈæpəl/'], ['water','水','/ˈwɔːtər/'], ['window','窗户','/ˈwɪndoʊ/'], ['school','学校','/skuːl/'], ['friend','朋友','/frend/'],
 ['family','家人；家庭','/ˈfæməli/'], ['morning','早晨','/ˈmɔːrnɪŋ/'], ['beautiful','美丽的','/ˈbjuːtɪfəl/'], ['listen','听','/ˈlɪsən/'], ['write','写','/raɪt/'],
 ['read','阅读','/riːd/'], ['learn','学习','/lɜːrn/'], ['travel','旅行','/ˈtrævəl/'], ['coffee','咖啡','/ˈkɔːfi/'], ['library','图书馆','/ˈlaɪbreri/'],
 ['question','问题','/ˈkwestʃən/'], ['answer','答案；回答','/ˈænsər/'], ['important','重要的','/ɪmˈpɔːrtənt/'], ['practice','练习','/ˈpræktɪs/'], ['tomorrow','明天','/təˈmɑːroʊ/']
];
const enPhrases = [
 ['Good morning.','早上好。'], ['How are you?','你好吗？'], ['I would like some water.','我想要一些水。'], ['Where is the library?','图书馆在哪里？'], ['Please speak slowly.','请说慢一点。'],
 ['I am learning English.','我正在学习英语。'], ['What time is it?','现在几点了？'], ['Thank you for your help.','谢谢你的帮助。'], ['See you tomorrow.','明天见。'], ['Could you say that again?','你能再说一遍吗？']
];
const jaWords = [
 ['学校','がっこう','学校'], ['友達','ともだち','朋友'], ['家族','かぞく','家人；家庭'], ['水','みず','水'], ['本','ほん','书'],
 ['図書館','としょかん','图书馆'], ['朝','あさ','早晨'], ['明日','あした','明天'], ['今日','きょう','今天'], ['先生','せんせい','老师'],
 ['勉強','べんきょう','学习'], ['旅行','りょこう','旅行'], ['電車','でんしゃ','电车'], ['駅','えき','车站'], ['切手','きって','邮票'],
 ['お母さん','おかあさん','妈妈'], ['おいしい','おいしい','好吃的'], ['コーヒー','コーヒー','咖啡'], ['ありがとう','ありがとう','谢谢'], ['こんにちは','こんにちは','你好']
];
const jaPhrases = [
 ['おはようございます。','おはようございます','早上好。'], ['今日はいい天気ですね。','きょうはいいてんきですね','今天天气真好。'], ['水をください。','みずをください','请给我水。'], ['図書館はどこですか。','としょかんはどこですか','图书馆在哪里？'], ['ゆっくり話してください。','ゆっくりはなしてください','请说慢一点。'],
 ['日本語を勉強しています。','にほんごをべんきょうしています','我正在学习日语。'], ['今、何時ですか。','いまなんじですか','现在几点了？'], ['ありがとうございます。','ありがとうございます','谢谢您。'], ['また明日。','またあした','明天见。'], ['もう一度お願いします。','もういちどおねがいします','请再来一次。']
];
// New books have their own IDs; the original 60 IDs stay stable for saved progress.
const englishTopics = [
 { id:'en-travel', name:'旅行出行 · 单词', description:'20 个出行常用词，从机场到酒店', words:[
  ['airport','机场'], ['ticket','票；车票'], ['passport','护照'], ['luggage','行李'], ['station','车站'],
  ['train','火车'], ['bus','公共汽车'], ['taxi','出租车'], ['hotel','酒店'], ['room','房间'],
  ['reservation','预订'], ['map','地图'], ['street','街道'], ['bridge','桥'], ['entrance','入口'],
  ['exit','出口'], ['left','左边；向左'], ['right','右边；向右'], ['arrive','到达'], ['leave','离开']
 ]},
 { id:'en-food', name:'餐饮购物 · 单词', description:'20 个生活常用词，练习点餐与购物', words:[
  ['breakfast','早餐'], ['lunch','午餐'], ['dinner','晚餐'], ['bread','面包'], ['rice','米饭；大米'],
  ['milk','牛奶'], ['tea','茶'], ['juice','果汁'], ['chicken','鸡；鸡肉'], ['fish','鱼；鱼肉'],
  ['vegetable','蔬菜'], ['fruit','水果'], ['menu','菜单'], ['restaurant','餐馆'], ['delicious','美味的'],
  ['price','价格'], ['cheap','便宜的'], ['expensive','昂贵的'], ['cash','现金'], ['receipt','收据']
 ]},
 { id:'en-study', name:'学习工作 · 单词', description:'20 个学习与工作常用词，积累日常表达', words:[
  ['student','学生'], ['teacher','老师'], ['lesson','课；一节课'], ['homework','家庭作业'], ['notebook','笔记本'],
  ['dictionary','词典'], ['language','语言'], ['remember','记住'], ['understand','理解'], ['explain','解释'],
  ['office','办公室'], ['meeting','会议'], ['project','项目'], ['schedule','日程；时间表'], ['email','电子邮件'],
  ['computer','电脑'], ['finish','完成'], ['prepare','准备'], ['improve','改善；提高'], ['together','一起']
 ]}
];
const scenePhrases = [
 ['Where is the nearest station?','最近的车站在哪里？'], ['I have a reservation.','我有预订。'],
 ['How much is a ticket?','一张票多少钱？'], ['Does this bus go to the airport?','这辆公共汽车去机场吗？'],
 ['What time does the train leave?','火车几点出发？'], ['I would like a room for two nights.','我想订一个房间，住两晚。'],
 ['May I see the menu?','可以给我看一下菜单吗？'], ['I would like a cup of tea.','我想要一杯茶。'],
 ['Could I have the bill, please?','请帮我结账，好吗？'], ['Can I pay by card?','我可以刷卡付款吗？'],
 ['How much does this cost?','这个多少钱？'], ['Could I have a receipt?','可以给我一张收据吗？'],
 ['What does this word mean?','这个单词是什么意思？'], ['How do you spell it?','这个词怎么拼？'],
 ['Could you give me an example?','你能给我举个例子吗？'], ['Let me try again.','让我再试一次。'],
 ['I have a question.','我有一个问题。'], ['When does the meeting start?','会议什么时候开始？'],
 ['Please send me an email.','请给我发一封电子邮件。'], ['Let us practice together.','我们一起练习吧。']
];
export const builtinBooks = [
 { id: 'en-words', name: '日常英语 · 单词', language: 'en', kind: 'word', description: '20 个常用词，从生活开始' },
 { id: 'en-phrases', name: '日常英语 · 短句', language: 'en', kind: 'phrase', description: '10 条生活表达，听懂也会写' },
 { id: 'ja-words', name: '日常日语 · 单词', language: 'ja', kind: 'word', description: '20 个常用词，含假名读音' },
 { id: 'ja-phrases', name: '日常日语 · 短句', language: 'ja', kind: 'phrase', description: '10 条生活表达，练习整句理解' },
 ...englishTopics.map(({id,name,description})=>({id,name,description,language:'en',kind:'word'})),
 { id:'en-scenes', name:'实用场景 · 短句', language:'en', kind:'phrase', description:'20 条出行、餐饮和学习表达' }
];
export const builtinEntries = [
 ...enWords.map(([text, meaning, pronunciation], i) => ({ id: `en-w-${i+1}`, book: 'en-words', language: 'en', kind: 'word', text, meaning, pronunciation })),
 ...enPhrases.map(([text, meaning], i) => ({ id: `en-p-${i+1}`, book: 'en-phrases', language: 'en', kind: 'phrase', text, meaning })),
 ...jaWords.map(([text, reading, meaning], i) => ({ id: `ja-w-${i+1}`, book: 'ja-words', language: 'ja', kind: 'word', text, reading, meaning })),
 ...jaPhrases.map(([text, reading, meaning], i) => ({ id: `ja-p-${i+1}`, book: 'ja-phrases', language: 'ja', kind: 'phrase', text, reading, meaning })),
 ...englishTopics.flatMap(({id,words})=>words.map(([text,meaning],i)=>({id:`${id}-${i+1}`,book:id,language:'en',kind:'word',text,meaning}))),
 ...scenePhrases.map(([text,meaning],i)=>({id:`en-scene-${i+1}`,book:'en-scenes',language:'en',kind:'phrase',text,meaning}))
];
