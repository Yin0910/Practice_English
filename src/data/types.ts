export interface VocabWord {
  id: string;
  word: string;
  pos: string;
  topic: string;
  vi: string;
  example: string;
  /** Collocation hoặc mẹo dùng trong bài thi. */
  tip: string;
}
