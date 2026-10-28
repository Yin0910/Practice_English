import type { VocabWord } from './types';

type Row = [word: string, pos: string, vi: string, example: string, tip: string];

function topic(name: string, rows: Row[]): VocabWord[] {
  return rows.map(([word, pos, vi, example, tip], i) => ({
    id: `${name.toLowerCase().replace(/\W+/g, '-')}-${i + 1}`,
    word, pos, topic: name, vi, example, tip,
  }));
}

export const TOPICS = ['Environment', 'Education', 'Technology', 'Health', 'Society', 'Economy'] as const;

export const VOCAB: VocabWord[] = [
  ...topic('Environment', [
    ['mitigate', 'v', 'giảm nhẹ, làm dịu bớt', 'Governments must act now to mitigate the effects of climate change.', 'mitigate the effects / impact / risk of'],
    ['deplete', 'v', 'làm cạn kiệt', 'Intensive farming can deplete soil nutrients within a few decades.', 'deplete natural resources / ozone layer'],
    ['sustainable', 'adj', 'bền vững', 'Cities need sustainable transport systems to cut congestion.', 'sustainable development / energy / practices'],
    ['carbon footprint', 'n', 'lượng khí thải carbon (của một người, tổ chức)', 'Flying less is the simplest way to reduce one\'s carbon footprint.', 'reduce / cut / offset your carbon footprint'],
    ['biodiversity', 'n', 'đa dạng sinh học', 'Deforestation is the leading cause of biodiversity loss.', 'loss of / protect / preserve biodiversity'],
    ['emission', 'n', 'khí thải', 'Strict limits on vehicle emissions have improved air quality.', 'greenhouse gas emissions; cut / curb emissions'],
    ['renewable', 'adj', 'tái tạo được', 'Many countries are investing heavily in renewable energy sources.', 'renewable energy / resources; thay cho "clean energy" trong bài Band 8'],
  ]),
  ...topic('Education', [
    ['curriculum', 'n', 'chương trình học', 'The national curriculum should include financial literacy.', 'a broad / balanced curriculum; số nhiều: curricula'],
    ['tuition fees', 'n', 'học phí', 'Rising tuition fees discourage students from low-income families.', 'charge / waive / abolish tuition fees'],
    ['vocational', 'adj', 'thuộc dạy nghề, hướng nghiệp', 'Vocational training prepares school leavers for skilled jobs.', 'vocational training / courses / education'],
    ['compulsory', 'adj', 'bắt buộc', 'Compulsory education until sixteen is the norm in most countries.', 'compulsory subject / military service; đối lập: optional'],
    ['foster', 'v', 'nuôi dưỡng, thúc đẩy', 'Group projects foster teamwork and communication skills.', 'foster creativity / critical thinking / a sense of'],
    ['rote learning', 'n', 'học vẹt', 'Rote learning may help students pass tests but rarely builds understanding.', 'rely on / move away from rote learning'],
    ['academic attainment', 'n', 'thành tích, trình độ học vấn đạt được', 'Smaller classes are linked to higher academic attainment.', 'raise / improve academic attainment (trang trọng hơn "results")'],
  ]),
  ...topic('Technology', [
    ['automation', 'n', 'tự động hoá', 'Automation may eliminate many repetitive factory jobs.', 'the rise of automation; threaten jobs'],
    ['digital divide', 'n', 'khoảng cách số', 'The digital divide leaves rural students behind in online learning.', 'bridge / narrow / widen the digital divide'],
    ['cutting-edge', 'adj', 'tiên tiến nhất', 'Hospitals with cutting-edge equipment can diagnose illness earlier.', 'cutting-edge technology / research'],
    ['obsolete', 'adj', 'lỗi thời, không còn dùng', 'Typewriters became obsolete once personal computers spread.', 'become / render obsolete'],
    ['surveillance', 'n', 'sự giám sát', 'Mass surveillance raises serious concerns about privacy.', 'under surveillance; CCTV surveillance'],
    ['breakthrough', 'n', 'bước đột phá', 'A breakthrough in battery technology could transform electric cars.', 'a major / scientific / medical breakthrough'],
    ['addictive', 'adj', 'gây nghiện', 'Social media platforms are designed to be highly addictive.', 'highly / potentially addictive; addiction to + N'],
  ]),
  ...topic('Health', [
    ['sedentary', 'adj', 'ít vận động', 'A sedentary lifestyle increases the risk of heart disease.', 'sedentary lifestyle / job / habits'],
    ['obesity', 'n', 'béo phì', 'Childhood obesity has risen sharply in many urban areas.', 'rising rates of obesity; tackle / combat obesity'],
    ['preventive', 'adj', 'mang tính phòng ngừa', 'Preventive healthcare is cheaper than treating advanced illness.', 'preventive measures / medicine / care'],
    ['chronic', 'adj', 'mãn tính', 'Chronic conditions such as diabetes require long-term management.', 'chronic disease / illness / pain; đối lập: acute'],
    ['well-being', 'n', 'sức khoẻ và sự hài lòng về đời sống', 'Green spaces contribute to residents\' mental well-being.', 'physical / mental / emotional well-being'],
    ['life expectancy', 'n', 'tuổi thọ trung bình', 'Life expectancy has risen steadily thanks to better sanitation.', 'increase / raise life expectancy'],
    ['burden', 'n', 'gánh nặng', 'An ageing population places a heavy burden on healthcare systems.', 'place / impose a burden on; ease the burden'],
  ]),
  ...topic('Society', [
    ['urbanisation', 'n', 'đô thị hoá', 'Rapid urbanisation has strained housing and public services.', 'rapid urbanisation (Anh: -isation, Mỹ: -ization)'],
    ['disparity', 'n', 'sự chênh lệch', 'The disparity between rich and poor has widened in recent years.', 'income / wealth disparity; disparity between A and B'],
    ['marginalised', 'adj', 'bị gạt ra bên lề xã hội', 'Marginalised groups often lack access to basic services.', 'marginalised communities / groups'],
    ['cohesion', 'n', 'sự gắn kết', 'Shared public spaces promote social cohesion.', 'social / community cohesion; promote / undermine'],
    ['juvenile delinquency', 'n', 'tội phạm vị thành niên', 'Poverty and lack of supervision contribute to juvenile delinquency.', 'tackle / reduce juvenile delinquency'],
    ['ageing population', 'n', 'dân số già hoá', 'An ageing population means fewer workers supporting more retirees.', 'cope with / face an ageing population'],
    ['deter', 'v', 'ngăn chặn, răn đe', 'Heavy fines may deter people from dropping litter.', 'deter sb from doing sth; a deterrent effect'],
  ]),
  ...topic('Economy', [
    ['inflation', 'n', 'lạm phát', 'High inflation erodes the purchasing power of savings.', 'rising / soaring inflation; control / curb inflation'],
    ['subsidise', 'v', 'trợ cấp', 'Many governments subsidise public transport to keep fares low.', 'heavily subsidised; danh từ: subsidy'],
    ['workforce', 'n', 'lực lượng lao động', 'A skilled workforce attracts foreign investment.', 'a skilled / aging / diverse workforce'],
    ['stimulate', 'v', 'kích thích, thúc đẩy', 'Tax cuts can stimulate economic growth in the short term.', 'stimulate growth / demand / the economy'],
    ['disposable income', 'n', 'thu nhập khả dụng (sau thuế)', 'Families with higher disposable income spend more on leisure.', 'rise / fall in disposable income'],
    ['exploit', 'v', 'bóc lột; khai thác', 'Some factories exploit workers by paying below the minimum wage.', 'exploit workers / resources; exploitation (n)'],
    ['prosperity', 'n', 'sự thịnh vượng', 'Economic prosperity does not always lead to greater happiness.', 'economic prosperity; bring / achieve prosperity'],
  ]),
];
