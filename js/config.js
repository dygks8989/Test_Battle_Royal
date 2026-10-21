/* 온라인 접속 설정 — Supabase 프로젝트 'last-five'(서울)의 Realtime만 씀 (DB 테이블 없음)
   anon 키는 브라우저에 공개되는 용도의 키라 저장소에 넣어도 됩니다 (서버 비밀 키는 절대 넣지 않음) */
window.LF = window.LF || {};
LF.config = {
  supabaseUrl: 'https://nrzfqribjpmcoribblqe.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yemZxcmlianBtY29yaWJibHFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NzI5MzIsImV4cCI6MjEwODA0ODkzMn0.eji040AjBesIqc6xny4HkeeZSmzF6rAAFEIGoIaB1JE',
  // 무료 플랜 한도: 초당 메시지 100개(받는 쪽 기준으로 셈). 5명 × 초당 4.5회 × 4명 수신 ≈ 90
  tickMs: 220
};
