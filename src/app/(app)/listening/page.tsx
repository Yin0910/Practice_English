import { ExamList } from '@/components/ExamList';

export default function ListeningIndex() {
  return (
    <main className="wide">
      <div className="page-head">
        <h1><span className="hl hl-lilac">Listening</span></h1>
        <p>Chọn một đề để nghe và làm. Như bài thi thật, mỗi đề chỉ được nghe một lần (có thể bật nghe lại khi luyện).</p>
      </div>
      <ExamList skill="listening" basePath="/listening" />
    </main>
  );
}
