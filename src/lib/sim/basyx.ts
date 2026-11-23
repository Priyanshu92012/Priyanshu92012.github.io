// Import + conflict-resolution model for ConceptDescriptions from an .aasx package
// into a repository. Synthetic data; mirrors the importer's workflow, not its code.

export type ConceptDescription = {
  id: string;           // IRDI-style identifier (synthetic)
  idShort: string;
  preferredName: string;
  definition: string;
  unit?: string;
  source: 'concept' | 'cdd';
  version: string;
};
export type EmbeddedSpec = { submodelProperty: string; cdRef: string };
export type Package = { name: string; cds: ConceptDescription[]; eds: EmbeddedSpec[] };

export type EntryStatus = 'new' | 'identical' | 'conflict';
export type Decision = 'import' | 'overwrite' | 'skip';
export type Entry = { cd: ConceptDescription; status: EntryStatus; existing?: ConceptDescription; diff: string[] };

export const REPOSITORY: ConceptDescription[] = [
  { id: '0173-1#02-SIM001#001', idShort: 'MaxTemperature', preferredName: 'Maximum temperature', definition: 'Highest permissible operating temperature', unit: '°C', source: 'concept', version: '001' },
  { id: '0173-1#02-SIM002#002', idShort: 'RatedVoltage', preferredName: 'Rated voltage', definition: 'Nominal supply voltage', unit: 'V', source: 'cdd', version: '002' },
  { id: '0173-1#02-SIM003#001', idShort: 'SerialNumber', preferredName: 'Serial number', definition: 'Manufacturer-assigned unique serial', source: 'concept', version: '001' },
];

export const PACKAGES: Package[] = [
  {
    name: 'pump_station_demo.aasx',
    cds: [
      { id: '0173-1#02-SIM001#001', idShort: 'MaxTemperature', preferredName: 'Maximum temperature', definition: 'Highest permissible operating temperature', unit: '°C', source: 'concept', version: '001' },
      { id: '0173-1#02-SIM002#002', idShort: 'RatedVoltage', preferredName: 'Rated voltage', definition: 'Nominal supply voltage at rated load', unit: 'kV', source: 'cdd', version: '003' },
      { id: '0173-1#02-SIM004#001', idShort: 'FlowRate', preferredName: 'Flow rate', definition: 'Volumetric flow through the pump', unit: 'm³/h', source: 'cdd', version: '001' },
      { id: '0173-1#02-SIM005#001', idShort: 'MotorPower', preferredName: 'Motor power', definition: 'Mechanical output power', unit: 'kW', source: 'concept', version: '001' },
    ],
    eds: [
      { submodelProperty: 'TechnicalData/FlowRate', cdRef: '0173-1#02-SIM004#001' },
      { submodelProperty: 'TechnicalData/RatedVoltage', cdRef: '0173-1#02-SIM002#002' },
    ],
  },
  {
    name: 'sensor_module_demo.aasx',
    cds: [
      { id: '0173-1#02-SIM003#001', idShort: 'SerialNumber', preferredName: 'Serial no.', definition: 'Manufacturer-assigned unique serial', source: 'concept', version: '001' },
      { id: '0173-1#02-SIM006#001', idShort: 'MeasuringRange', preferredName: 'Measuring range', definition: 'Span between lower and upper measurable value', unit: 'bar', source: 'cdd', version: '001' },
    ],
    eds: [{ submodelProperty: 'Nameplate/SerialNumber', cdRef: '0173-1#02-SIM003#001' }],
  },
];

const FIELDS: (keyof ConceptDescription)[] = ['idShort', 'preferredName', 'definition', 'unit', 'version'];

export function compare(pkg: Package, repo: ConceptDescription[]): Entry[] {
  return pkg.cds.map((cd) => {
    const existing = repo.find((r) => r.id === cd.id);
    if (!existing) return { cd, status: 'new', diff: [] };
    const diff = FIELDS.filter((f) => (existing[f] ?? '') !== (cd[f] ?? '')).map((f) => `${f}: "${existing[f] ?? '—'}" → "${cd[f] ?? '—'}"`);
    return { cd, existing, status: diff.length ? 'conflict' : 'identical', diff };
  });
}

/** Safe defaults: import new entries, never overwrite a conflict unless the user chooses to. */
export function defaultDecision(e: Entry): Decision {
  return e.status === 'new' ? 'import' : 'skip';
}

export function apply(repo: ConceptDescription[], entries: Entry[], decisions: Record<string, Decision>) {
  const next = repo.map((r) => ({ ...r }));
  const report = { imported: [] as string[], overwritten: [] as string[], skipped: [] as string[], unchanged: [] as string[] };
  for (const e of entries) {
    const d = decisions[e.cd.id] ?? defaultDecision(e);
    if (e.status === 'identical') { report.unchanged.push(e.cd.id); continue; }
    if (d === 'skip') { report.skipped.push(e.cd.id); continue; }
    if (e.status === 'new' && d === 'import') { next.push({ ...e.cd }); report.imported.push(e.cd.id); continue; }
    if (e.status === 'conflict' && d === 'overwrite') { const i = next.findIndex((r) => r.id === e.cd.id); next[i] = { ...e.cd }; report.overwritten.push(e.cd.id); continue; }
    report.skipped.push(e.cd.id); // 'import' on a conflict is not allowed: it would silently overwrite
  }
  return { repo: next, report };
}
