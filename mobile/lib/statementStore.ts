export interface TransactionCandidate {
  idx: number;
  transaction_date: string;
  description: string;
  merchant: string | null;
  amount: number;
  type: string;
  category: string;
  is_duplicate: boolean;
  duplicate_detail: string | null;
}

// Module-level store — survives navigation between upload and review screens
let _candidates: TransactionCandidate[] = [];

export function setCandidates(candidates: TransactionCandidate[]): void {
  _candidates = candidates;
}

export function getCandidates(): TransactionCandidate[] {
  return _candidates;
}

export function clearCandidates(): void {
  _candidates = [];
}
