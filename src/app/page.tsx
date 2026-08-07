import Link from "next/link";
import { ClipboardList, GraduationCap, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const AURA_LETTERS = [
  { letter: "A", word: "AI", desc: "AI 기반 학습 및 디지털 역량 확보" },
  { letter: "U", word: "Upgrade", desc: "역량 향상 및 심화 학습" },
  { letter: "R", word: "Realize", desc: "실전 적용 및 성과 창출" },
  { letter: "A", word: "Achieve", desc: "목표 달성 및 성장 완성" },
];

const SCORE_TABLE: { group: string; label: string; score: string }[] = [
  { group: "AI기반참여", label: "전공진입 (2학년 1학기)", score: "20점" },
  { group: "AI기반참여", label: "몰입형프로그램 참여", score: "50점" },
  { group: "AI기반참여", label: "교육참여 3일 이상", score: "25점" },
  { group: "AI기반참여", label: "교육참여 (4시간 이상)", score: "15점" },
  { group: "AI기반참여", label: "설명회 / 특강 참여", score: "10점" },
  { group: "역량향상", label: "참여 인증에 준하는 자격증", score: "5점" },
  { group: "역량향상", label: "산업기사 자격증", score: "10점" },
  { group: "역량향상", label: "AI 관련 자격증", score: "10점" },
  { group: "역량향상", label: "기사자격증", score: "15점" },
  { group: "역량향상", label: "국제공인 AI 관련 자격증", score: "15점" },
  { group: "실전경험", label: "현장실습 장기(3개월 이상)/연1회", score: "40점" },
  { group: "실전경험", label: "현장실습 중기(2개월 이상)/연1회", score: "30점" },
  { group: "실전경험", label: "현장실습 단기(1개월 이상)/연1회", score: "20점" },
  { group: "실전경험", label: "산학협력 프로젝트 참여", score: "30점" },
  { group: "실전경험", label: "산학협력 프로젝트 우수", score: "40점" },
  { group: "성과창출", label: "국내 경진대회/공모전 참가", score: "10점" },
  { group: "성과창출", label: "국내 경진대회/공모전 수상", score: "20점" },
  { group: "성과창출", label: "AI사업단 주관 경진대회 수상", score: "40점" },
  { group: "성과창출", label: "글로벌 경진대회/공모전 수상", score: "50점" },
  { group: "성과창출", label: "대외 논문 게재·전시·발표", score: "15점" },
  { group: "봉사", label: "사업단 주관 행사지원(시간당)", score: "5점" },
  { group: "기타", label: "사업단장 인정 활동", score: "최대 20점" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-extrabold text-foreground">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-[#2f7fd6]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-sm font-semibold text-white/80">국립순천대학교 · AI인재양성부트캠프사업단</p>
          <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">A.U.R.A 마일리지</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
            교육 참여, 활동, 성과 등에 대해 부여되는 점수이며, 장학금(학기별 최대 150만원, 비참여학과
            100만원)으로 환산·활용됩니다. 아래에서 내 마일리지를 조회하거나 신청해보세요.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/lookup">
              <Button size="lg" variant="white">
                <Search size={18} /> 마일리지 조회
              </Button>
            </Link>
            <Link href="/apply">
              <Button size="lg" variant="outlineOnDark">
                <ClipboardList size={18} /> 마일리지 신청
              </Button>
            </Link>
            <Link href="/apply-advanced">
              <Button size="lg" variant="outlineOnDark">
                <GraduationCap size={18} /> 중고급 이수 신청
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10">
          <Section title="A.U.R.A 마일리지란?">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {AURA_LETTERS.map((a, i) => (
                <Card key={i} className="text-center">
                  <p className="text-xl font-extrabold text-primary">{a.letter}</p>
                  <p className="mt-1 text-sm font-semibold">{a.word}</p>
                  <p className="mt-1.5 text-xs leading-snug text-muted">{a.desc}</p>
                </Card>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              ※ 마일리지는 반드시 AI인재양성부트캠프 사업과 직접 관련된 활동에만 부여되며, 관련 없는
              자격증·경진대회·인턴십 등은 인정되지 않습니다.
            </p>
          </Section>

          <Section title="이용 방법">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <Search className="text-primary" size={22} />
                <p className="mt-3 font-bold">① 마일리지 조회</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  이름과 학번을 입력하면 누적 승인 마일리지, 신청 내역, 중고급 이수 신청 현황을 바로
                  확인할 수 있습니다.
                </p>
              </Card>
              <Card>
                <ClipboardList className="text-primary" size={22} />
                <p className="mt-3 font-bold">② 마일리지 신청</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  활동 구분과 세부 활동을 선택하면 부여될 마일리지와 필요한 증빙서류가 자동으로
                  표시됩니다. 증빙서류를 첨부해 신청하세요.
                </p>
              </Card>
              <Card>
                <GraduationCap className="text-primary" size={22} />
                <p className="mt-3 font-bold">③ 중고급 이수 신청</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생만 신청 가능한 별도
                  장학금 트랙입니다.
                </p>
              </Card>
            </div>
          </Section>

          <Section title="신청 시 꼭 확인하세요">
            <ul className="flex flex-col gap-1.5">
              <li>· 증빙서류(파일 또는 사진)에는 반드시 본인의 학번과 이름을 기재해서 첨부해야 합니다. 기재되지 않으면 반려될 수 있습니다.</li>
              <li>
                · 1점당 환산 금액은 학기 말에 사업단이 예산과 인원수를 반영해 단 1회 최종 확정합니다.
                확정 전까지는 &quot;사업단 확정 대기&quot;로만 표시되며, 예상 금액을 미리 알 수 없습니다.
              </li>
              <li>
                · 확정 후 참여학과(인공지능공학전공·전기공학전공·전자공학전공)는 학기별 150만원,
                비참여학과는 100만원 한도 내에서 지급됩니다.
              </li>
              <li>· 신청 후 사업단 검토를 거쳐 승인·반려 상태로 확정되며, 허위 증빙 제출 시 마일리지가 취소될 수 있습니다.</li>
              <li className="font-semibold text-primary-dark">
                · 중고급 이수자 장학금을 받는 학기에는 같은 학기 AURA 마일리지 장학금이 지급되지 않습니다
                (중복 수혜 불가).
              </li>
            </ul>
          </Section>

          <Section title="마일리지 점수표">
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-muted">
                    <th className="px-4 py-3 font-semibold">구분</th>
                    <th className="px-4 py-3 font-semibold">세부 활동</th>
                    <th className="px-4 py-3 text-right font-semibold">마일리지</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORE_TABLE.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-semibold text-foreground/70">{row.group}</td>
                      <td className="px-4 py-2">{row.label}</td>
                      <td className="px-4 py-2 text-right font-semibold">{row.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>

          <Section title="중고급 이수자 신청 (참여학과 한정)">
            <p>
              참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생만 신청할 수 있는 별도
              트랙이에요. 아래 조건을 모두 충족하고 사업단 승인을 받으면, AURA 마일리지 환산과는
              무관하게 별도 장학금 150만원이 지급돼요.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              <li>· 지원 대상 교과 2개 이수 (초급 공통교과 제외, 본인 학과 지정 교과목 중에서 선택)</li>
              <li>· 몰입형 교육프로그램 1개 이수</li>
              <li>· 비교과 프로그램 1개 이수</li>
            </ul>
            <p className="mt-2 text-xs text-muted">
              단, 중고급 이수자 장학금을 받는 학기에는 같은 학기 AURA 마일리지 장학금은 지급되지
              않아요. 두 제도는 학기 단위로 중복 수혜가 불가하니, 신청 전에 어느 쪽이 유리한지 미리
              확인해보세요.
            </p>
          </Section>

          <Section title="문의처">
            <Card className="flex items-start gap-4 bg-surface">
              <Sparkles className="mt-0.5 shrink-0 text-primary" size={20} />
              <div>
                <p className="font-semibold text-foreground">국립순천대학교 AI인재양성부트캠프사업단</p>
                <p className="mt-1">문의 전화: 061-750-5390 · 5391 · 5393 · 5394 · 5396</p>
                <a
                  href="https://www.scnu.ac.kr/scnuai/main.do"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-semibold text-primary hover:underline"
                >
                  사업단 홈페이지 바로가기
                </a>
              </div>
            </Card>
          </Section>
        </div>
      </div>
    </div>
  );
}
