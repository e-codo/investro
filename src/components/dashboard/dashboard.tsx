"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@/components/icons";
import { Section } from "@/components/reveal";
import type { AppData } from "@/lib/app-types";
import { nameKey } from "@/lib/report/names";
import type { ParsedReport } from "@/lib/report/types";
import { draftFromReport, emptyDraft, type Draft } from "@/lib/review-model";
import type { BlockId } from "@/lib/schemas";
import { AllocationBlock } from "./allocation-block";
import { CalendarBlock } from "./calendar-block";
import { CouponsBlock } from "./coupons-block";
import { GoalBlock, MilestonesBlock } from "./goal-milestones";
import { GrowthBlock } from "./growth-block";
import { Header } from "./header";
import { buildModel } from "./model";
import { ReviewSheet } from "./review-sheet";
import { UploadSheet } from "./upload-sheet";
import { ValueBlock } from "./value-block";

export function Dashboard({ data, today }: { data: AppData; today: string }) {
  const router = useRouter();
  const m = useMemo(() => buildModel(data, today), [data, today]);
  const [upload, setUpload] = useState<{ expect?: string } | null>(null);
  const [review, setReview] = useState<{ draft: Draft; expect?: string } | null>(null);
  const visible = (id: BlockId) => data.settings.blocks[id] !== false;

  const classByKey = new Map(data.instruments.map((i) => [nameKey(i.name), i.classId]));
  const lookup = (name: string) => classByKey.get(nameKey(name)) ?? null;

  function parsed(r: ParsedReport) {
    setReview({ draft: draftFromReport(r, data.classes, lookup), expect: upload?.expect });
    setUpload(null);
  }

  return (
    <div className="wrap">
      <Header strategyName={m.strategyName} lastDate={m.last?.periodEnd ?? null} />
      {visible("title") && (
        <div className="hero">
          <h1>{data.settings.title}</h1>
          <p>{data.settings.subtitle}</p>
        </div>
      )}
      {visible("value") && <ValueBlock m={m} onUpload={() => setUpload({})} />}
      {visible("goal") && <GoalBlock m={m} goalK={data.settings.goalK} />}
      {visible("milestones") && <MilestonesBlock m={m} />}
      {visible("calendar") && <CalendarBlock data={data} m={m} onReplace={(month) => setUpload({ expect: month })} />}
      {visible("growth") && data.snapshots.length > 0 && <GrowthBlock snapshots={data.snapshots} />}
      {visible("coupons") && <CouponsBlock data={data} m={m} />}
      {visible("allocation") && data.settings.strategyEnabled && <AllocationBlock m={m} />}
      {visible("quote") && (
        <Section>
          <div className="sec-h"><span className="lbl">Цитата</span></div>
          <p className="quote">{data.settings.quote}</p>
        </Section>
      )}

      <button className="fab" type="button" aria-label="Загрузить отчёт" onClick={() => setUpload({})}>
        <PlusIcon />
        <span>Загрузить отчёт</span>
      </button>

      {upload && (
        <UploadSheet
          onClose={() => setUpload(null)}
          onParsed={parsed}
          onManual={() => {
            setReview({ draft: emptyDraft(today), expect: upload.expect });
            setUpload(null);
          }}
        />
      )}
      {review && (
        <ReviewSheet
          draft={review.draft}
          data={data}
          expectMonth={review.expect}
          onClose={() => setReview(null)}
          onSaved={() => {
            setReview(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
