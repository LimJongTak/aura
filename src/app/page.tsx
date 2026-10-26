import Link from "next/link";
import { ArrowRight, ClipboardList, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MILEAGE_SCORE_TABLE } from "@/lib/constants/mileageScoreTable";

const AURA_LETTERS = [
  { letter: "A", word: "AI", desc: "AI 기반 학습 및 디지털 역량 확보" },
  { letter: "U", word: "Upgrade", desc: "역량 향상 및 심화 학습" },
  { letter: "R", word: "Realize", desc: "실전 적용 및 성과 창출" },
  { letter: "A", word: "Achieve", desc: "목표 달성 및 성장 완성" },
];

const USAGE_STEPS = [
  {
    href: "/mypage",
    title: "마이페이지",
    desc: "로그인하면 누적 승인 마일리지, 신청 내역, 중고급 이수 신청·이수 과목 체크 현황을 한 곳에서 확인할 수 있습니다.",
  },
  {
    href: "/apply",
    title: "마일리지 신청",
    desc: "활동 구분과 세부 활동을 선택하면 부여될 마일리지와 필요한 증빙서류가 자동으로 표시됩니다. 증빙서류를 첨부해 신청하세요.",
  },
  {
    href: "/apply-advanced",
    title: "중고급 이수 신청",
    desc: "참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생만 신청 가능한 별도 장학금 트랙입니다.",
  },
];

const NOTICES:{ title: string; body: React.ReactNode }[] = [
  {
    title: "증빙서류에 학번·이름 기재",
    body: "증빙서류(파일 또는 사진)에는 반드시 본인의 학번과 이름을 기재해서 첨부해야 합니다. 기재되지 않으면 반려될 수 있습니다.",
  },
  {
    title: "환산 금액은 학기 말 확정",
    body: (
      <>
        1점당 환산 금액은 학기 말에 사업단이 예산과 인원수를 반영해 단 1회 최종 확정합니다. 확정
        전까지는 &quot;사업단 확정 대기&quot;로만 표시되며, 예상 금액을 미리 알 수 없습니다.
      </>
    ),
  },
  {
    title: "학기별 지급 한도",
    body: "확정 후 참여학과(인공지능공학전공·전기공학전공·전자공학전공)는 학기별 150만원, 비참여학과는 100만원 한도 내에서 지급됩니다.",
  },
  {
    title: "사업단 검토 후 확정",
    body: "신청 후 사업단 검토를 거쳐 승인·반려 상태로 확정되며, 허위 증빙 제출 시 마일리지가 취소될 수 있습니다.",
  },
];

const ADVANCED_REQUIREMENTS = [
  {
    count: "2개",
    label: "지원 대상 교과 이수",
    hint: "초급 공통교과 제외, 본인 학과 지정 교과목 중에서 선택",
  },
  { count: "1개", label: "몰입형 교육프로그램 이수" },
  { count: "1개", label: "비교과 프로그램 이수" },
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
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            A.U.R.A <span className="text-primary">마일리지</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            교육 참여, 활동, 성과 등에 대해 부여되는 점수이며, 장학금(학기별 최대 150만원, 비참여학과
            100만원)으로 환산·활용됩니다. 아래에서 내 마일리지를 조회하거나 신청해보세요.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/apply">
              <Button size="lg">
                <ClipboardList size={18} /> 마일리지 신청
              </Button>
            </Link>
            <Link href="/apply-advanced">
              <Button size="lg" variant="outline">
                <GraduationCap size={18} /> 중고급 이수 신청
              </Button>
            </Link>
            <Link href="/privacy-consent">
              <Button size="lg" variant="outline">
                <ShieldCheck size={18} /> 개인정보 동의 확인
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
              {USAGE_STEPS.map((step, i) => (
                <Link key={step.href} href={step.href} className="group">
                  <Card className="flex h-full flex-col transition group-hover:border-primary/50">
                    <p className="font-bold">
                      {"①②③"[i]} {step.title}
                    </p>
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted">{step.desc}</p>
                    <span className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition group-hover:border-primary group-hover:bg-primary group-hover:text-white">
                      {step.title} 바로가기 <ArrowRight size={15} />
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="신청 시 꼭 확인하세요">
            <Card className="p-0">
              <ol className="divide-y divide-border">
                {NOTICES.map((n, i) => (
                  <li key={n.title} className="flex gap-4 px-5 py-4 sm:px-6">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary-dark">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-bold text-foreground">{n.title}</p>
                      <p className="mt-1 text-foreground/70">{n.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="rounded-b-2xl border-t border-primary/15 bg-primary-light px-5 py-3.5 font-semibold text-primary-dark sm:px-6">
                중고급 이수자 장학금을 받는 학기에는 같은 학기 AURA 마일리지 장학금이 지급되지
                않습니다 (중복 수혜 불가).
              </p>
            </Card>
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
                  {MILEAGE_SCORE_TABLE.map((row, i) => (
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
            <Card>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <p className="max-w-2xl">
                  참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생만 신청할 수 있는 별도
                  트랙이에요. 아래 조건을 모두 충족하고 사업단 승인을 받으면, AURA 마일리지 환산과는
                  무관하게 별도 장학금이 지급돼요.
                </p>
                <div className="shrink-0 sm:text-right">
                  <p className="text-xs font-semibold text-muted">별도 장학금</p>
                  <p className="text-2xl font-extrabold text-primary">150만원</p>
                </div>
              </div>

              <p className="mt-6 text-xs font-semibold text-muted">신청 조건 · 모두 충족</p>
              <ul className="mt-2 grid gap-3 sm:grid-cols-3">
                {ADVANCED_REQUIREMENTS.map((r) => (
                  <li key={r.label} className="rounded-xl border border-border bg-surface px-4 py-3.5">
                    <p className="text-lg font-extrabold text-foreground">{r.count}</p>
                    <p className="mt-0.5 font-semibold text-foreground">{r.label}</p>
                    {r.hint && <p className="mt-1 text-xs leading-snug text-muted">{r.hint}</p>}
                  </li>
                ))}
              </ul>
            </Card>
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
