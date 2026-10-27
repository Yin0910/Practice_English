import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';
import { TryIt } from '@/components/TryIt';
import { TOPICS, VOCAB } from '@/data/vocabulary';
import { TARGET_BAND } from '@/lib/bands';
import type { ExamSkill } from '@/lib/exam-types';
import { getDb } from '@/server/db';
import { examStats } from '@/server/exams-repo';

// Số đề lấy trực tiếp từ database nên trang này phải render lúc có người truy cập, không dựng sẵn.
export const dynamic = 'force-dynamic';

type Stats = Awaited<ReturnType<typeof examStats>>;
const EMPTY: Stats = { total: 0, questions: 0, topics: [], bySkill: { reading: 0, listening: 0, writing: 0, speaking: 0 } as Record<ExamSkill, number> };

/**
 * Chạy ở máy chủ: đọc thẳng database. Khi giao diện chạy riêng (Vercel) và có API_ORIGIN,
 * thì hỏi API trên máy chủ thay vì tự mở database.
 */
async function loadStats(): Promise<Stats> {
  try {
    const origin = process.env.API_ORIGIN?.replace(/\/$/, '');
    if (origin) {
      const res = await fetch(`${origin}/api/exams/stats`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
      return res.ok ? ((await res.json()) as Stats) : EMPTY;
    }
    return await examStats(await getDb());
  } catch {
    return EMPTY;
  }
}

const FAQ = [
  ['Có phải trả tiền không?', 'Không. Toàn bộ đề và tính năng trong project này dùng miễn phí và không cần tài khoản.'],
  ['Tiến độ của tôi lưu ở đâu?', 'Ngay trên trình duyệt của bạn (localStorage), không gửi đi đâu. Đổi máy hoặc xoá dữ liệu trình duyệt thì tiến độ sẽ mất. Riêng bộ đề nằm trong database trên máy chủ.'],
  ['Band hiển thị có chính xác không?', 'Đó là ước lượng. Với Reading và Listening, số câu đúng được quy tỉ lệ về thang 40 câu rồi tra bảng quy đổi. Với Writing và Speaking, band do AI hoặc chính bạn chấm theo 4 tiêu chí.'],
  ['Chấm Writing bằng AI hoạt động thế nào?', 'Khi quản trị viên cấu hình khoá API, bài viết của bạn được gửi tới dịch vụ AI để chấm 4 tiêu chí, chỉ lỗi từng chỗ và giải thích bằng tiếng Việt. Chưa cấu hình thì bạn vẫn tự chấm được.'],
] as const;

export default async function Landing() {
  const s = await loadStats();
  const cards: { skill: string; href: string; icon: IconName; tone: string; count: string; points: string[] }[] = [
    { skill: 'Reading', href: '/reading', icon: 'book', tone: 'c-yellow', count: `${s.bySkill.reading} đề`, points: ['True / False / Not Given, trắc nghiệm, điền từ', 'Đồng hồ tự nộp bài khi hết giờ', 'Chấm ngay, giải thích từng câu'] },
    { skill: 'Listening', href: '/listening', icon: 'headphones', tone: 'c-lilac', count: `${s.bySkill.listening} đề`, points: ['Chỉ nghe một lần như thi thật', 'Có bẫy tự sửa lời và gây nhầm số', 'Xem lời thoại sau khi nộp bài'] },
    { skill: 'Writing', href: '/writing', icon: 'pen', tone: 'c-green', count: `${s.bySkill.writing} đề`, points: ['Task 1 (bảng số liệu) và Task 2', 'Bấm giờ, đếm từ, lưu bản nháp', 'Chấm 4 tiêu chí bằng AI hoặc tự chấm'] },
    { skill: 'Speaking', href: '/speaking', icon: 'mic', tone: 'c-yellow', count: `${s.bySkill.speaking} đề`, points: ['Part 1, Part 2 (cue card), Part 3', 'Đồng hồ chuẩn bị và đồng hồ nói', 'Ghi âm, nghe lại, tự chấm'] },
    { skill: 'Vocabulary', href: '/vocabulary', icon: 'cards', tone: 'c-lilac', count: `${VOCAB.length} từ`, points: [`${TOPICS.length} chủ đề thường ra đề`, 'Flashcard nhắc ôn đúng lúc sắp quên', 'Collocation và mẹo dùng trong bài'] },
    { skill: 'Theo dõi', href: '/dashboard', icon: 'chart', tone: 'c-green', count: `Mục tiêu ${TARGET_BAND.toFixed(1)}`, points: ['Band ước lượng từng kỹ năng', 'Chuỗi ngày học, đếm ngược ngày thi', 'Lịch sử và đề đã làm'] },
  ];
  const steps = [
    ['Ôn từ vựng đến hạn', 'Khoảng 5 phút. Flashcard chỉ hiện những từ sắp quên.'],
    ['Làm một đề Reading hoặc Listening', 'Bấm giờ, nộp bài, đọc giải thích từng câu sai.'],
    ['Viết một bài (vài lần mỗi tuần)', 'Chọn đề, viết, chấm 4 tiêu chí rồi sửa lại theo nhận xét.'],
    ['Luyện nói và tự chấm', 'Ghi âm một câu trả lời Part 2, nghe lại và chấm.'],
  ];
  const sample = VOCAB[0]!;

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div>
            <span className="badge"><Icon name="sparkle" size={16} /> Miễn phí, không cần tài khoản</span>
            <h1>
              Luyện <span className="hl hl-green">đề</span> mỗi ngày, tự leo lên <span className="hl hl-yellow">band {TARGET_BAND.toFixed(1)}</span>
            </h1>
            <p className="lead">
              Kho đề Reading, Listening, Writing và Speaking cùng từ vựng học thuật. Chấm ngay, giải thích từng câu
              bằng tiếng Việt, theo dõi band mỗi ngày.
            </p>
            <div className="cta-row">
              <Link href="/dashboard" className="btn primary big">Bắt đầu luyện <Icon name="arrow" size={20} /></Link>
              <a href="#thu-ngay" className="btn-link"><span className="spark"><Icon name="sparkle" size={20} /></span>Thử ba câu hỏi</a>
            </div>
            <ul className="checklist">
              <li><Icon name="check" size={16} /> Không cần đăng ký</li>
              <li><Icon name="check" size={16} /> Chấm Reading, Listening ngay</li>
              <li><Icon name="check" size={16} /> Học được trên điện thoại</li>
            </ul>
            <div className="feature-pills">
              <div className="feature-pill"><span className="dot-icon c-yellow"><Icon name="book" size={18} /></span>{s.bySkill.reading} đề Reading</div>
              <div className="feature-pill"><span className="dot-icon c-lilac"><Icon name="headphones" size={18} /></span>{s.bySkill.listening} đề Listening</div>
              <div className="feature-pill"><span className="dot-icon c-green"><Icon name="pen" size={18} /></span>{s.bySkill.writing} đề Writing</div>
              <div className="feature-pill"><span className="dot-icon c-white"><Icon name="mic" size={18} /></span>{s.bySkill.speaking} đề Speaking</div>
            </div>
          </div>

          <div className="hero-visual" aria-label="Thống kê kho đề">
            <div className="card">
              <div className="row between" style={{ marginBottom: 14 }}>
                <h2 style={{ margin: 0 }}>Kho đề</h2>
                <span className="pill">{s.total} đề · {s.questions} câu hỏi</span>
              </div>
              <div className="bands">
                {(['reading', 'listening', 'writing', 'speaking'] as const).map((k) => (
                  <div key={k} className="band-row">
                    <span style={{ textTransform: 'capitalize' }}>{k}</span>
                    <div className="band-track">
                      <div className="band-fill" style={{ width: `${s.total ? (s.bySkill[k] / Math.max(...Object.values(s.bySkill), 1)) * 100 : 0}%` }} />
                    </div>
                    <span className="num">{s.bySkill[k]}</span>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ margin: '14px 0 0' }}>{s.topics.length} chủ đề: {s.topics.slice(0, 6).join(', ')}{s.topics.length > 6 ? '…' : ''}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="ky-nang">
        <div className="section-inner">
          <div className="section-head">
            <span className="eyebrow">Bản đồ luyện thi</span>
            <h2>Bốn kỹ năng, một <span className="hl hl-lilac">kho đề</span></h2>
            <p>Đề nằm trong database và được lấy qua API. Bạn chọn đề, làm bài, và xem band đang lên so với mục tiêu {TARGET_BAND.toFixed(1)}.</p>
          </div>
          <div className="station-grid">
            {cards.map((c) => (
              <article key={c.skill} className="station">
                <div className="row between">
                  <span className={`dot-icon ${c.tone}`} style={{ width: 44, height: 44 }}><Icon name={c.icon} size={22} /></span>
                  <span className="pill">{c.count}</span>
                </div>
                <h3>{c.skill}</h3>
                <ul>
                  {c.points.map((p) => <li key={p}><Icon name="check" size={16} />{p}</li>)}
                </ul>
                <Link href={c.href} className="btn">Mở {c.skill} <Icon name="arrow" size={16} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section white" id="thu-ngay">
        <div className="section-inner two-col">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <span className="eyebrow">Thử ngay</span>
            <h2>Học từ chính những <span className="hl hl-yellow">lỗi</span> hay mất điểm</h2>
            <p>Ba câu hỏi nhanh về diễn đạt, collocation và ngữ pháp. Chọn đáp án là có giải thích ngay, giống cách mỗi đề trong kho giải thích từng câu.</p>
            <Link href="/reading" className="btn">Xem kho đề Reading <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="demo"><TryIt /></div>
        </div>
      </section>

      <section className="section" id="mot-ngay">
        <div className="section-inner">
          <div className="section-head">
            <span className="eyebrow">Cách luyện</span>
            <h2>Một ngày luyện gồm <span className="hl hl-green">bốn bước</span></h2>
            <p>Không cần kế hoạch phức tạp. Mỗi ngày một vài việc nhỏ, lặp lại đều đặn sẽ hiệu quả hơn học dồn.</p>
          </div>
          <div className="steps">
            {steps.map(([title, text], idx) => (
              <div key={title} className="step">
                <span className="step-num">{idx + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section lilac" id="tu-vung">
        <div className="section-inner two-col">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <span className="eyebrow">Từ vựng</span>
            <h2>Biết từ là một chuyện, <span className="hl hl-yellow">dùng được</span> là chuyện khác</h2>
            <p>Mỗi từ có nghĩa tiếng Việt, câu ví dụ và collocation dùng được ngay trong bài viết. Từ sắp quên sẽ được nhắc lại đúng lúc.</p>
            <div className="topic-chips">
              {TOPICS.map((t) => <span key={t} className="chip">{t}</span>)}
            </div>
            <Link href="/vocabulary" className="btn primary">Học từ vựng <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="card flash" style={{ background: 'var(--white)' }}>
            <div className="muted">{sample.topic}</div>
            <div className="word">{sample.word}</div>
            <div className="muted">({sample.pos})</div>
            <div className="back">
              <p><b>{sample.vi}</b></p>
              <p><i>{sample.example}</i></p>
              <p className="muted" style={{ margin: 0 }}>Collocation: {sample.tip}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="hoi-dap">
        <div className="section-inner">
          <div className="section-head">
            <span className="eyebrow">Hỏi đáp</span>
            <h2>Câu hỏi <span className="hl hl-lilac">thường gặp</span></h2>
          </div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section white cta-band">
        <div className="section-inner">
          <h2>Sẵn sàng lên <span className="hl hl-green">band {TARGET_BAND.toFixed(1)}</span>?</h2>
          <p className="muted" style={{ fontSize: 17, marginBottom: 24 }}>Chọn một đề và làm ngay. Không cần đăng ký.</p>
          <Link href="/dashboard" className="btn primary big">Bắt đầu luyện <Icon name="arrow" size={20} /></Link>
        </div>
      </section>
    </>
  );
}
