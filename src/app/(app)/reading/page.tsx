import { ExamList } from '@/components/ExamList';

export default function ReadingIndex() {
  return (
    <main className="wide">
      <div className="page-head">
        <h1><span className="hl hl-yellow">Reading</span></h1>
        <p>Chọn một đề để làm. Đề lấy từ database; bài được chấm ở máy chủ nên đáp án chỉ hiện sau khi bạn nộp.</p>
      </div>
      <ExamList skill="reading" basePath="/reading" />
    </main>
  );
}
