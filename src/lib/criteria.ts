/** Mô tả ngắn 4 tiêu chí chấm Writing ở mức Band 8 (theo mô tả công khai của IELTS). */
export const WRITING_CRITERIA = [
  { key: 'TR', name: 'Task Response / Achievement', band8: 'Trả lời đầy đủ mọi phần của đề; ý được phát triển đầy đủ, có ví dụ/bằng chứng cụ thể; quan điểm rõ ràng xuyên suốt.' },
  { key: 'CC', name: 'Coherence & Cohesion', band8: 'Sắp xếp thông tin hợp lý, chia đoạn đúng; liên kết tự nhiên, không lạm dụng linking words.' },
  { key: 'LR', name: 'Lexical Resource', band8: 'Từ vựng đa dạng, dùng chính xác collocation; ít lỗi chọn từ/chính tả.' },
  { key: 'GRA', name: 'Grammatical Range & Accuracy', band8: 'Nhiều cấu trúc câu phức; phần lớn câu không có lỗi; lỗi chỉ thỉnh thoảng.' },
] as const;

/** Gợi ý nâng Band 6.5 → 8 cho Speaking, theo 4 tiêu chí. */
export const SPEAKING_TIPS = [
  { key: 'FC', name: 'Fluency & Coherence', tip: 'Nói liền mạch, ngập ngừng để tìm ý chứ không phải tìm từ. Mở rộng câu trả lời bằng lý do + ví dụ.' },
  { key: 'LR', name: 'Lexical Resource', tip: 'Dùng idiom và collocation tự nhiên (không nhồi nhét); biết paraphrase khi quên từ.' },
  { key: 'GRA', name: 'Grammar', tip: 'Trộn câu đơn và câu phức; dùng điều kiện, mệnh đề quan hệ, so sánh; tự sửa lỗi khi nhận ra.' },
  { key: 'P', name: 'Pronunciation', tip: 'Chú ý trọng âm từ và ngữ điệu; âm cuối (-s, -ed) hay bị rơi nhất với người Việt.' },
] as const;
