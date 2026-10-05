import type { AssetType } from "./report/types";

// Данные, которые сервер отдаёт экранам. Деньги в копейках, даты ГГГГ-ММ-ДД.
export type ClassDTO = { id: string; name: string; weight: number };
export type InstrumentDTO = { id: string; name: string; type: AssetType; classId: string | null };
export type PositionDTO = { instrumentId: string; name: string; type: AssetType; classId: string | null; quantity: number; valueK: number };
export type SnapshotDTO = {
  id: string;
  month: string;
  periodStart: string;
  periodEnd: string;
  valueK: number;
  cashK: number;
  contributionK: number;
  deductionK: number;
  withdrawalK: number;
  feesK: number;
  taxesK: number;
  flowDate: string;
  positions: PositionDTO[];
};
export type CouponDTO = { name: string; date: string; amountK: number };

export type AppData = {
  settings: {
    title: string;
    subtitle: string;
    quote: string;
    goalK: number;
    depositRate: number;
    inflation: number;
    strategyEnabled: boolean;
    strategyName: string | null;
    blocks: Record<string, boolean>;
  };
  milestonesK: number[];
  classes: ClassDTO[];
  instruments: InstrumentDTO[];
  /** По возрастанию месяца. */
  snapshots: SnapshotDTO[];
  coupons: CouponDTO[];
};

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
