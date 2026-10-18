import * as rawEngine from './engine';
import { Activity, ProcessData, Transition } from './types';

export * from './types';

/** The lifted engine. Its inferred types are meaningless, so it is exposed as untyped on purpose. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const engine: any = rawEngine;

/**
 * Reads an XPDL document (a definition from the database, or an uploaded file) and returns the model, the metadata
 * with every validation check, and the extra lists used by comparisons. Throws an Error with a readable message when
 * the text is not XML or has no WorkflowProcess.
 *
 * @param processIndex which WorkflowProcess of the package to read (0 for the first)
 */
export function parseXpdl(text: string, fileName: string, processIndex = 0): ProcessData {
  return engine.xpdlToData(text, fileName, processIndex) as unknown as ProcessData;
}

/** Plain-language description of an activity ("Asks an external system: ..."). */
export function describeStep(activity: ProcessData['D']['acts'][number], data: ProcessData['D']): string {
  return engine.bizStep(activity, data) as string;
}

/** A condition in plain words. */
export function describeCondition(condition: string): string {
  return engine.hcond(condition) as string;
}

export interface DiffItem {
  t: 'add' | 'del' | 'chg';
  x: string;
  d: string[];
}

export interface DiffResult {
  S: { key: string; title: string; items: DiffItem[] }[];
  rows: [string, number, number][];
  notes: string[];
  biz: { imp: 'high' | 'med' | 'low'; theme: string; text: string; d: string[] }[];
}

/** What changed from version A to version B, both technically (S) and in business terms (biz). */
export function compareVersions(a: ProcessData, b: ProcessData): DiffResult {
  return engine.diffVersions(a, b) as DiffResult;
}

export function diffAsText(result: DiffResult): string {
  return engine.diffText(result) as string;
}

export function businessAsText(result: DiffResult): string {
  return engine.bizText(result) as string;
}

export const BUSINESS_THEMES: string[] = engine.THEMES ?? [];

export interface Scenario {
  p: string[];
  e: { to: string; t?: Transition }[];
  out: string;
  steps: number;
  dev?: string[];
}

export interface Analysis {
  g: { A: Record<string, Activity> };
  paths: Scenario[];
  sc: Scenario[];
  all: number;
  trunc: boolean;
}

/** Every route through the process (up to 5000), with the standard path and a covering set of scenarios. */
export function analyseProcess(data: ProcessData): Analysis {
  return engine.analyse(data.D) as Analysis;
}

export function scenarioTitle(analysis: Analysis, scenario: Scenario): string {
  return engine.scTitle(analysis, scenario) as string;
}

/** The scenario as a list of plain sentences, each tagged: sys, man, dec, to or end. */
export function scenarioSteps(analysis: Analysis, scenario: Scenario): { k: string; x: string }[] {
  return engine.narr(analysis.g, scenario) as { k: string; x: string }[];
}

import { makeSim } from './sim-engine';

export interface ImpactUse {
  f: string;
  to: string;
  cond: string;
  direct: boolean;
  via: string[];
}

export interface ImpactTaint {
  /** The parameter and every value calculated from it. */
  T: Set<string>;
  why: Record<string, { act: string; via: string[] }>;
  conds: ImpactUse[];
  readers: { name: string; direct: boolean; sets: string[]; lines: string[] }[];
  passed: { act: string; kind: string; formal: string; mode: string }[];
  vals: string[];
}

export interface ImpactScenario {
  sig: string;
  out: string;
  names: string[];
  p: string[];
  e: { to: string; t?: Transition; timeout?: boolean }[];
  assume: string[];
  dev: number;
  derived: Record<string, string>;
  n: number;
  alts: string[][];
}

export interface ImpactRun {
  found: ImpactScenario[];
  partial: boolean;
  raw: number;
}

/** Walks the process with chosen values to see where a parameter changes the flow. One per loaded process. */
export interface Simulator {
  /** Every variable read by a condition, script or step input. */
  parameters(): string[];
  /** Values the process compares the variable with, as written in its conditions and scripts. */
  valuesOf(variable: string): string[];
  /** Where the variable is used: decisions, scripts, calculated values, system calls. */
  usage(variable: string): ImpactTaint;
  /** Every distinct way the flow can go when the variable has this value. */
  explore(variable: string, value: string, maxDeviations: number, usage: ImpactTaint, timeLimitMs?: number): ImpactRun;

  /** Inputs a person would supply to start a run: variables the process reads but never sets, with values seen in conditions. */
  inputs(): { name: string; values: string[]; checkedAt: string[] }[];
  /** Suggested responses for a system call or user field. */
  suggestions(variable: string): string[];
  start(values: Record<string, string>): SimState;
  step(state: SimState): void;
  /** Runs until the next system call, user task or the end (at most `max` steps). */
  run(state: SimState, max?: number): void;
  /** Answers the call or task the run is waiting at; `timeout` takes the timeout branch instead. */
  submit(state: SimState, values: Record<string, string>, timeout: boolean): void;
}

export interface SimState {
  V: Record<string, string | undefined>;
  cur: string;
  path: string[];
  edges: string[];
  log: { m: string; c: 'a' | 'd' | 'w' | 'ok' }[];
  n: number;
  done: boolean;
  /** The step waiting for an answer: a web service call or a user task. */
  wait: Activity | null;
  /** Variables changed by the last move. */
  chg: Set<string>;
}

export function createSimulator(data: ProcessData): Simulator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: any = makeSim(data.D);
  return {
    parameters: () => s.impAll() as string[],
    valuesOf: v => s.litsFor(v) as string[],
    usage: v => s.impTaint(v) as ImpactTaint,
    explore: (v, value, maxDeviations, usage, timeLimitMs = 1500) =>
      s.impExplore(v, value, maxDeviations, timeLimitMs, usage.T) as ImpactRun,
    inputs: () => (s.AN.inputs as string[]).map(name => ({
      name,
      values: (s.AN.cv[name]?.lits ?? []) as string[],
      checkedAt: (s.AN.cv[name]?.uses ?? []) as string[]
    })),
    suggestions: v => s.picks(v) as string[],
    start: values => s.newSim(values) as SimState,
    step: st => s.simStep(st),
    run: (st, max) => s.simRun(st, max),
    submit: (st, values, timeout) => s.simSubmit(st, values, timeout)
  };
}

/** A route as plain sentences (same tags as scenarioSteps), for any list of step ids and the transitions between. */
export function narrateRoute(data: ProcessData, scenario: { p: string[]; e: ImpactScenario['e'] }): { k: string; x: string }[] {
  return engine.narr(engine.graphOf(data.D), scenario) as { k: string; x: string }[];
}

/** Variable name in words ("Request_Type" becomes "Request Type"). */
export function plainName(name: string): string {
  return engine.hv(name) as string;
}

/** A condition in plain words. */
export function plainCondition(condition: string): string {
  return engine.hcond(condition) as string;
}

let conditionSim: ReturnType<typeof makeSim> | null = null;

/**
 * Whether a condition holds for the given attribute values, read and evaluated the way the explorer's simulator does
 * (null when the text cannot be read). Variables without a value are taken as "null", as the simulator does.
 */
export function evaluateCondition(condition: string, values: Record<string, string>): boolean | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sim: any = (conditionSim ??= makeSim({ acts: [], trs: [] }));
    return !!sim.ev(sim.cp('condition:' + condition, condition, 'expr'), { ...values });
  } catch {
    return null;
  }
}

/** Names of the variables a condition reads: the [Name] parts. */
export function conditionVariables(condition: string): string[] {
  const names = new Set<string>();
  (condition.match(/\[([^\]]+)\]/g) ?? []).forEach(m => names.add(m.slice(1, -1)));
  return [...names];
}
