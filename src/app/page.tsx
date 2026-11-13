import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Plus,
  Rocket,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MILEAGE_SCORE_TABLE } from "@/lib/constants/mileageScoreTable";

const AURA_LETTERS = [
  { letter: "A", word: "AI", desc: "AI 기반 학습 및 디지털 역량 확보", Icon: BrainCircuit },
  { letter: "U", word: "Upgrade", desc: "역량 향상 및 심화 학습", Icon: TrendingUp },
  { letter: "R", word: "Realize", desc: "실전 적용 및 성과 창출", Icon: Rocket },
  { letter: "A", word: "Achieve", desc: "목표 달성 및 성장 완성", Icon: Target },
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

const NOTICES: { title: string; body: React.ReactNode }[] = [
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
  {
    title: "중고급 이수자 장학금과 중복 수혜 불가",
    body: "중고급 이수자 장학금을 받는 학기에는 같은 학기 AURA 마일리지 장학금이 지급되지 않습니다.",
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

/** 섹션 위쪽 작은 번호 라벨 — 섹션 사이 구분선과 함께 각 칸의 시작을 알려준다. */
function Eyebrow({ no, label }: { no: string; label: string }) {
  return (
    <p className="mb-4 flex items-center gap-2 text-xs font-bold tracking-wider text-primary">
      <span className="rounded-full bg-primary-light px-2 py-0.5">{no}</span>
      {label}
    </p>
  );
}

function SectionHeading({ no, label, title, desc }: { no: string; label: string; title: string; desc?: string }) {
  return (
    <div className="max-w-2xl">
      <Eyebrow no={no} label={label} />
      <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h2>
      {desc && <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{desc}</p>}
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      {/* Hero — 가운데 정렬 큰 제목 + 은은한 배경 번짐(과하지 않게 아주 옅게) */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-180px] h-[480px] w-[820px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(75,71,224,0.16), rgba(75,71,224,0.06) 55%, transparent)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-24">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
            A.U.R.A <span className="text-primary">마일리지</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-lg">
            교육 참여, 활동, 성과에 따라 부여되는 점수로, 장학금(학기별 최대 150만원, 비참여학과
            100만원)으로 환산됩니다. 마일리지 조회부터 신청, 중고급 이수 신청까지 한 곳에서.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
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
          </div>
          <Link
            href="/privacy-consent"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-primary"
          >
            <ShieldCheck size={16} /> 개인정보 동의 확인
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl divide-y divide-border px-4 sm:px-6 [&>section]:py-16 sm:[&>section]:py-24 [&>section:first-child]:border-t [&>section:first-child]:border-border [&>section:last-child]:pb-12">
        {/* A.U.R.A란? */}
        <section>
          <SectionHeading
            no="01"
            label="ABOUT"
            title="A.U.R.A 마일리지란?"
            desc="AI인재양성부트캠프 사업과 직접 관련된 활동에만 부여되며, 관련 없는 자격증·경진대회·인턴십 등은 인정되지 않습니다."
          />
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AURA_LETTERS.map(({ letter, word, desc, Icon }, i) => (
              <Card key={i} className="flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                    <Icon size={20} />
                  </span>
                  <span className="text-3xl font-extrabold text-border">{letter}</span>
                </div>
                <p className="mt-6 text-lg font-bold text-foreground">{word}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* 이용 방법 */}
        <section>
          <SectionHeading no="02" label="HOW TO" title="이용 방법" desc="세 단계로 마일리지와 중고급 이수를 관리하세요." />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {USAGE_STEPS.map((step, i) => (
              <Link key={step.href} href={step.href} className="group">
                <Card className="flex h-full flex-col transition group-hover:-translate-y-0.5 group-hover:border-primary/40">
                  <span className="text-sm font-bold text-primary">STEP {String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-3 text-lg font-bold text-foreground">{step.title}</p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{step.desc}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition group-hover:text-primary">
                    바로가기 <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* 중고급 이수자 — 목업의 Pricing 섹션 구성 */}
        <section className="grid gap-6 lg:grid-cols-[1fr_1.35fr] lg:gap-8">
          <div className="flex flex-col gap-6">
            <SectionHeading
              no="03"
              label="ADVANCED TRACK"
              title="중고급 이수자 신청"
              desc="참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생만 신청할 수 있는 별도 트랙입니다. 조건을 모두 충족하고 사업단 승인을 받으면, AURA 마일리지 환산과는 별개로 장학금이 지급됩니다."
            />
            <Card className="mt-auto">
              <p className="text-xl font-extrabold tracking-tight text-foreground">
                내가 요건을 충족했는지
                <br />
                먼저 확인해보세요
              </p>
              <Link href="/apply-advanced/eligibility-check" className="mt-5 block">
                <Button size="lg" className="w-full">
                  요건 확인하기
                </Button>
              </Link>
            </Card>
          </div>

          <Card className="flex flex-col p-6 sm:p-8">
            <p className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">신청 조건</p>
            <p className="mt-2 text-sm text-muted">아래 조건을 모두 충족해야 합니다.</p>
            <ul className="mt-6 flex flex-col gap-4">
              {ADVANCED_REQUIREMENTS.map((r) => (
                <li key={r.label} className="flex gap-3">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">
                      {r.label} <span className="text-primary">{r.count}</span>
                    </p>
                    {r.hint && <p className="mt-0.5 text-sm text-muted">{r.hint}</p>}
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/apply-advanced"
              className="group mt-8 flex items-center justify-between rounded-2xl bg-surface px-6 py-5 transition hover:bg-primary-light"
            >
              <div>
                <p className="text-xs font-semibold text-muted">별도 장학금</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  150만원
                </p>
              </div>
              <ArrowRight size={22} className="text-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          </Card>
        </section>

        {/* 신청 시 꼭 확인하세요 — 목업의 FAQ 섹션 구성 */}
        <section className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <Eyebrow no="04" label="NOTICE" />
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl">
              신청 전<br className="hidden lg:block" /> 꼭 확인하세요
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {NOTICES.map((n, i) => (
              <details
                key={n.title}
                open={i === 0}
                className="group rounded-2xl border border-border/70 bg-white px-5 py-4 sm:px-6"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  {n.title}
                  <Plus size={18} className="shrink-0 text-muted transition group-open:rotate-45" />
                </summary>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">{n.body}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 점수표 */}
        <section>
          <SectionHeading no="05" label="SCORE TABLE" title="마일리지 점수표" desc="활동별로 부여되는 마일리지입니다." />
          <Card className="mt-8 overflow-x-auto p-0">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-5 py-3.5 font-semibold">구분</th>
                  <th className="px-5 py-3.5 font-semibold">세부 활동</th>
                  <th className="px-5 py-3.5 text-right font-semibold">마일리지</th>
                </tr>
              </thead>
              <tbody>
                {MILEAGE_SCORE_TABLE.map((row, i) => (
                  <tr key={i} className="border-b border-border/70 last:border-0">
                    <td className="px-5 py-2.5 font-semibold text-muted">{row.group}</td>
                    <td className="px-5 py-2.5">{row.label}</td>
                    <td className="px-5 py-2.5 text-right font-bold text-foreground">{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </div>
    </div>
  );
}
