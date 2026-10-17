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
